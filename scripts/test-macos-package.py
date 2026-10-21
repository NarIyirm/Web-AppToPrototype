"""Structural packaging tests; these do not execute macOS or validate signing."""
import importlib.util
import json
import plistlib
import stat
import struct
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location("mac_package", Path(__file__).with_name("package-macos.py"))
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class MacPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_root = Path(__file__).resolve().parent.parent / ".runtime" / "mac-package-tests"
        cls.temp_root.mkdir(parents=True, exist_ok=True)

    def temporary(self):
        return tempfile.TemporaryDirectory(prefix="case-", dir=self.temp_root)

    def fixture(self, root, arch="arm64", bad_link=False, cycle=False):
        runtime = root / "runtime.zip"
        with zipfile.ZipFile(runtime, "w") as archive:
            entries = {
                "Electron.app/Contents/Info.plist": plistlib.dumps({"LSMinimumSystemVersion": "13.0", "CFBundleExecutable": "Electron", "CFBundleIdentifier": "com.github.Electron", "ElectronAsarIntegrity": {"old": True}}),
                "Electron.app/Contents/MacOS/Electron": struct.pack("<II", 0xFEEDFACF, 0x0100000C if arch == "arm64" else 0x01000007) + b"synthetic",
                "Electron.app/Contents/Frameworks/Demo.framework/Versions/A/Resources/data": b"framework resource",
                "LICENSE": b"test license",
            }
            for name, body in entries.items():
                info = zipfile.ZipInfo(name)
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | (0o755 if name.endswith("/Electron") else 0o644)) << 16
                archive.writestr(info, body)
            link = zipfile.ZipInfo("Electron.app/Contents/Frameworks/Demo.framework/Versions/Current")
            link.create_system = 3
            link.external_attr = (stat.S_IFLNK | 0o755) << 16
            archive.writestr(link, b"../../../../../../outside" if bad_link else b"Cycle" if cycle else b"A")
            resource = zipfile.ZipInfo("Electron.app/Contents/Frameworks/Demo.framework/Resource")
            resource.create_system = 3
            resource.external_attr = (stat.S_IFLNK | 0o755) << 16
            archive.writestr(resource, b"Versions/Current/Resources/data")
            if cycle:
                other = zipfile.ZipInfo("Electron.app/Contents/Frameworks/Demo.framework/Versions/Cycle")
                other.create_system = 3
                other.external_attr = (stat.S_IFLNK | 0o755) << 16
                archive.writestr(other, b"Current")
        payload = root / "payload"
        app = payload / "WebToPrototype.app/Contents/Resources/app"
        app.mkdir(parents=True)
        (app / "package.json").write_text(json.dumps({"main": "apps/desktop/dist/main.cjs"}))
        (payload / "Prepare Mac.command").write_text("#!/bin/bash\nexit 0\n")
        return {"runtime": str(runtime), "runtimeSha256": package.digest(runtime), "output": str(root / "output.zip"), "folder": "Mac-test",
                "payload": str(payload), "arch": arch, "version": "0.1.0", "electronVersion": "test-fixture", "host": "synthetic"}

    def test_preserves_macho_symlink_modes_and_app_payload(self):
        with self.temporary() as folder:
            config = self.fixture(Path(folder))
            result = package.build(config)
            self.assertFalse(result["macRuntimeTested"])
            self.assertEqual(result["symlinks"], 2)
            with zipfile.ZipFile(config["output"]) as archive:
                self.assertIsNone(archive.testzip())
                link = archive.getinfo("Mac-test/WebToPrototype.app/Contents/Frameworks/Demo.framework/Versions/Current")
                self.assertTrue(stat.S_ISLNK(link.external_attr >> 16))
                self.assertEqual(archive.read(link), b"A")
                info = plistlib.loads(archive.read("Mac-test/WebToPrototype.app/Contents/Info.plist"))
                self.assertEqual(info["CFBundleIdentifier"], package.BUNDLE_ID)
                self.assertNotIn("ElectronAsarIntegrity", info)
                self.assertEqual(archive.getinfo("Mac-test/Prepare Mac.command").external_attr >> 16 & 0o777, 0o755)
                self.assertTrue(archive.read("Mac-test/WebToPrototype.app/Contents/Resources/app.icns").startswith(b"icns"))

    def test_rejects_wrong_runtime_hash(self):
        with self.temporary() as folder:
            config = self.fixture(Path(folder)); config["runtimeSha256"] = "0" * 64
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                package.build(config)

    def test_rejects_wrong_processor(self):
        with self.temporary() as folder:
            config = self.fixture(Path(folder)); config["arch"] = "x64"
            with self.assertRaisesRegex(ValueError, "architecture"):
                package.build(config)

    def test_rejects_framework_link_outside_app(self):
        with self.temporary() as folder:
            config = self.fixture(Path(folder), bad_link=True)
            with self.assertRaisesRegex(ValueError, "symlink"):
                package.build(config)

    def test_rejects_payload_replacing_runtime_metadata(self):
        with self.temporary() as folder:
            config = self.fixture(Path(folder))
            target = Path(config["payload"]) / "WebToPrototype.app/Contents/Info.plist"
            target.write_bytes(b"bad replacement")
            with self.assertRaisesRegex(ValueError, "Duplicate"):
                package.build(config)

    def test_rejects_framework_symlink_cycle(self):
        with self.temporary() as folder:
            config = self.fixture(Path(folder), cycle=True)
            with self.assertRaisesRegex(ValueError, "cyclic"):
                package.build(config)


if __name__ == "__main__":
    unittest.main()

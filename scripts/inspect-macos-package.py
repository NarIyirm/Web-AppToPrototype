"""Independently inspect the produced distribution ZIP, without executing Mac code."""
import argparse
import hashlib
import json
import plistlib
import posixpath
import stat
import struct
import zipfile
from pathlib import Path


def inspect(path, project_root=None):
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        names = {item.filename for item in entries}
        if len(names) != len(entries):
            raise ValueError("Duplicate ZIP entries")
        roots = {name.split("/", 1)[0] for name in names}
        if len(roots) != 1:
            raise ValueError("Expected one distribution directory")
        root = roots.pop() + "/"
        app = root + "WebToPrototype.app/"
        metadata = json.loads(archive.read(root + "MAC-BUILD.json"))
        info = plistlib.loads(archive.read(app + "Contents/Info.plist"))
        if info["CFBundleIdentifier"] != "org.webtoprototype.desktop" or info["W2PTargetArchitecture"] != metadata["arch"]:
            raise ValueError("Application identity/architecture mismatch")
        executable = app + "Contents/MacOS/" + info["CFBundleExecutable"]
        header = archive.open(executable).read(8)
        cpu = 0x0100000C if metadata["arch"] == "arm64" else 0x01000007
        if struct.unpack("<II", header) != (0xFEEDFACF, cpu):
            raise ValueError("Actual executable CPU mismatch")
        if not archive.getinfo(executable).external_attr >> 16 & 0o111:
            raise ValueError("Application executable lost Unix execute bits")
        package = json.loads(archive.read(app + "Contents/Resources/app/package.json"))
        if package["main"] != "apps/desktop/dist/main.cjs" or package["version"] != metadata["version"]:
            raise ValueError("Bundled application entry/version mismatch")
        required = [
            "Contents/Resources/app/apps/desktop/dist/main.cjs",
            "Contents/Resources/app/apps/desktop/dist/preload.cjs",
            "Contents/Resources/app/apps/desktop/dist/capture.js",
            "Contents/Resources/app/apps/desktop/dist/renderer.js",
            "Contents/Resources/app/apps/desktop/fixtures/probe.html",
            "Contents/Resources/app/apps/desktop/fixtures/prototype.html",
            "Contents/Resources/app/apps/desktop/fixtures/auth.html",
            "Contents/Resources/app/apps/figma-plugin/dist/manifest.json",
            "Contents/Resources/app.icns",
        ]
        for name in required:
            archive.getinfo(app + name)
        for name in ("Prepare Mac.command", "macos-tools/prepare-app.sh", "macos-tools/resolve-app.sh", "macos-tools/make-dmg.sh"):
            if archive.getinfo(root + name).external_attr >> 16 & 0o777 != 0o755:
                raise ValueError("Preparation command is not executable: " + name)
            body = archive.read(root + name)
            if not body.startswith(b"#!/bin/bash\n") or b"\r" in body:
                raise ValueError("Mac command requires a UTF-8 shebang and LF lines: " + name)
        manifest = {}
        for line in archive.read(root + "SHA256SUMS.txt").decode().splitlines():
            sha, name = line.split("  ", 1)
            if name in manifest:
                raise ValueError("Duplicate manifest entry")
            manifest[name] = sha
        actual_files = {i.filename[len(root):] for i in entries if not i.is_dir() and i.filename != root + "SHA256SUMS.txt"}
        if actual_files != set(manifest):
            raise ValueError("Manifest does not cover all distribution files")
        links = {}
        for item in entries:
            name = item.filename
            if "\\" in name or name.startswith("/") or any(p in (".", "..") or ":" in p for p in name.rstrip("/").split("/")):
                raise ValueError("Unsafe archive path")
            if name.endswith("/") or name == root + "SHA256SUMS.txt":
                continue
            checksum = hashlib.sha256()
            with archive.open(item) as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    checksum.update(block)
            if checksum.hexdigest() != manifest[name[len(root):]]:
                raise ValueError("File content/CRC or manifest mismatch: " + name)
            if stat.S_ISLNK(item.external_attr >> 16):
                target = archive.read(item).decode()
                if target.startswith("/") or "\\" in target:
                    raise ValueError("Absolute framework symlink")
                links[name] = target

        def resolve_link(name, depth=0):
            if depth > 32 or not name.startswith(app):
                raise ValueError("Framework symlink cycle or escape")
            parts = name.split("/")
            for index in range(len(parts)):
                parent = "/".join(parts[:index + 1])
                if parent in links:
                    target = posixpath.normpath(posixpath.join(posixpath.dirname(parent), links[parent], *parts[index + 1:]))
                    return resolve_link(target, depth + 1)
            if name not in names and not any(p.startswith(name + "/") for p in names):
                raise ValueError("Framework symlink destination missing")
            return name
        for name in links:
            resolve_link(name)
        source_files = 0
        if project_root:
            project = Path(project_root).resolve()
            for source_name, bundled_name in [("scripts/Prepare Mac.command", "Prepare Mac.command"),
                                               *[("scripts/mac-tools/" + name, "macos-tools/" + name)
                                                 for name in ("prepare-app.sh", "resolve-app.sh", "make-dmg.sh", "entitlements.plist")]]:
                if archive.read(root + bundled_name) != (project / source_name).read_bytes():
                    raise ValueError("Bundled preparation tool differs from current source: " + bundled_name)
                source_files += 1
            for directory in ("apps/desktop/dist", "apps/desktop/fixtures", "apps/figma-plugin/dist"):
                for source in sorted((project / directory).rglob("*")):
                    if not source.is_file():
                        continue
                    relative = source.relative_to(project).as_posix()
                    expected = hashlib.sha256(source.read_bytes()).hexdigest()
                    if manifest.get("WebToPrototype.app/Contents/Resources/app/" + relative) != expected:
                        raise ValueError("Bundled file differs from current build: " + relative)
                    source_files += 1
        return {"arch": metadata["arch"], "minimumMacOS": info["LSMinimumSystemVersion"], "entries": len(entries),
                "filesVerified": len(manifest), "symlinksVerified": len(links), "machOCPUVerified": True,
                "unixModesVerified": True, "manifestVerified": True, "macRuntimeTested": False,
                "sourceFilesVerified": source_files, "signingTested": False, "notarized": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("zip")
    parser.add_argument("--report")
    parser.add_argument("--project-root")
    args = parser.parse_args()
    result = inspect(args.zip, args.project_root)
    if args.report:
        Path(args.report).write_text(json.dumps(result, indent=2), encoding="utf8")
    print(json.dumps(result, indent=2))

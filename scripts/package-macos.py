"""Build a macOS ZIP without extracting Unix symlinks on the build host.

Only verified Electron runtimes and an explicit local payload are accepted.
The result is a development candidate; native signing/testing is separate.
"""
import argparse
import copy
import hashlib
import json
import plistlib
import posixpath
import stat
import struct
import zipfile
import zlib
from pathlib import Path

BUNDLE_ID = "org.webtoprototype.desktop"


def digest(path):
    value = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def safe_name(name):
    parts = name.rstrip("/").split("/")
    if not name or "\\" in name or name.startswith("/") or any(p in ("", ".", "..") or ":" in p for p in parts):
        raise ValueError("Unsafe archive path: " + name)
    return name


def icon():
    # The same dark tile and white W used in the existing workbench identity.
    side = 1024
    points = [(260, 290), (365, 735), (512, 440), (659, 735), (764, 290)]
    rows = bytearray()
    for y in range(side):
        rows.append(0)
        for x in range(side):
            dx, dy = max(244 - x, 0, x - 780), max(244 - y, 0, y - 780)
            inside = dx * dx + dy * dy <= 180 * 180 and 64 <= x < 960 and 64 <= y < 960
            white = False
            if inside and 205 <= x <= 820 and 235 <= y <= 790:
                for a, b in zip(points, points[1:]):
                    vx, vy = b[0] - a[0], b[1] - a[1]
                    t = max(0, min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy)))
                    if (x - a[0] - t * vx) ** 2 + (y - a[1] - t * vy) ** 2 <= 42 ** 2:
                        white = True
                        break
            rows.extend((255, 255, 255, 255) if white else (35, 35, 39, 255) if inside else (0, 0, 0, 0))
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", side, side, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")
    entry = b"ic10" + struct.pack(">I", len(png) + 8) + png
    return b"icns" + struct.pack(">I", len(entry) + 8) + entry


def build(config):
    runtime, output = Path(config["runtime"]), Path(config["output"])
    if config["arch"] not in ("arm64", "x64"):
        raise ValueError("Unsupported Mac architecture")
    if digest(runtime) != config["runtimeSha256"]:
        raise ValueError("Electron runtime SHA-256 mismatch")
    if output.exists():
        raise ValueError("Output already exists")
    prefix = safe_name(config["folder"]) + "/"
    if "/" in config["folder"]:
        raise ValueError("Output folder must be a basename")
    records, seen = [], set()
    minimum_os = None
    cpu = 0x0100000C if config["arch"] == "arm64" else 0x01000007
    source_names = set()
    with zipfile.ZipFile(runtime) as source, zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=False) as target:
        source_names = {i.filename for i in source.infolist()}
        if len(source_names) != len(source.infolist()):
            raise ValueError("Duplicate runtime archive entry")
        runtime_links = {i.filename: source.read(i).decode("utf8") for i in source.infolist() if stat.S_ISLNK(i.external_attr >> 16)}

        def resolve_runtime(name, depth=0):
            if depth > 32 or not name.startswith("Electron.app/"):
                raise ValueError("Unsafe or cyclic framework symlink: " + name)
            parts = name.split("/")
            for index in range(len(parts)):
                prefix_name = "/".join(parts[:index + 1])
                if prefix_name in runtime_links:
                    link = runtime_links[prefix_name]
                    if not link or link.startswith("/") or "\\" in link or ":" in link:
                        raise ValueError("Unsafe framework symlink: " + prefix_name)
                    destination = posixpath.normpath(posixpath.join(posixpath.dirname(prefix_name), link, *parts[index + 1:]))
                    return resolve_runtime(destination, depth + 1)
            if name not in source_names and not any(p.startswith(name + "/") for p in source_names):
                raise ValueError("Missing framework symlink destination: " + name)
            return name

        for name in runtime_links:
            resolve_runtime(name)
        main_info = plistlib.loads(source.read("Electron.app/Contents/Info.plist"))
        minimum_os = main_info["LSMinimumSystemVersion"]
        header = source.read("Electron.app/Contents/MacOS/Electron")[:8]
        if len(header) != 8 or struct.unpack("<II", header) != (0xFEEDFACF, cpu):
            raise ValueError("Electron Mach-O architecture mismatch")

        def add(name, body=None, info=None, stream=None):
            safe_name(name)
            if name in seen:
                raise ValueError("Duplicate archive path: " + name)
            seen.add(name)
            entry = copy.copy(info) if info else zipfile.ZipInfo(name)
            entry.filename = name
            entry.create_system = 3
            if not info:
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.external_attr = (stat.S_IFREG | 0o644) << 16
            value = hashlib.sha256()
            size = 0
            with target.open(entry, "w") as dest:
                if body is not None:
                    value.update(body)
                    size = len(body)
                    dest.write(body)
                elif stream is not None:
                    for block in iter(lambda: stream.read(1024 * 1024), b""):
                        value.update(block)
                        size += len(block)
                        dest.write(block)
            if not name.endswith("/"):
                records.append({"path": name[len(prefix):], "bytes": size, "sha256": value.hexdigest(), "mode": oct(entry.external_attr >> 16)})

        for original in source.infolist():
            name = safe_name(original.filename)
            if name.startswith("Electron.app/"):
                if "/_CodeSignature/" in name or name.endswith("/default_app.asar"):
                    continue
                mapped = name.replace("Electron.app/", "WebToPrototype.app/", 1)
            elif name in ("LICENSE", "LICENSES.chromium.html", "version"):
                mapped = "ELECTRON-" + name
            else:
                raise ValueError("Unexpected runtime entry: " + name)
            if name == "Electron.app/Contents/Info.plist":
                main_info.update(CFBundleDisplayName="WebToPrototype", CFBundleName="WebToPrototype", CFBundleIdentifier=BUNDLE_ID,
                                 CFBundleShortVersionString=config["version"], CFBundleVersion=config["version"], CFBundleIconFile="app.icns",
                                 LSApplicationCategoryType="public.app-category.developer-tools", W2PTargetArchitecture=config["arch"])
                main_info.pop("ElectronAsarIntegrity", None)
                add(prefix + mapped, plistlib.dumps(main_info), original)
            elif "/Electron Helper" in name and name.endswith("/Contents/Info.plist"):
                helper = plistlib.loads(source.read(original))
                for key in ("CFBundleDisplayName", "CFBundleName"):
                    if key in helper:
                        helper[key] = helper[key].replace("Electron", "WebToPrototype", 1)
                helper["CFBundleIdentifier"] = helper["CFBundleIdentifier"].replace("com.github.Electron", BUNDLE_ID, 1)
                add(prefix + mapped, plistlib.dumps(helper), original)
            else:
                with source.open(original) as stream:
                    add(prefix + mapped, info=original, stream=stream)

        add(prefix + "WebToPrototype.app/Contents/Resources/app.icns", icon())
        payload = Path(config["payload"])
        for file in sorted(payload.rglob("*")):
            if not file.is_file():
                continue
            relative = file.relative_to(payload).as_posix()
            safe_name(relative)
            info = zipfile.ZipInfo(prefix + relative)
            info.create_system = 3
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | (0o755 if relative.endswith((".sh", ".command")) else 0o644)) << 16
            with file.open("rb") as stream:
                add(prefix + relative, info=info, stream=stream)
        metadata = {"version": config["version"], "platform": "darwin", "arch": config["arch"], "minimumMacOS": minimum_os,
                    "electronVersion": config["electronVersion"], "runtimeSha256": config["runtimeSha256"], "builtOn": config["host"],
                    "signing": "requires local Mac preparation", "notarized": False, "macRuntimeTested": False}
        add(prefix + "MAC-BUILD.json", json.dumps(metadata, ensure_ascii=False, indent=2).encode())
        manifest = "".join(r["sha256"] + "  " + r["path"] + "\n" for r in records)
        add(prefix + "SHA256SUMS.txt", manifest.encode())
    return {**metadata, "zip": str(output), "sha256": digest(output), "zipBytes": output.stat().st_size,
            "entries": len(seen), "symlinks": sum(stat.S_ISLNK(int(r["mode"], 8)) for r in records)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding="utf8"))
    result = build(config)
    Path(config["result"]).write_text(json.dumps(result, indent=2), encoding="utf8")
    print(json.dumps(result, indent=2))

#!/bin/bash
set -euo pipefail
if [[ "$(uname -s)" != Darwin ]]; then echo '此步骤必须在 macOS 执行。' >&2; exit 1; fi
if [[ $# -ne 1 ]]; then printf '请指定一个 WebToPrototype.app 完整路径（收到 %s 个参数）。\n' "$#" >&2; exit 1; fi
if [[ ! -d "$1/Contents" || ! -f "$1/Contents/Info.plist" ]]; then printf '应用目录不完整或不存在，未进行签名：%s\n需要 Contents/Info.plist；请完整解压ZIP或指定已安装应用的实际路径。\n' "$1" >&2; exit 1; fi
tools="$(cd "$(dirname "$0")" && pwd -P)"
app="$(cd "$(dirname "$1")" && pwd -P)/$(basename "$1")"
printf '签名目标：%s\n' "$app"
identifier="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Contents/Info.plist")"
if [[ "$identifier" != org.webtoprototype.desktop ]]; then echo '应用标识不匹配，未进行签名。' >&2; exit 1; fi
architecture="$(/usr/libexec/PlistBuddy -c 'Print :W2PTargetArchitecture' "$app/Contents/Info.plist")"
if [[ "$architecture" == arm64 && "$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null || true)" != 1 ]]; then echo '此包需要 Apple Silicon Mac。' >&2; exit 1; fi
# Local development preparation only. No Gatekeeper settings or quarantine
# attributes are changed. Public distribution needs Developer ID/notarization.
identity="${MAC_SIGN_IDENTITY:--}"
flags=(--force --sign "$identity" --entitlements "$tools/entitlements.plist")
if [[ "$identity" != - ]]; then flags+=(--options runtime); fi
# Sign executable code before its enclosing bundles, then seal the outer app.
# Do not follow Framework symlinks or use --deep as a signing shortcut.
while IFS= read -r -d '' file; do
  kind="$(/usr/bin/file -b "$file")"
  if [[ "$kind" == *Mach-O* ]]; then /usr/bin/codesign "${flags[@]}" "$file"; fi
done < <(/usr/bin/find "$app/Contents" -type f -print0)
while IFS= read -r -d '' bundle; do
  /usr/bin/codesign "${flags[@]}" "$bundle"
done < <(/usr/bin/find "$app/Contents" -depth -type d \( -name '*.app' -o -name '*.framework' -o -name '*.bundle' \) -print0)
/usr/bin/codesign "${flags[@]}" "$app"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$app"
/usr/bin/codesign --display --verbose=2 "$app"
printf '已完成本机签名校验。尚未进行 Apple 公证或应用功能验证。\n'

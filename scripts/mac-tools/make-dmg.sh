#!/bin/bash
set -euo pipefail
if [[ "$(uname -s)" != Darwin || $# -ne 2 ]]; then echo '用法：在Mac运行 make-dmg.sh 输入.zip 输出.dmg' >&2; exit 1; fi
archive="$(cd "$(dirname "$1")" && pwd -P)/$(basename "$1")"
output="$(cd "$(dirname "$2")" && pwd -P)/$(basename "$2")"
if [[ -e "$output" ]]; then echo '输出已存在，未覆盖。' >&2; exit 1; fi
work="$(mktemp -d "$(dirname "$archive")/macos-build.XXXXXX")"
/usr/bin/ditto -x -k "$archive" "$work"
stage="$work/$(basename "$archive" .zip)"
/bin/bash "$(dirname "$0")/prepare-app.sh" "$stage/WebToPrototype.app"
ln -s /Applications "$stage/Applications"
/usr/bin/hdiutil create -volname WebToPrototype -srcfolder "$stage" -format UDZO "$output"
printf '已生成DMG：%s\n临时签名目录保留：%s\n' "$output" "$work"

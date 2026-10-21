#!/bin/bash
# Portable path-selection regression tests. These do not execute macOS signing.
set -euo pipefail
source scripts/mac-tools/resolve-app.sh
mkdir -p .runtime/mac-prepare-tests
work="$(mktemp -d .runtime/mac-prepare-tests/case.XXXXXX)"
work="$(cd "$work" && pwd -P)"
count=0
app_fixture() { mkdir -p "$1/Contents"; printf 'fixture only\n' > "$1/Contents/Info.plist"; }
expect_path() {
  local expected="$1"; shift
  local actual
  actual="$(w2p_resolve_app "$@")"
  [[ "$actual" == "$expected" ]] || { printf 'Expected %s, received %s\n' "$expected" "$actual" >&2; exit 1; }
  count=$((count + 1))
}
expect_error() {
  local message="$1"; shift
  if w2p_resolve_app "$@" > "$work/stdout" 2> "$work/stderr"; then echo 'Expected failure' >&2; exit 1; fi
  [[ ! -s "$work/stdout" ]] && grep -F "$message" "$work/stderr" > /dev/null
  count=$((count + 1))
}
root="$work/解压 folder"; user_apps="$work/User Applications"; system_apps="$work/Applications"
mkdir -p "$root" "$user_apps" "$system_apps"
expect_error '未找到应用' "$root" "$user_apps" "$system_apps"
grep -F "$root/WebToPrototype.app" "$work/stderr" > /dev/null
app_fixture "$system_apps/WebToPrototype.app"
expect_path "$system_apps/WebToPrototype.app" "$root" "$user_apps" "$system_apps"
app_fixture "$root/WebToPrototype.app"
expect_path "$root/WebToPrototype.app" "$root" "$user_apps" "$system_apps"
mv "$root/WebToPrototype.app/Contents/Info.plist" "$root/WebToPrototype.app/Contents/fixture-plist"
expect_error '应用目录不完整' "$root" "$user_apps" "$system_apps"
app_fixture "$user_apps/WebToPrototype.app"
empty="$work/empty"; mkdir -p "$empty"
expect_error '找到两个安装副本' "$empty" "$user_apps" "$system_apps"
expect_path "$system_apps/WebToPrototype.app" "$empty" "$user_apps" "$system_apps" "$system_apps/WebToPrototype.app"
expect_path "$user_apps/WebToPrototype.app" "$empty" "$user_apps" "$empty"
literal="$work/renamed \$(touch SHOULD_NOT_EXIST).app"; app_fixture "$literal"
expect_path "$literal" "$empty" "$user_apps" "$system_apps" "$literal"
[[ ! -e SHOULD_NOT_EXIST ]]
expect_error '用法' "$root" "$user_apps" "$system_apps" one two
printf '{"pathSelectionTestsPassed":%s,"nativeMacSigningTested":false}\n' "$count"

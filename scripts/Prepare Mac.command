#!/bin/bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd -P)"
log="$(mktemp "$root/Prepare-Mac.log.XXXXXX" 2>/dev/null || mktemp "${TMPDIR:-/tmp}/WebToPrototype-prepare.log.XXXXXX")"
exec > >(/usr/bin/tee "$log") 2>&1
finish() {
  status=$?
  if [[ $status -ne 0 ]]; then printf '\n准备失败（退出码 %s）。没有完成签名校验，请保留此日志。\n' "$status"; fi
  printf '\n准备日志：%s\n' "$log"
  if [[ -t 0 ]]; then read -r -p '按回车关闭此窗口：' _ || true; fi
  exit "$status"
}
trap finish EXIT
printf 'WebToPrototype Mac 开发候选准备\n命令位置：%s\n' "$root"
if [[ "$(uname -s)" != Darwin ]]; then printf '此命令必须在 macOS 执行。\n' >&2; exit 1; fi
/usr/bin/sw_vers
source "$root/macos-tools/resolve-app.sh"
app="$(w2p_resolve_app "$root" "$HOME/Applications" /Applications "$@")"
printf '\n将准备以下应用：%s\n' "$app"
/bin/bash "$root/macos-tools/prepare-app.sh" "$app"
printf '\n签名完整性校验已通过；正在单独检查系统打开策略：\n'
if /usr/sbin/spctl --assess --type execute --verbose=2 "$app"; then
  printf '系统策略检查通过。应用功能仍需实际启动验证。\n'
else
  printf '系统策略尚未允许打开。此开发候选未经过 Apple 公证；签名完整不等于系统已允许打开。\n请按使用说明查看“隐私与安全性”中的单应用允许操作；若仍提示损坏，请提供本日志。\n'
fi
printf '准备步骤结束。请启动上方显示的同一个应用副本。\n'

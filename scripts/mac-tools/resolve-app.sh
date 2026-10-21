#!/bin/bash
# Path selection only; no signing or platform changes. Also used by shell tests.
w2p_resolve_app() {
  if [[ $# -lt 3 || $# -gt 4 ]]; then
    printf '用法：Prepare Mac.command [WebToPrototype.app的完整路径]\n' >&2
    return 1
  fi
  local root="$1" user_apps="$2" system_apps="$3" candidate found=''
  if [[ $# -eq 4 ]]; then
    candidate="$4"
  elif [[ -e "$root/WebToPrototype.app" ]]; then
    candidate="$root/WebToPrototype.app"
  else
    for candidate in "$user_apps/WebToPrototype.app" "$system_apps/WebToPrototype.app"; do
      if [[ -e "$candidate" ]]; then
        if [[ -n "$found" ]]; then
          printf '找到两个安装副本，未选择或签名。请通过终端指定要准备的.app完整路径。\n%s\n%s\n' "$found" "$candidate" >&2
          return 1
        fi
        found="$candidate"
      fi
    done
    if [[ -z "$found" ]]; then
      printf '未找到应用，未进行签名。检查过以下位置：\n%s\n%s\n%s\n请先完整解压ZIP；也可通过终端指定实际.app完整路径。\n' \
        "$root/WebToPrototype.app" "$user_apps/WebToPrototype.app" "$system_apps/WebToPrototype.app" >&2
      return 1
    fi
    candidate="$found"
  fi
  if [[ ! -d "$candidate/Contents" || ! -f "$candidate/Contents/Info.plist" ]]; then
    printf '应用目录不完整，未进行签名：%s\n缺少 Contents/Info.plist，请重新完整解压原ZIP。\n' "$candidate" >&2
    return 1
  fi
  # Resolve the containing directory without executing or interpreting the path.
  printf '%s/%s\n' "$(cd "$(dirname "$candidate")" && pwd -P)" "$(basename "$candidate")"
}

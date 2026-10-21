export function transferError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : '';
  if (/M_PAIR_EXPIRED/.test(message)) return '二维码已过期或已使用。请在电脑重新生成，再扫码连接。';
  if (/M_PAIR_REJECTED/.test(message)) return '电脑拒绝了连接。请重新生成二维码并在电脑点击“允许连接”。';
  if (/M_SESSION_REQUIRED/.test(message)) return '连接已结束，请重新扫码连接电脑。';
  if (/M_INBOX_FULL/.test(message)) return '电脑收件箱已满，请在电脑清理已接收的素材。';
  if (/M_UPLOAD_BUDGET/.test(message)) return '本次连接已达到发送上限，请重新扫码连接后继续。';
  if (/M_DIGEST_MISMATCH|M_PACKAGE_ID/.test(message)) return '电脑未能确认文件完整，请取消本次发送后重新选择画面。';
  if (/M_UPLOAD_BUSY/.test(message)) return '电脑正在处理上一批画面，请稍后重试发送。';
  if (/M_PAIR_RATE/.test(message)) return '连接尝试过多，请稍后在电脑重新生成二维码。';
  if (/M_LOCAL_NETWORK_DENIED|local network (?:access )?(?:denied|prohibited)/i.test(message))
    return '本地网络访问被拒绝。请在 iPhone“设置 → 隐私与安全性 → 本地网络”中允许 WebAppToFigma，再返回重新扫码。';
  if (/SSL|certificate|证书|NSURLErrorDomain[^\n]*-120[0-6]/i.test(message))
    return '与电脑的安全连接校验失败。请检查两端系统时间，并在电脑重新生成二维码后重试。';
  if (/M_RESPONSE_ID|M_RESPONSE_FORMAT|authenticationFailure/i.test(message))
    return '未能验证电脑的加密回复。请关闭当前连接，在电脑重新生成二维码后重试。';
  if (/timed? ?out|abort/i.test(message))
    return '连接电脑超时。请保持电脑接收窗口打开，并在出现连接请求时点击“允许连接”；若仍超时，请检查电脑防火墙。';
  if (/M_CONNECTION|Network|fetch|Unable to|connect|permission/i.test(message))
    return '无法连接电脑。请确认两端在同一 Wi-Fi、电脑接收窗口仍打开，并检查电脑防火墙后重新扫码。';
  const code = message.match(/\bM_[A-Z_]+\b/)?.[0];
  if (code) return `电脑连接未完成（${code}）。请在电脑重新生成二维码后重试。`;
  return message || '发送未完成，请重试。';
}

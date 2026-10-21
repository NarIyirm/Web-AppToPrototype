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
  if (/M_|Network|fetch|timed? ?out|abort|Unable to|SSL|connect|permission/i.test(message))
    return '无法连接电脑。请确认手机与电脑在同一 Wi-Fi，允许本地网络访问，并在电脑重新生成二维码后重试。';
  return message || '发送未完成，请重试。';
}

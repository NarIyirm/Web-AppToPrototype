import assert from 'node:assert/strict';
import test from 'node:test';
import { transferError } from '../src/core/transfer-error.ts';

test('network, TLS and timeout failures do not claim local network permission was denied', () => {
  for (const message of ['Network request failed', 'fetch failed', 'M_CONNECTION', 'Unable to connect', 'permission unknown']) {
    assert.match(transferError(Error(message)), /无法连接电脑/);
    assert.doesNotMatch(transferError(Error(message)), /本地网络|设置/);
  }
  assert.match(transferError(Error('SSL certificate validation failed')), /安全连接校验失败/);
  assert.match(transferError(Error('NSURLErrorDomain Code=-1202')), /安全连接校验失败/);
  for (const message of ['timed out', 'timeout', 'AbortError']) assert.match(transferError(Error(message)), /超时/);
  assert.match(transferError(Error('Local network prohibited')), /本地网络访问被拒绝/);
});

test('pairing decisions and authenticated response errors retain actionable, bounded messages', () => {
  assert.match(transferError(Error('M_PAIR_EXPIRED')), /二维码已过期/);
  assert.match(transferError(Error('M_PAIR_REJECTED')), /电脑拒绝/);
  assert.match(transferError(Error('M_SESSION_REQUIRED')), /连接已结束/);
  for (const message of ['M_RESPONSE_ID', 'M_RESPONSE_FORMAT', 'CryptoKitError.authenticationFailure']) {
    assert.match(transferError(Error(message)), /未能验证电脑的加密回复/);
  }
  assert.equal(transferError(Error('M_ROUTE ' + 'secret'.repeat(100))), '电脑连接未完成（M_ROUTE）。请在电脑重新生成二维码后重试。');
  assert.equal(transferError(undefined), '发送未完成，请重试。');
});

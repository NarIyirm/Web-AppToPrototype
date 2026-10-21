/** A self-contained fixture with no network, user cookies or permissions. */
export function createWebFixture(epoch: string): string {
  if (!/^[a-zA-Z0-9:_-]{1,128}$/.test(epoch)) throw new Error('Invalid probe epoch');
  return `<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'none'; base-uri 'none'">
<style>body{margin:16px;color:#111;background:#fff;font:16px system-ui}h1{font-size:22px}
button,a{display:block;min-height:48px;margin:8px 0}img{width:32px;height:32px;image-rendering:pixelated}
#target{box-sizing:border-box;width:180px;min-height:48px;padding:12px;background:#eef3ff}</style>
</head><body><h1>网页能力测试</h1><div id="target">标题 Hello 123</div>
<img id="asset" alt="内嵌测试图片" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=">
<button onclick="reportProbe()">重新读取坐标</button>
<button onclick="window.ReactNativeWebView.postMessage(JSON.stringify({kind:'request_screen_capture'}))">发送无效消息</button>
<a href="https://example.invalid/blocked">尝试外部跳转</a>
<script>
window.reportProbe=function(){
 var target=document.getElementById('target');var box=target.getBoundingClientRect();
 var image=document.getElementById('asset');
 window.ReactNativeWebView.postMessage(JSON.stringify({kind:'web_probe',epoch:${JSON.stringify(epoch)},
 viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
 target:{x:box.x,y:box.y,width:box.width,height:box.height},text:target.textContent,
 image:{width:image.naturalWidth,height:image.naturalHeight,loaded:image.complete&&image.naturalWidth>0}}));
};
window.addEventListener('load',function(){reportProbe()});
</script></body></html>`;
}

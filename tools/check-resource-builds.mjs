import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const assets=[...['player','ma-sandao','su-wantang','lu-guanlan','shen-yanqiu','gu-qinghe','ning-buping','qiao-wu','yue-hansheng'].map(id=>`portraits/${id}.svg`),...['road','gate','inn','clinic','dock','saltstore','temple','yamen'].map(id=>`scenes/${id}.svg`)];
for(const [folder,base] of [['dist-desktop','/'],['dist-pages-preview','/qingshi-jianghu/'],['dist/client','/']]) {
 const root=resolve(folder);
 for(const asset of assets) assert.ok(existsSync(resolve(root,asset)),`${folder} 缺 ${asset}`);
 if(folder==='dist/client') {console.log('Web产物：17份立绘及场景完整。');continue;}
 const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!path.startsWith(base)){res.writeHead(404);res.end();return;}
  const relative=path.slice(base.length)||'index.desktop.html',file=resolve(root,relative);
  if(!file.startsWith(root)||!existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',extname(file)==='.svg'?'image/svg+xml':extname(file)==='.js'?'text/javascript':'text/html');res.end(readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  const origin=`http://127.0.0.1:${server.address().port}`;
  const page=await fetch(origin+base);assert.equal(page.status,200);
  const html=await page.text(),entry=html.match(/<script[^>]*src="([^"]+)"/)[1];
  assert.ok(entry.startsWith(base));const script=await fetch(origin+entry);assert.equal(script.status,200);
  if(base!=='/')assert.ok((await script.text()).includes('/qingshi-jianghu/'));
  for(const asset of assets){const response=await fetch(origin+base+asset);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/svg\+xml/);assert.match(await response.text(),/<svg/);}
  console.log(`${folder}：首页、脚本及17份SVG经HTTP核验通过（${base}）。`);
 } finally {await new Promise(r=>server.close(r));}
}
if(existsSync('.pages-portrait.svg')) {assert.match(readFileSync('.pages-portrait.svg','utf8'),/<svg/);console.log('公开Pages：下载到的差役立绘为有效SVG。');}

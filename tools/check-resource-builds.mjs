import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';

const sceneAssets = [
  ...['player', 'ma-sandao', 'su-wantang', 'lu-guanlan', 'shen-yanqiu', 'gu-qinghe', 'ning-buping', 'qiao-wu', 'yue-hansheng'].map(id => `portraits/${id}.svg`),
  ...['road', 'gate', 'inn', 'clinic', 'dock', 'saltstore', 'temple', 'yamen'].map(id => `scenes/${id}.svg`),
];
const installAssets = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'apple-touch-icon.png'];
const manifestShape = (root) => {
  const value = JSON.parse(readFileSync(resolve(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(value.name, '青石江湖');
  assert.equal(value.display, 'standalone');
  assert.equal(value.start_url, './');
  assert.equal(value.scope, './');
  assert.ok(value.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(value.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable'));
  return value;
};

for (const [folder, base] of [['dist-desktop', '/'], ['dist-pages-preview', '/qingshi-jianghu/'], ['dist/client', '/']]) {
  const root = resolve(folder);
  for (const asset of [...sceneAssets, ...installAssets]) assert.ok(existsSync(resolve(root, asset)), `${folder} 缺 ${asset}`);
  const manifest = manifestShape(root);
  if (folder === 'dist/client') {
    console.log('Web产物：17份立绘及场景、Manifest与安装图标完整。');
    continue;
  }
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith(base)) { response.writeHead(404); response.end(); return; }
    const relative = pathname.slice(base.length) || 'index.desktop.html';
    const file = resolve(root, relative);
    if (!file.startsWith(root) || !existsSync(file)) { response.writeHead(404); response.end(); return; }
    const extension = extname(file);
    const contentType = extension === '.svg' ? 'image/svg+xml'
      : extension === '.png' ? 'image/png'
        : extension === '.js' ? 'text/javascript'
          : extension === '.webmanifest' ? 'application/manifest+json'
            : 'text/html';
    response.setHeader('Content-Type', contentType);
    response.end(readFileSync(file));
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(origin + base);
    assert.equal(page.status, 200);
    const html = await page.text();
    const entry = html.match(/<script[^>]*src="([^"]+)"/)?.[1];
    const manifestHref = html.match(/<link[^>]*rel="manifest"[^>]*href="([^"]+)"/)?.[1];
    const appleHref = html.match(/<link[^>]*rel="apple-touch-icon"[^>]*href="([^"]+)"/)?.[1];
    assert.ok(entry && manifestHref && appleHref, `${folder} 缺入口脚本、Manifest或apple-touch-icon链接`);
    assert.ok(entry.startsWith(base));
    assert.equal(new URL(manifestHref, origin + base).pathname, `${base}manifest.webmanifest`);
    assert.equal(new URL(appleHref, origin + base).pathname, `${base}apple-touch-icon.png`);
    const script = await fetch(origin + entry);
    assert.equal(script.status, 200);
    if (base !== '/') assert.ok((await script.text()).includes('/qingshi-jianghu/'));
    const manifestUrl = new URL(manifestHref, origin + base);
    const manifestResponse = await fetch(manifestUrl);
    assert.equal(manifestResponse.status, 200);
    assert.match(manifestResponse.headers.get('content-type'), /application\/manifest\+json/);
    for (const icon of manifest.icons) {
      const iconUrl = new URL(icon.src, manifestUrl);
      assert.ok(iconUrl.pathname.startsWith(base));
      const response = await fetch(iconUrl);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /image\/png/);
    }
    for (const asset of sceneAssets) {
      const response = await fetch(origin + base + asset);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /image\/svg\+xml/);
      assert.match(await response.text(), /<svg/);
    }
    console.log(`${folder}：首页、脚本、Manifest、安装图标及17份SVG经HTTP核验通过（${base}）。`);
  } finally {
    await new Promise(resolveClose => server.close(resolveClose));
  }
}

if (existsSync('.pages-portrait.svg')) {
  assert.match(readFileSync('.pages-portrait.svg', 'utf8'), /<svg/);
  console.log('公开Pages：下载到的差役立绘为有效SVG。');
}

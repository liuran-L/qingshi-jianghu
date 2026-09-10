import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import {
  canRequestNativeInstall,
  installGuidance,
  isStandaloneDisplay,
  requestNativeInstall,
  shouldShowInstallEntry,
  standaloneStorageNotice,
} from '../lib/ui/install-entry.ts';
import { SAVE_KEY } from '../lib/game/storage.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url));
const text = (path: string) => read(path).toString('utf8');
const manifest = JSON.parse(text('public/manifest.webmanifest')) as {
  id: string; name: string; short_name: string; start_url: string; scope: string; display: string;
  background_color: string; theme_color: string; icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
};

function pngDimensions(path: string): [number, number] {
  const bytes = read(path);
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

void test('P0-8 Manifest 提供名称、独立窗口、主题与相对作用域，不登记 Service Worker', () => {
  assert.equal(manifest.name, '青石江湖');
  assert.equal(manifest.short_name, '青石江湖');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  assert.equal('serviceworker' in manifest || 'service_worker' in manifest, false);
  const sources = [text('app/layout.tsx'), text('app/page.tsx'), text('index.desktop.html'), text('public/manifest.webmanifest')].join('\n');
  assert.doesNotMatch(sources, /serviceWorker\.register|navigator\.serviceWorker/);
});

void test('P0-8 Android、maskable 与 iOS 图标尺寸正确且页面 metadata 完整', () => {
  const expected = new Map<string, readonly [number, number]>([
    ['icons/icon-192.png', [192, 192]],
    ['icons/icon-512.png', [512, 512]],
    ['icons/icon-maskable-512.png', [512, 512]],
  ] as const);
  for (const icon of manifest.icons) {
    assert.ok(expected.has(icon.src));
    assert.equal(icon.type, 'image/png');
    assert.deepEqual(pngDimensions(`public/${icon.src}`), expected.get(icon.src)!);
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  assert.deepEqual(pngDimensions('public/apple-touch-icon.png'), [180, 180]);
  const layout = text('app/layout.tsx');
  assert.match(layout, /manifest:\s*['"]\/manifest\.webmanifest/);
  assert.match(layout, /appleWebApp:[\s\S]*capable:\s*true[\s\S]*title:\s*['"]青石江湖/);
  assert.match(layout, /apple-mobile-web-app-capable['"]?:\s*['"]yes/);
  assert.match(layout, /apple-touch-icon\.png/);
});

void test('P0-8 桌面与 Pages HTML 使用 BASE_URL，Manifest 内部相对路径可同时落在根路径和项目子路径', () => {
  const html = text('index.desktop.html');
  assert.match(html, /href="%BASE_URL%manifest\.webmanifest"/);
  assert.match(html, /href="%BASE_URL%apple-touch-icon\.png"/);
  for (const base of ['https://example.com/', 'https://example.com/qingshi-jianghu/']) {
    const manifestUrl = new URL('manifest.webmanifest', base);
    assert.equal(new URL(manifest.start_url, manifestUrl).pathname, new URL(base).pathname);
    assert.equal(new URL(manifest.scope, manifestUrl).pathname, new URL(base).pathname);
    for (const icon of manifest.icons) assert.ok(new URL(icon.src, manifestUrl).pathname.startsWith(new URL(base).pathname));
  }
  assert.match(text('vite.desktop.config.ts'), /GITHUB_ACTIONS\s*\?\s*['"]\/qingshi-jianghu\/['"]\s*:\s*['"]\/['"]/);
  assert.ok(existsSync(new URL('../.github/workflows/deploy-pages.yml', import.meta.url)));
});

void test('P0-8 主屏入口未读到存档时先提示可能的存储隔离，不改变既有存档键', () => {
  assert.equal(isStandaloneDisplay(true, false), true);
  assert.equal(isStandaloneDisplay(false, true), true);
  assert.equal(isStandaloneDisplay(false, false), false);
  assert.match(standaloneStorageNotice(true, false)!, /浏览器里已有进度[\s\S]*存储分开[\s\S]*不要在这里新建/);
  assert.equal(standaloneStorageNotice(false, false), null);
  assert.equal(standaloneStorageNotice(true, true), null);
  assert.equal(SAVE_KEY, 'qingshi-jianghu-save-v5:auto');
});

void test('主屏独立窗口隐藏添加入口', () => {
  assert.equal(shouldShowInstallEntry(true), false);
  assert.equal(shouldShowInstallEntry(false), true);
  assert.match(text('app/page.tsx'), /shouldShowInstallEntry\(standaloneEntry\)/);
});

void test('Android 提供安装事件时调用浏览器原生确认', async () => {
  let promptCalls = 0;
  const outcome = await requestNativeInstall({
    prompt: async () => { promptCalls += 1; },
    userChoice: Promise.resolve({ outcome: 'dismissed' }),
  });
  assert.equal(promptCalls, 1);
  assert.equal(outcome, 'dismissed');
  assert.equal(canRequestNativeInstall('Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile'), true);
  assert.equal(canRequestNativeInstall('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/140'), true);
  const page = text('app/page.tsx');
  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /requestNativeInstall\(nativeInstallPrompt\)/);
});

void test('Android 没有安装事件时提供非空菜单指引', () => {
  const guidance = installGuidance('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140 Mobile Safari/537.36');
  assert.match(guidance, /浏览器菜单/);
  assert.match(guidance, /添加到桌面／添加到主屏幕／安装应用/);
});

void test('微信与 iPhone/iPad 使用各自的安全指引', () => {
  assert.equal(canRequestNativeInstall('Mozilla/5.0 (Linux; Android 14) MicroMessenger/8.0'), false);
  assert.equal(canRequestNativeInstall('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile Safari/604.1'), false);
  assert.equal(installGuidance('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) MicroMessenger/8.0'), '请点击右上角‘⋯’，选择在浏览器打开后，再添加到主屏幕。');
  assert.equal(installGuidance('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Mobile Safari/604.1'), '点击分享按钮，再选择‘添加到主屏幕’。');
  assert.equal(installGuidance('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Mobile/15E148 Safari/604.1'), '点击分享按钮，再选择‘添加到主屏幕’。');
});

void test('QQ 浏览器与夸克使用通用菜单降级提示', () => {
  for (const [userAgent, browser] of [
    ['Mozilla/5.0 (Linux; Android 14) MQQBrowser/14.9 Mobile', 'QQ 浏览器'],
    ['Mozilla/5.0 (Linux; Android 14) Quark/7.5 Mobile', '夸克'],
  ]) {
    const guidance = installGuidance(userAgent);
    assert.match(guidance, new RegExp(browser));
    assert.match(guidance, /浏览器菜单/);
    assert.match(guidance, /添加到桌面／添加到主屏幕／安装应用/);
    assert.match(guidance, /系统设置[\s\S]*创建桌面快捷方式/);
  }
});

void test('手机浏览器在应用代码加载前派发安装事件仍可被接管', () => {
  const html = text('index.desktop.html');
  assert.ok(html.indexOf('beforeinstallprompt') < html.indexOf('rel="manifest"'));
  assert.match(html, /__qingshiInstallPrompt/);
  assert.match(html, /qingshi-installprompt-ready/);
  const page = text('app/page.tsx');
  assert.match(page, /installWindow\.__qingshiInstallPrompt/);
  assert.match(page, /qingshi-installprompt-ready/);
});

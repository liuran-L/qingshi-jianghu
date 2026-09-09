import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = { themeColor: '#17231c' };

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  applicationName: '青石江湖',
  title: '青石江湖｜AI 武侠文字游戏',
  description: '一座县城，八名江湖人，一句话也可能招来杀身之祸。',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: '青石江湖',
    statusBarStyle: 'black-translucent',
  },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  openGraph: {
    title: '青石江湖｜AI 武侠文字游戏',
    description: '一座县城，八名江湖人，一句话也可能招来杀身之祸。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '暮雨中的青石县城门' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '青石江湖｜AI 武侠文字游戏',
    description: '一座县城，八名江湖人，一句话也可能招来杀身之祸。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

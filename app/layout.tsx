import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: '青石江湖｜AI 武侠文字游戏',
  description: '一座县城，八名江湖人，一句话也可能招来杀身之祸。',
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

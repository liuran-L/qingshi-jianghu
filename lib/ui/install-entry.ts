/** Android display-mode 与 iOS Safari 的主屏入口识别保持为纯显示逻辑。 */
export function isStandaloneDisplay(displayModeMatches: boolean, iosStandalone?: boolean): boolean {
  return displayModeMatches || iosStandalone === true;
}

/** 主屏入口没有读到存档时必须先说明平台可能隔离存储，避免被误认为存档消失。 */
export function standaloneStorageNotice(standalone: boolean, hasSave: boolean): string | null {
  if (!standalone || hasSave) return null;
  return '主屏入口目前没有找到存档。若你在浏览器里已有进度，系统可能把主屏入口与浏览器存储分开；请先回到原浏览器继续，不要在这里新建旅程。若这是首次游玩，可以正常开始。';
}

export interface NativeInstallPrompt {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export function shouldShowInstallEntry(standalone: boolean): boolean {
  return !standalone;
}

export async function requestNativeInstall(event: NativeInstallPrompt): Promise<string> {
  await event.prompt();
  return (await event.userChoice).outcome;
}

export function canRequestNativeInstall(userAgent: string): boolean {
  return /Android/i.test(userAgent) && !/MicroMessenger/i.test(userAgent);
}

const menuOptions = '“添加到桌面／添加到主屏幕／安装应用”';

export function installGuidance(userAgent: string): string {
  if (/MicroMessenger/i.test(userAgent)) {
    return '请点击右上角‘⋯’，选择在浏览器打开后，再添加到主屏幕。';
  }
  if (/(iPhone|iPad|iPod)/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))) {
    return '点击分享按钮，再选择‘添加到主屏幕’。';
  }
  if (/MQQBrowser|QQ\//i.test(userAgent)) {
    return `QQ 浏览器未提供一键安装时，请在浏览器菜单中寻找${menuOptions}。`;
  }
  if (/Quark/i.test(userAgent)) {
    return `夸克未提供一键安装时，请在浏览器菜单中寻找${menuOptions}。`;
  }
  if (/HuaweiBrowser|VivoBrowser|HeyTapBrowser|OppoBrowser|MiuiBrowser|SamsungBrowser/i.test(userAgent)) {
    return `请在手机浏览器菜单中寻找${menuOptions}；不同版本支持方式可能不同。`;
  }
  return `当前浏览器未提供一键安装，请在浏览器菜单中寻找${menuOptions}。`;
}

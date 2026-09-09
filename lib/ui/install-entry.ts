/** Android display-mode 与 iOS Safari 的主屏入口识别保持为纯显示逻辑。 */
export function isStandaloneDisplay(displayModeMatches: boolean, iosStandalone?: boolean): boolean {
  return displayModeMatches || iosStandalone === true;
}

/** 主屏入口没有读到存档时必须先说明平台可能隔离存储，避免被误认为存档消失。 */
export function standaloneStorageNotice(standalone: boolean, hasSave: boolean): string | null {
  if (!standalone || hasSave) return null;
  return '主屏入口目前没有找到存档。若你在浏览器里已有进度，系统可能把主屏入口与浏览器存储分开；请先回到原浏览器继续，不要在这里新建旅程。若这是首次游玩，可以正常开始。';
}

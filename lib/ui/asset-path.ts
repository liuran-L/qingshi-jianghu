/** 根站点、桌面与项目子路径共用；资源不依赖当前场景路由。 */
export function assetPath(path: string, base = (import.meta as ImportMeta & {env?: {BASE_URL?: string}}).env?.BASE_URL ?? '/') {
 return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

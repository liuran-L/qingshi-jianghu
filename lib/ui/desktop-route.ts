import { assetPath } from './asset-path.ts';
/** 项目站使用片段导航，刷新不请求不存在的 /map 文件，也不跳离项目目录。 */
export function navigationPath(route:string,base?:string) {
 const root=assetPath('',base);
 return root==='/'?route:`${root}#${route}`;
}
export function currentRoute(pathname:string,hash:string) {return hash.startsWith('#/')?hash.slice(1):pathname;}

import { evidenceNames } from '../game/campaign-content.ts';
import type { DialogueLine } from '../game/types.ts';
const labels:Record<string,string>={...evidenceNames,baggage:'行囊残片',clinic:'医馆验伤',gate:'城门观察',recollection:'荒道回忆',roster:'商旅名册',player:'你',shen:'医者',ma:'差役',broker:'中人',yamen:'县衙',unknown:'尚未确认',pending:'尚待发生',unloading:'正在转运',sealed:'已经封存',departed:'已经离开'};
const pattern=new RegExp(`\\b(?:${Object.keys(labels).join('|')})\\b`,'g');
/** 修复旧档表达残留，不重写存档正文或内部标识。 */
export function playerText(text:string) {
 return text.replace(pattern,token=>labels[token]).replace(/\b(?:undefined|null|NaN)\b/g,'尚未确认');
}
export function visibleLine(line:DialogueLine|undefined) {return line?{...line,text:playerText(line.text)}:undefined;}

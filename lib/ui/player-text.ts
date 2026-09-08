import { coreNames, evidenceNames } from '../game/campaign-content.ts';
import { getNpc } from '../game/world.ts';
import type { DialogueLine, GameState } from '../game/types.ts';
const labels:Record<string,string>={...evidenceNames,baggage:'行囊残片',clinic:'医馆验伤',gate:'城门观察',recollection:'荒道回忆',roster:'商旅名册',player:'你',shen:'医者',ma:'差役',broker:'中人',yamen:'县衙',unknown:'尚未确认',pending:'尚待发生',unloading:'正在转运',sealed:'已经封存',departed:'已经离开'};
const pattern=new RegExp(`\\b(?:${Object.keys(labels).join('|')})\\b`,'g');
/** 修复旧档表达残留，不重写存档正文或内部标识。 */
export function playerText(text:string,state?:GameState) {
 let visible=text.replace(pattern,token=>labels[token]).replace(/\b(?:undefined|null|NaN)\b/g,'尚未确认');
 if(state) for(const [npcId,canonical] of Object.entries(coreNames)) {
  const knowledge=state.npcKnowledge[npcId];
  const knowsUnmatchedName=npcId==='ning-buping'&&state.playerKnownFactIds.includes('ning-referral');
  const display=knowledge?.matched&&knowledge.knownName?knowledge.knownName:knowsUnmatchedName?canonical:getNpc(npcId).observedLabel;
  visible=visible.replaceAll(canonical,display);
 }
 return visible;
}
export function visibleLine(line:DialogueLine|undefined,state?:GameState) {
 if(!line)return undefined;
 const npcId=line.portraitId&&line.portraitId!=='player'?line.portraitId:Object.entries(coreNames).find(([,name])=>name===line.speaker)?.[0];
 if(!npcId||!state)return {...line,text:playerText(line.text,state)};
 const knowledge=state.npcKnowledge[npcId];
 const speaker=knowledge?.matched&&knowledge.knownName?knowledge.knownName:getNpc(npcId).observedLabel;
 const text=knowledge?.matched?playerText(line.text,state):playerText(line.text,state).replaceAll(coreNames[npcId],speaker);
 return {...line,speaker,text};
}

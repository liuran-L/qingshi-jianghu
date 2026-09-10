import type { GameState } from '../game/types.ts';
import type { LimitedAction } from '../game/limited-actions.ts';
import { inventoryItems } from '../game/world.ts';
import { evidenceNames, storyEvents } from '../game/campaign-content.ts';
export function inventoryView(s:GameState,actions:LimitedAction[]) {
 const frozen=!s.player.alive||s.gatePhase==='detained'||!!s.campaign.ending||!!s.prologueEnding;
 const uses:Record<string,{where:string;source:string;ids:string[]}>= {
 'ding17-fragment':{source:'从行囊夹层摸出的沾血残纸，原主人没有留下姓名。',where:'可给客栈掌柜看，也可送县衙交存；渡口中人只在递来纸条后收它。',ids:['show-fragment','report-salt-case','seal-salt-evidence','transfer-fragment']},
 'blood-cloth':{source:'处理伤口后由你自行收回的旧布条。',where:'可带回回春堂，请沈砚秋补验残血。',ids:['return-cloth']},
 'temporary-stay-permit':{source:'县衙封案后签发。',where:'三日暂留凭条不是永久路引，不可重复领取；期限以案卷记载为准。',ids:[]},
 'evidence-receipt':{source:'县衙收下残片、病案等物后开给你的收据。',where:'可凭它查明交存物与经手人；原物已经留在县衙。',ids:[]},
 };
 const old=inventoryItems.filter(i=>s.inventoryItemIds.includes(i.id)).map(i=>({id:i.id,name:i.name,detail:i.description,...uses[i.id]}));
 const records=s.campaign.evidence.map(id=>{
  const source=Object.entries(s.campaign.resolved).filter(([,r])=>r.witnessed&&r.choice!=='missed').map(([eid,r])=>({event:storyEvents.find(e=>e.id===eid)!,choice:r.choice})).filter(x=>x.event.choices.find(c=>c.id===x.choice)?.effect.evidence?.includes(id)).map(x=>x.event.title);
  const event=storyEvents.find(e=>e.id===s.campaign.activeEvent);
  return {id,name:evidenceNames[id],detail:'这份材料仍在你手里。纸上写到哪里，便只能追到哪里。',source:source.length?`取自：${source.join('、')}。`:'来处记在先前的交接日志里。',where:'遇到查账、作证或对质时可以出示；若曾遗失，便不再列在这里。',ids:[...(event?.choices.filter(c=>c.need?.evidence===id).map(c=>`journey-choose:${event.id}:${c.id}`)??[]),...(['official','transport','medicine'].includes(id)?['journey-end:xia:proof',...(id==='official'?['journey-end:office:trial']:[])]:[])]};
 });
 return [...old,...records].map(item=>({...item,actions:frozen?[]:actions.filter(a=>item.ids.includes(a.id)),status:frozen?'这一程已停在此处，只可查看。':item.ids.some(id=>actions.some(a=>a.id===id))?'眼前正有用得上它的地方。':'眼下没有人接收或查验此物，它仍好好收在行囊里。'}));
}
export function nextStep(s:GameState,actions:LimitedAction[]) {
 if(!s.player.alive||s.campaign.ending) return '这一程已经结束。可保存、回看或读取此前的记录。';
 if(s.gatePhase==='detained') return actions.some(a=>a.id==='request-review')?'目前被扣留。可请求复核原话与证物；尚不能自由出城。':'目前不能自由行动，可保存并回看记录。';
 if(s.prologueEnding) return '案卷暂结。可保存这一页，或从下方继续盐路风云。';
 if(s.campaign.activeEvent) return '读完眼前的话，再作取舍。若现在离开，这处现场不会等你。';
 if(s.campaign.startedAt!==null) return '先看眼前的来信与动静；无信时仍可谋生、疗伤，或打听先前错过的事。';
 if(s.player.injury!=='无') return s.knownLocationIds.includes('clinic')?'伤口仍需处理。获准通行后，可由地图前往回春堂；授权与费用由你决定。':'伤口仍在渗血。可向眼前人问医馆去处，也可先说明来历办理入城。';
 return '可向眼前人问路或消息，再从地图选择已知去处；随身纸物的用途可在背包查看。';
}

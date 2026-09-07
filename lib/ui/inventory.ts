import type { GameState } from '../game/types.ts';
import type { LimitedAction } from '../game/limited-actions.ts';
import { inventoryItems } from '../game/world.ts';
import { evidenceNames, storyEvents } from '../game/campaign-content.ts';
export function inventoryView(s:GameState,actions:LimitedAction[]) {
 const frozen=!s.player.alive||s.gatePhase==='detained'||!!s.campaign.ending||!!s.prologueEnding;
 const uses:Record<string,{where:string;source:string;ids:string[]}>= {
 'ding17-fragment':{source:'检查行囊夹层时发现；只说明你如何得到，不证明原主人身份。',where:'可在客栈出示，或在县衙办理交存；渡口交易须先有实际口信。',ids:['show-fragment','report-salt-case','seal-salt-evidence','transfer-fragment']},
 'blood-cloth':{source:'处理伤口后由你自行保留的布条。',where:'到回春堂重新授权留样；医者未收到前不能拿它出具结论。',ids:['return-cloth']},
 'temporary-stay-permit':{source:'县衙封案后签发。',where:'三日暂留凭条不是永久路引，不可重复领取；期限以案卷记载为准。',ids:[]},
 'evidence-receipt':{source:'向县衙实际交存证物所得。',where:'用于确认已交存，不代表原证物仍在行囊，也不直接证明幕后全案。',ids:[]},
 };
 const old=inventoryItems.filter(i=>s.inventoryItemIds.includes(i.id)).map(i=>({id:i.id,name:i.name,detail:i.description,...uses[i.id]}));
 const records=s.campaign.evidence.map(id=>{
  const source=Object.entries(s.campaign.resolved).filter(([,r])=>r.witnessed&&r.choice!=='missed').map(([eid,r])=>({event:storyEvents.find(e=>e.id===eid)!,choice:r.choice})).filter(x=>x.event.choices.find(c=>c.id===x.choice)?.effect.evidence?.includes(id)).map(x=>x.event.title);
  const event=storyEvents.find(e=>e.id===s.campaign.activeEvent);
  return {id,name:evidenceNames[id],detail:'你当前实际持有的材料；仍须与其他来源核对，不能单凭它指认全部责任。',source:source.length?`来自已经历的：${source.join('、')}。`:'来自已记录的材料交接；详见日志。',where:'在需要此材料的当前事件中出示；案卷清算按实际留存核验。',ids:[...(event?.choices.filter(c=>c.need?.evidence===id).map(c=>`journey-choose:${event.id}:${c.id}`)??[]),...(['official','transport','medicine'].includes(id)?['journey-end:xia:proof',...(id==='official'?['journey-end:office:trial']:[])]:[])]};
 });
 return [...old,...records].map(item=>({...item,actions:frozen?[]:actions.filter(a=>item.ids.includes(a.id)),status:frozen?'此页已冻结，只能查看。':item.ids.some(id=>actions.some(a=>a.id===id))?'眼前已有可办理的用途；确认后按原规则结算。':'当前没有符合地点、授权和前置的使用机会；不会因此消耗或复制物品。'}));
}
export function nextStep(s:GameState,actions:LimitedAction[]) {
 if(!s.player.alive||s.campaign.ending) return '此页已定稿。可保存、回看或读取生前的记录。';
 if(s.gatePhase==='detained') return actions.some(a=>a.id==='request-review')?'目前被扣留。可请求复核原话与证物；尚不能自由出城。':'目前不能自由行动，可保存并回看记录。';
 if(s.prologueEnding) return '案卷暂结。可保存这一页，或从下方继续盐路风云。';
 if(s.campaign.activeEvent) return '读完眼前的话，再选一种承担；也可暂离，但现场机会不会等你。';
 if(s.campaign.startedAt!==null) return '眼前栏查看来信与候信；谋生可筹银，旧事可打听缺席消息。错过一封来信仍能继续生活。';
 if(s.player.injury!=='无') return s.knownLocationIds.includes('clinic')?'伤口仍需处理。获准通行后，可由地图前往回春堂；授权与费用由你决定。':'伤口仍在渗血。可向眼前人问医馆去处，也可先说明来历办理入城。';
 return '可向眼前人问路或消息，再从地图选择已知去处；随身纸物的用途可在背包查看。';
}

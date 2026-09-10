import type { GameState, KnownFactId } from '../game/types.ts';
import { clues, knownFacts, inventoryItems, locations, npcs, worldEvents } from '../game/world.ts';
import { evidenceNames, firstActPreludes, storyEvents } from '../game/campaign-content.ts';
import { relationshipStage } from './relationships.ts';

const factTitles: Record<KnownFactId, string> = {
 'cart-mark':'货车特征', 'cheng-identity':'死者身份核认', 'medical-report':'病案副本', 'cargo-schedule':'船车时刻',
 'ning-referral':'递交线索的门路', 'cart-verified':'转运车核验', 'ledger-verified':'簿册互证', 'sealed-case':'封存记录',
 'gate-selective-inspection':'城门盘查异状', 'guard-search-threat':'差役的警告', 'ma-public-bribe-caution':'人前避谈银钱',
 'ma-private-bribe-signal':'私下打点的暗示', 'ma-cart-deflection':'漕运关防的说辞', 'ma-ding17-reaction':'听见编号后的反应',
 'doctor-wound-residue':'创口残留物', 'clinic-corpse-details':'无名尸创口', 'corpse-wound-link':'伤口关联', 'inn-corpse-rumor':'客栈传闻',
 'baggage-watch-mark':'行囊上的新记号', 'inn-arrival-inquiry':'早到的问话者', 'day-end-watch-rumor':'换班脚夫的提醒', 'next-morning-moving-lead':'次日会变化的踪迹',
 'dock-salt-movement':'渡口船货动静', 'clinic-routine':'医馆记录边界', 'day2-public-notice':'盐路加验告示',
 'public-yamen-role':'县衙的公开职责', 'public-river-gang-role':'漕帮的公开位置', 'public-qingyue-role':'青岳门的公开身份',
 'act-one-surface-conflict':'三方表面冲突', 'act-one-involvement':'你被卷入的公开原因',
};
export interface KnowledgeEntry { id: string; title: string; detail: string }
export interface KnowledgeGroup { id: string; title: string; entries: KnowledgeEntry[] }
const hearsayFactIds = new Set<KnownFactId>(['inn-corpse-rumor', 'day-end-watch-rumor', 'next-morning-moving-lead', 'ma-public-bribe-caution', 'ma-private-bribe-signal', 'ma-cart-deflection']);

function journalQuestions(s: GameState): KnowledgeEntry[] {
 const entries: KnowledgeEntry[] = [];
 if (['baggage-watch-mark','inn-arrival-inquiry','day-end-watch-rumor','next-morning-moving-lead'].some(id=>s.playerKnownFactIds.includes(id as KnownFactId))) entries.push({id:'question-watcher',title:'谁在关注你的到来？',detail:'已知有人提前辨认带伤外乡客或行囊；留下记号的人、打听者及其目的仍待查证。'});
 if (s.knownClueIds.includes('attack-phrase') || s.playerKnownFactIds.includes('dock-salt-movement')) entries.push({id:'question-ding17',title:'“丁字十七”究竟牵到哪一段？',detail:'它已可与船货编号相联系，但荒道呼喊、残片来路和经手者之间仍缺少可核环节。'});
 if (s.playerKnownFactIds.includes('act-one-surface-conflict')) entries.push({id:'question-three-sides',title:'三方哪些说法对得上？',detail:'县衙守文书与城门，漕帮管船位与脚夫，青岳门因同门之事入城。谁在暗处使唤人，眼下还没有姓名。'});
 return entries;
}

/** 只投影玩家已获知的数据，绝不读取幕后摘要或 NPC 私有知识。 */
export function knowledgeGroups(s: GameState): KnowledgeGroup[] {
 const known = knownFacts.filter(x=>s.playerKnownFactIds.includes(x.id));
 const witnessedEvents = Object.entries(s.campaign.resolved).filter(([,result])=>result.witnessed).map(([id,result])=>({
   id:`event-${id}`, title:storyEvents.find(event=>event.id===id)?.title ?? id, detail:result.text,
 }));
 const scouted = firstActPreludes.filter(item=>s.campaign.journal.some(entry=>entry.action===`scout:${item.eventId}`)).map(item=>({id:`prelude-${item.eventId}`,title:`事前所见 · ${storyEvents.find(event=>event.id===item.eventId)!.title}`,detail:item.activeSource}));
 return [
  {id:'journal-facts',title:'见闻札记 · 亲见与取得',entries:[...clues.filter(x=>s.knownClueIds.includes(x.id)).map(x=>({id:x.id,title:x.title,detail:x.description})),...known.filter(x=>!hearsayFactIds.has(x.id)).map(x=>({id:x.id,title:factTitles[x.id],detail:x.text})),...scouted,...witnessedEvents.filter(entry=>s.campaign.resolved[entry.id.slice(6)]?.choice!=='missed')]},
  {id:'journal-hearsay',title:'见闻札记 · 他人说法',entries:[...known.filter(x=>hearsayFactIds.has(x.id)).map(x=>({id:x.id,title:factTitles[x.id],detail:x.text})),...witnessedEvents.filter(entry=>s.campaign.resolved[entry.id.slice(6)]?.choice==='missed')]},
  {id:'journal-questions',title:'见闻札记 · 待解疑问',entries:journalQuestions(s)},
  {id:'items',title:'随身物',entries:[...inventoryItems.filter(x=>s.inventoryItemIds.includes(x.id)).map(x=>({id:x.id,title:x.name,detail:x.description})),...s.campaign.evidence.map(id=>({id:`campaign-${id}`,title:evidenceNames[id],detail:'这份材料仍在你手里，来处与交接记在旧事中。'}))]},
  {id:'places',title:'地点',entries:locations.filter(x=>s.knownLocationIds.includes(x.id)).map(x=>({id:x.id,title:x.name,detail:x.id===s.locationId?'你眼下正在这里。':'这处已记在地图上，能否通行仍看眼前时辰与守门人。'}))},
  {id:'people',title:'人物',entries:npcs.filter(x=>s.npcKnowledge[x.id]?.observed).map(x=>{const k=s.npcKnowledge[x.id];return {id:x.id,title:k.matched&&k.knownName?k.knownName:x.observedLabel,detail:`${x.observation}${k.matched&&k.knownIdentity?` 已确认：${k.knownIdentity}`:''} 关系阶段：${relationshipStage(s,x.id)}。`}})},
  {id:'events',title:'世界事件',entries:worldEvents.filter(x=>s.knownWorldEventIds.includes(x.id)).map(x=>({id:x.id,title:x.title,detail:'你已亲见或从可信来处听说此事；细节记在相邻的见闻与旧事里。'}))},
 ];
}
export function knowledgeScope(s: GameState, revision: number, groups = knowledgeGroups(s)) {
 return JSON.stringify([revision,s.locationId,s.selectedNpcId,s.campaign.activeEvent,s.campaign.finale,groups]);
}
export function toggleDisclosure(current: string | null, id: string) { return current===id?null:id; }

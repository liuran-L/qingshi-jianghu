import type { GameState, KnownFactId } from '../game/types.ts';
import { clues, knownFacts, inventoryItems, locations, npcs, worldEvents } from '../game/world.ts';
import { evidenceNames } from '../game/campaign-content.ts';
import { relationshipStage } from './relationships.ts';

const factTitles: Record<KnownFactId, string> = {
 'cart-mark':'货车特征', 'cheng-identity':'死者身份核认', 'medical-report':'病案副本', 'cargo-schedule':'船车时刻',
 'ning-referral':'递交线索的门路', 'cart-verified':'转运车核验', 'ledger-verified':'簿册互证', 'sealed-case':'封存记录',
 'gate-selective-inspection':'城门盘查异状', 'guard-search-threat':'差役的警告', 'ma-public-bribe-caution':'人前避谈银钱',
 'ma-private-bribe-signal':'私下打点的暗示', 'ma-cart-deflection':'漕运关防的说辞', 'ma-ding17-reaction':'听见编号后的反应',
 'doctor-wound-residue':'创口残留物', 'clinic-corpse-details':'无名尸创口', 'corpse-wound-link':'伤口关联', 'inn-corpse-rumor':'客栈传闻',
 'baggage-watch-mark':'行囊上的新记号', 'inn-arrival-inquiry':'早到的问话者', 'day-end-watch-rumor':'换班脚夫的提醒', 'next-morning-moving-lead':'次日会变化的踪迹',
};
export interface KnowledgeEntry { id: string; title: string; detail: string }
export interface KnowledgeGroup { id: string; title: string; entries: KnowledgeEntry[] }
/** 只投影玩家已获知的数据，绝不读取幕后摘要或 NPC 私有知识。 */
export function knowledgeGroups(s: GameState): KnowledgeGroup[] {
 return [
  {id:'clues',title:'线索',entries:clues.filter(x=>s.knownClueIds.includes(x.id)).map(x=>({id:x.id,title:x.title,detail:x.description}))},
  {id:'facts',title:'已知事实',entries:knownFacts.filter(x=>s.playerKnownFactIds.includes(x.id)).map(x=>({id:x.id,title:factTitles[x.id],detail:x.text}))},
  {id:'items',title:'随身物',entries:[...inventoryItems.filter(x=>s.inventoryItemIds.includes(x.id)).map(x=>({id:x.id,title:x.name,detail:x.description})),...s.campaign.evidence.map(id=>({id:`campaign-${id}`,title:evidenceNames[id],detail:'当前持有的材料。内容以你实际取得时的记录为准。'}))]},
  {id:'places',title:'地点',entries:locations.filter(x=>s.knownLocationIds.includes(x.id)).map(x=>({id:x.id,title:x.name,detail:x.id===s.locationId?'你当前所在的地点。':'你已获知此处，可在地图查看当前通行条件。'}))},
  {id:'people',title:'人物',entries:npcs.filter(x=>s.npcKnowledge[x.id]?.observed).map(x=>{const k=s.npcKnowledge[x.id];return {id:x.id,title:k.matched&&k.knownName?k.knownName:x.observedLabel,detail:`${x.observation}${k.matched&&k.knownIdentity?` 已确认：${k.knownIdentity}`:''} 关系阶段：${relationshipStage(s,x.id)}。`}})},
  {id:'events',title:'世界事件',entries:worldEvents.filter(x=>s.knownWorldEventIds.includes(x.id)).map(x=>({id:x.id,title:x.title,detail:'此事件已进入你的见闻。更多情况以已知事实和江湖日志为准。'}))},
 ];
}
export function knowledgeScope(s: GameState, revision: number, groups = knowledgeGroups(s)) {
 return JSON.stringify([revision,s.locationId,s.selectedNpcId,s.campaign.activeEvent,s.campaign.finale,groups]);
}
export function toggleDisclosure(current: string | null, id: string) { return current===id?null:id; }

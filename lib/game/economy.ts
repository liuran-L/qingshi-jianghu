import type { EconomyState, GameState, InteractionRequest } from './types.ts';
import type { RuleResolution } from './interaction-rules.ts';
import { changeNpcRelationship } from './npc-memory.ts';

export const initialEconomy = (): EconomyState => ({ schema: 1, innWorkAt: null, innCredit: 0, cheapLodgingAt: null, medicalWorkAt: null, medicalCredit: 0, medicalDebt: 0, medicalDebtAt: null, transactions: [] });
const canTreat = (state: GameState) => state.player.injury !== '无' && state.dayOne.interview !== 'none' && state.dayOne.consent === 'exam' && ['retain', 'keep', 'doctor'].includes(state.dayOne.cloth);

export function resolveEconomy(state: GameState, request: InteractionRequest): RuleResolution | null {
  const e = state.economy;
  switch (request.actionId) {
    case 'cheap-rest': return { timeCostMinutes: 12 * 60, moneyDelta: -1, fatigueDelta: -30, lodgingRecord: true, narration: '你在伙房外的小隔间蜷了一夜，只避住风雨，仍睡得断断续续。掌柜在房簿另栏记下这一两的临时落脚。' };
    case 'inn-work': return { timeCostMinutes: 120, moneyDelta: 1, narration: '你劈柴、挑水，又擦净后院地砖。苏晚棠按约给你一两碎银，再递来一块可抵一晚房钱的工钱牌：“后院明日另有人做。”' };
    case 'medical-credit': return canTreat(state) && e.medicalDebt === 0 ? { timeCostMinutes: 35, discoveredClueIds: ['abnormal-wound'], discoveredFactIds: state.dayOne.cloth === 'keep' ? [] : ['doctor-wound-residue'], healthDelta: 15, fatigueDelta: -5, injuryAfter: '无', poisonAfter: '不明残毒', narration: '沈砚秋先在诊单记下三两欠账，再为你清创敷药。病案是否开作报案副本，仍要另问你的意思。' } : null;
    case 'basic-on-credit': return state.dayOne.consent === 'basic' && state.player.injury !== '无' && e.medicalDebt === 0 ? { timeCostMinutes: 15, narration: '沈砚秋先把三两止血诊金记为欠账，只暂缓' + (state.growth.medicine.nodes.includes('medicine-bandage') ? '二百四十' : '一百八十') + '分钟失血；未作药性检查，也没有治愈伤势。' } : null;
    case 'pharmacy-work': return state.player.injury !== '无' && e.medicalWorkAt === null && e.medicalDebt === 0 ? { timeCostMinutes: 90, narration: '你照药柜签子分拣干药、洗净器皿。沈砚秋在诊单上记下两两抵扣，没有另发银钱。' } : null;
    case 'treat-with-credit': return canTreat(state) && e.medicalCredit === 2 && state.player.money >= 1 ? { timeCostMinutes: 35, moneyDelta: -1, discoveredClueIds: ['abnormal-wound'], discoveredFactIds: state.dayOne.cloth === 'keep' ? [] : ['doctor-wound-residue'], healthDelta: 15, fatigueDelta: -5, injuryAfter: '无', poisonAfter: '不明残毒', narration: '杂活抵去两两，你再付一两。沈砚秋清创敷药，在诊单上划去那块工钱牌。' } : null;
    case 'settle-medical-debt': return e.medicalDebt === 3 && state.player.money >= 3 ? { timeCostMinutes: 5, moneyDelta: -3, narration: '你补清三两诊金。沈砚秋在旧诊单上划去欠账，把纸页收回匣中。' } : null;
    default: return null;
  }
}

export function applyEconomy(state: GameState, request: InteractionRequest): GameState {
  const id = request.actionId;
  if (id === 'rest-night' && state.economy.innCredit === 2) return { ...state, economy: { ...state.economy, innCredit: 0 } };
  if (!['inn-work', 'cheap-rest', 'medical-credit', 'basic-on-credit', 'pharmacy-work', 'treat-with-credit', 'settle-medical-debt'].includes(id)) return state;
  if (state.economy.transactions.some((t) => t.id === id)) return state;
  const e = { ...state.economy, transactions: [...state.economy.transactions] };
  const record = (moneyDelta: number, debtDelta: number, creditDelta: number) => e.transactions.push({ id: id as EconomyState['transactions'][number]['id'], atMinutes: state.worldMinutes, moneyDelta, debtDelta, creditDelta });
  let next = { ...state, economy: e };
  if (id === 'inn-work') { e.innWorkAt = state.worldMinutes; e.innCredit = 2; record(1, 0, 2); }
  if (id === 'cheap-rest') { e.cheapLodgingAt = state.worldMinutes; record(-1, 0, 0); }
  if (id === 'medical-credit' || id === 'basic-on-credit') { e.medicalDebt = 3; e.medicalDebtAt = state.worldMinutes; record(0, 3, 0); if (id === 'basic-on-credit') next = { ...next, dayOne: { ...next.dayOne, bleedingGraceMinutes: state.growth.medicine.nodes.includes('medicine-bandage') ? 240 : 180 } }; next = changeNpcRelationship(next, 'shen-yanqiu', `economy:${id}`, { favor: -3 }); }
  if (id === 'pharmacy-work') { e.medicalWorkAt = state.worldMinutes; e.medicalCredit = 2; record(0, 0, 2); }
  if (id === 'treat-with-credit') { e.medicalCredit = 0; record(-1, 0, -2); }
  if (id === 'settle-medical-debt') { e.medicalDebt = 0; e.medicalDebtAt = null; record(-3, -3, 0); next = changeNpcRelationship(next, 'shen-yanqiu', 'economy:settle-medical-debt', { favor: 3 }); }
  return next;
}

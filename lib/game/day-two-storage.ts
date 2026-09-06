import { initialDayTwo } from './day-two.ts';
import type { GameState } from './types.ts';

/** 第六阶段字段可由完整旧档升级；出现半截结构则拒绝，交由仓库备份回退。 */
export function decodeDayTwo(state: GameState | null): GameState | null {
  if (!state) return null;
  if (!Object.hasOwn(state, 'dayTwo')) return { ...state, dayTwo: initialDayTwo() };
  const d = state.dayTwo;
  if (!d || typeof d !== 'object' || d.schema !== 1 || !['none', 'night-ferry'].includes(d.departurePlan) || !['none', 'offered'].includes(d.brokerContact)) return null;
  if (!['menu', 'gateEchoSeen', 'innEchoSeen', 'clinicEchoSeen', 'luEchoSeen'].every((key) => typeof d[key as keyof typeof d] === 'boolean')) return null;
  if (state.prologueEnding && d.menu) return null;
  if (state.prologueEnding === 'night-ferry' && d.departurePlan !== 'night-ferry') return null;
  if (state.prologueEnding === 'fragment-transferred' && d.brokerContact !== 'offered') return null;
  if (d.brokerContact === 'offered' && (!state.inventoryItemIds.includes('ding17-fragment') || state.evidenceCustody.fragment !== 'player') && state.prologueEnding !== 'fragment-transferred' && state.campaign?.origin !== 'fragment-transferred') return null;
  return state;
}

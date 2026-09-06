import { initialDayOne, dayOneTopicIds } from './day-one.ts';
import type { GameState } from './types.ts';

/** 仅完整缺失时兼容旧档；部分新字段损坏必须交给仓库回退。 */
export function decodeDayOne(state: GameState | null): GameState | null {
  if (!state) return null;
  if (!Object.hasOwn(state, 'dayOne')) {
    if (state.inventoryItemIds.includes('blood-cloth') || Object.values(state.npcStates).some(n => dayOneTopicIds.some(id => n.memory.topics[id]) || n.memory.evidence.includes('stance-observation'))) return null;
    const d = initialDayOne();
    const registration = state.lodgingRecords.at(-1);
    if (registration) { d.registration = 'true'; d.registeredName = registration.registeredName; }
    if (state.playerKnownFactIds.includes('doctor-wound-residue')) { d.interview = 'refused'; d.consent = 'exam'; d.cloth = 'doctor'; }
    return { ...state, dayOne: d };
  }
  const d = state.dayOne;
  if (!d || typeof d !== 'object' || d.schema !== 1) return null;
  const enums = { gatePosition: ['line', 'aside'], review: ['none', 'questioning', 'answered', 'disputed', 'cleared'], registration: ['none', 'true', 'alias', 'refused'], interview: ['none', 'truth', 'lie', 'refused'], consent: ['none', 'exam', 'basic', 'refused'], cloth: ['undecided', 'retain', 'keep', 'player', 'doctor'] };
  for (const [key, values] of Object.entries(enums)) if (!values.includes(d[key as keyof typeof enums])) return null;
  for (const key of ['menu', 'registrationDiscrepancy', 'privateCare', 'reportAuthorized', 'guidanceSeed', 'companionLead'] as const) if (typeof d[key] !== 'boolean') return null;
  for (const key of ['gateName', 'registeredName'] as const) if (d[key] !== null && (typeof d[key] !== 'string' || !d[key].trim() || d[key].length > 12)) return null;
  if (!Number.isInteger(d.bleedingGraceMinutes) || d.bleedingGraceMinutes < 0 || d.bleedingGraceMinutes > (state.growth?.medicine?.nodes?.includes('medicine-bandage') ? 240 : 180)) return null;
  if (d.returnReceipt !== null && (!d.returnReceipt || d.returnReceipt.from !== 'ma' || d.returnReceipt.to !== 'player' || !Number.isFinite(d.returnReceipt.atMinutes) || d.returnReceipt.atMinutes < state.storyStartedAtMinutes || d.returnReceipt.atMinutes > state.worldMinutes)) return null;
  if (['true', 'alias'].includes(d.registration) !== (d.registeredName !== null)) return null;
  if ((d.cloth === 'player') !== state.inventoryItemIds.includes('blood-cloth')) return null;
  if (d.returnReceipt && d.review !== 'cleared') return null;
  if (['questioning', 'answered', 'disputed'].includes(d.review) && (state.locationId !== 'gate' || state.selectedNpcId !== 'ning-buping')) return null;
  return state;
}

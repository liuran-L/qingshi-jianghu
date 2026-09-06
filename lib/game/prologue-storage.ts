import type { GameState } from './types.ts';
import { initialPrologue, advanceCargo, CARGO_ARRIVAL, CARGO_DEPARTURE, prologueFields } from './prologue.ts';

/** v6 增量结构号为1；仅完整缺少本阶段字段的旧档可补默认，部分缺失视为坏档。 */
export function decodePrologue(state: GameState): GameState | null {
  if (!prologueFields.some((key) => Object.hasOwn(state, key))) {
    const next = { ...state, ...initialPrologue() };
    next.poisonWoundLinked = state.playerKnownFactIds.includes('corpse-wound-link');
    next.evidenceCustody.fragment = state.inventoryItemIds.includes('ding17-fragment') ? 'player' : state.npcStates['ma-sandao'].detainedPlayer ? 'ma' : 'unknown';
    next.evidenceCustody.medical = state.playerKnownFactIds.includes('doctor-wound-residue') ? 'shen' : 'unknown';
    return advanceCargo(next);
  }
  if (state.prologueSchema !== 1 || !['chengShouyiIdentified', 'poisonWoundLinked', 'cartMarkObserved'].every((key) => typeof state[key as keyof GameState] === 'boolean')) return null;
  const custody = state.evidenceCustody;
  const c = state.saltCase;
  if (!custody || typeof custody !== 'object' || Array.isArray(custody) || Object.keys(custody).length !== 4 || !['fragment', 'medical', 'cart', 'identity'].every((key) => ['unknown', 'player', 'shen', 'ma', 'broker', 'yamen'].includes(custody[key as keyof typeof custody]))) return null;
  if (!c || typeof c !== 'object' || Array.isArray(c) || !['reported', 'cartChecked', 'ledgerChecked'].every((key) => typeof c[key as keyof typeof c] === 'boolean') || ![null, 'roster', 'recollection'].includes(c.identitySource)) return null;
  if (!Array.isArray(c.submittedSources) || !c.submittedSources.every((s) => ['baggage', 'clinic', 'gate', 'inn', 'recollection'].includes(s)) || new Set(c.submittedSources).size !== c.submittedSources.length) return null;
  if (![null, 'sealed-salt', 'night-ferry', 'fragment-transferred'].includes(state.prologueEnding) || !['pending', 'unloading', 'sealed', 'departed'].includes(state.day3CargoStatus)) return null;
  if (c.reported && c.submittedSources.length < 2 || c.cartChecked && !c.reported || c.ledgerChecked && !c.cartChecked) return null;
  if (state.chengShouyiIdentified !== (c.identitySource !== null) || state.chengShouyiIdentified && !state.playerKnownFactIds.includes('cheng-identity')) return null;
  if (custody.fragment === 'player' && !state.inventoryItemIds.includes('ding17-fragment') || ['yamen', 'ma', 'broker'].includes(custody.fragment) && state.inventoryItemIds.includes('ding17-fragment')) return null;
  if (state.prologueEnding === 'sealed-salt') {
    const elapsed = (c.endedAt ?? 0) - state.storyStartedAtMinutes;
    if (!state.player.alive || state.gatePhase === 'detained' || !c.ledgerChecked || !state.chengShouyiIdentified || !state.poisonWoundLinked || !state.playerKnownFactIds.includes('medical-report') || !state.playerKnownFactIds.includes('sealed-case') || state.day3CargoStatus !== 'sealed' || !Object.values(custody).every((v) => v === 'yamen') || !Number.isFinite(c.endedAt) || c.endedAt !== state.worldMinutes || elapsed < CARGO_ARRIVAL || elapsed >= CARGO_DEPARTURE || c.stayPermitUntil !== c.endedAt + 4320) return null;
  } else if (state.prologueEnding === 'night-ferry') {
    if (!state.player.alive || state.gatePhase === 'detained' || state.saltCase.reported || state.day3CargoStatus !== 'departed' || !Number.isFinite(c.endedAt) || c.endedAt !== state.worldMinutes || c.stayPermitUntil !== null || !(state.chengShouyiIdentified || state.poisonWoundLinked)) return null;
  } else if (state.prologueEnding === 'fragment-transferred') {
    if (!state.player.alive || state.gatePhase === 'detained' || state.day3CargoStatus !== 'departed' || !Number.isFinite(c.endedAt) || c.endedAt !== state.worldMinutes || c.stayPermitUntil !== null || custody.fragment !== 'broker' || state.inventoryItemIds.includes('ding17-fragment')) return null;
  } else if (state.day3CargoStatus === 'sealed' || c.endedAt !== null || c.stayPermitUntil !== null) return null;
  if (!state.prologueEnding) {
    const elapsed = state.worldMinutes - state.storyStartedAtMinutes;
    const expected = elapsed >= CARGO_DEPARTURE ? 'departed' : elapsed >= CARGO_ARRIVAL ? 'unloading' : 'pending';
    if (state.day3CargoStatus !== expected) return null;
  }
  if (state.prologueEnding === 'sealed-salt' && (!state.inventoryItemIds.includes('temporary-stay-permit') || !state.inventoryItemIds.includes('evidence-receipt'))) return null;
  return state;
}

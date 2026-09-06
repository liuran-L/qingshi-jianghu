import { initialGrowth } from './growth.ts';
import type { GameState, GrowthNodeId } from './types.ts';

const validNodes = new Set<GrowthNodeId>(['step-foundation', 'step-breath', 'medicine-diagnosis', 'medicine-bandage']);
export function decodeGrowth(state: GameState | null): GameState | null {
  if (!state) return null;
  if (!Object.hasOwn(state, 'growth')) {
    const growth = initialGrowth();
    if (state.dayOne.guidanceSeed && state.npcStates['lu-guanlan'].memory.evidence.includes('stance-observation')) growth.step.unlocked = true;
    if (state.dayOne.interview !== 'none' && (state.dayOne.consent !== 'none' || state.economy.medicalWorkAt !== null || state.player.injury === '无')) growth.medicine.unlocked = true;
    return { ...state, growth };
  }
  const g = state.growth;
  if (!g || typeof g !== 'object' || g.schema !== 1 || typeof g.menu !== 'boolean') return null;
  for (const [tree, allowed] of [['step', ['step-foundation', 'step-breath']], ['medicine', ['medicine-diagnosis', 'medicine-bandage']]] as const) {
    const value = g[tree];
    if (!value || typeof value !== 'object' || typeof value.unlocked !== 'boolean' || !(value.unlockedAt === null || Number.isFinite(value.unlockedAt)) || !(value.pointAwardedAt === null || Number.isFinite(value.pointAwardedAt)) || ![0, 1].includes(value.availablePoints) || !Array.isArray(value.nodes) || value.nodes.some((n) => !validNodes.has(n) || !allowed.includes(n as never)) || new Set(value.nodes).size !== value.nodes.length) return null;
    if (!value.unlocked && (value.unlockedAt !== null || value.pointAwardedAt !== null || value.availablePoints !== 0 || value.nodes.length)) return null;
    if (value.pointAwardedAt !== null && (value.pointAwardedAt < state.storyStartedAtMinutes || value.pointAwardedAt > state.worldMinutes)) return null;
    const extra = state.campaign?.extraLessons?.[tree] ?? 0;
    if (![0, 1].includes(extra) || value.nodes.length + value.availablePoints > (value.pointAwardedAt === null ? 0 : 1) + extra) return null;
    if (tree === 'step' && value.nodes.includes('step-breath') && !value.nodes.includes('step-foundation')) return null;
    if (tree === 'medicine' && value.nodes.includes('medicine-bandage') && !value.nodes.includes('medicine-diagnosis')) return null;
  }
  if (g.menu && (!state.player.alive || state.gatePhase === 'detained' || state.prologueEnding)) return null;
  return state;
}

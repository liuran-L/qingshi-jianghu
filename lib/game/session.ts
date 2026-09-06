import { createInitialGame } from './engine.ts';
import type { GameState } from './types.ts';
import type { SaveRepository } from './save-repository.ts';
import type { SaveSlotId } from './storage.ts';
import { consumeSceneReturn } from './save-operations.ts';

/** 仅本次应用运行有效；不把界面与动画状态混入游戏存档。 */
let mapSnapshot: GameState | null = null;
let autoAllowed = false;
export async function beginSession(repo: SaveRepository, loadedSlot?: SaveSlotId) {
  const auto = (await repo.list()).find(s => s.id === 'auto');
  autoAllowed = loadedSlot === 'auto' || !auto?.occupied && !auto?.exists;
  return autoAllowed;
}
export const sessionAutoAllowed = () => autoAllowed;
export async function saveCheckpoint(repo: SaveRepository, state: GameState) {
  if (!autoAllowed) return false;
  await repo.save('auto', state);
  return true;
}
export function sendToMap(state: GameState) { mapSnapshot = structuredClone(state); }
export function takeMapSnapshot() { const state = mapSnapshot; mapSnapshot = null; return state; }
export function returnToTitle(state: GameState | null, confirmed: boolean) {
  if (!confirmed) return state;
  mapSnapshot = null; consumeSceneReturn(); autoAllowed = false;
  return null;
}
export const initialScreen = () => 'title' as const;

export function snapshotSummary(s: GameState | null) {
  return { storyDay: s ? Math.floor((s.worldMinutes - s.storyStartedAtMinutes + 1020) / 1440) + 1 : null,
    characterStatus: s ? !s.player.alive ? '死亡' : s.gatePhase === 'detained' || s.campaign?.ending === 'prison' ? '拘押' : `气血 ${s.player.health} · ${s.player.injury}` : null,
    journeyStatus: s ? s.campaign?.ending ? '人生终局' : s.prologueEnding ? '序章暂结，可接续' : '进行中' : null };
}

export async function startNewJourney(repo:SaveRepository,name:string) { await beginSession(repo); return createInitialGame(name); }

import { applyInteractionResult, createInteractionView, estimateTravel, movePlayer } from './engine.ts';
import { getAvailableActions as getLimitedActions } from './limited-actions.ts';
import { gameEnded } from './campaign.ts';
import type { DialogueAIService } from '../ai/types.ts';
import type { SaveRepository } from './save-repository.ts';
import type { GameState, LimitedActionId, LocationId } from './types.ts';

/** 结局退出须先成功保存；失败时调用方留在结局画面。 */
export async function finishPrologueDemo(repo: SaveRepository, state: GameState, index: number): Promise<boolean> {
  if (!gameEnded(state) || !readingPosition(state, index).latest) return false;
  await repo.save('auto', state);
  return true;
}

export const latestDialogueIndex = (state: GameState) => Math.max(0, state.dialogue.length - 1);
export function readingPosition(state: GameState, index: number) {
  const current = Math.min(Math.max(0, index), latestDialogueIndex(state));
  return { current, latest: current === latestDialogueIndex(state) };
}
export const continueReading = (state: GameState, index: number) => Math.min(readingPosition(state, index).current + 1, latestDialogueIndex(state));

/** 页面和测试使用同一点击处理函数：未读完、过期按钮、连点均不结算。 */
export function createActionRunner(service: DialogueAIService) {
  let pending = false;
  return async (state: GameState, index: number, id: LimitedActionId, npcId: string | null) => {
    if (pending || !readingPosition(state, index).latest || npcId !== state.selectedNpcId) return null;
    const choice = getLimitedActions(state, npcId).find((item) => item.id === id);
    if (!choice) return null;
    pending = true;
    try {
      const request = { actionId: choice.id, input: choice.input, mode: choice.mode, npcId };
      const result = await service.reply(createInteractionView(state, npcId), request);
      const next = applyInteractionResult(state, request, result);
      return next === state ? null : { state: next, dialogueIndex: Math.min(state.dialogue.length, latestDialogueIndex(next)) };
    } finally { pending = false; }
  };
}

export function previewTravel(state: GameState, destination: LocationId) {
  if (['questioning', 'answered', 'disputed'].includes(state.dayOne.review)) return null;
  if (!state.player.alive || gameEnded(state) || state.campaign?.finale || state.gatePhase === 'detained' || destination === state.locationId ||
    !state.knownLocationIds.includes(destination) || (state.locationId === 'gate' && !state.gateAccess)) return null;
  return estimateTravel(state, destination);
}

/** 预览/取消不写状态；确认后的时间与抵达仅在自动保存成功后提交给页面。 */
export function createTravelRunner(repo: SaveRepository) {
  let pending = false;
  return async (state: GameState, destination: LocationId, confirmed: boolean) => {
    if (pending || !confirmed || !previewTravel(state, destination)) return null;
    pending = true;
    try {
      const next = movePlayer(state, destination);
      await repo.save('auto', next);
      return { state: next, dialogueIndex: latestDialogueIndex(next) };
    } finally { pending = false; }
  };
}

import assert from 'node:assert/strict';
import { createActionRunner, latestDialogueIndex } from '../../lib/game/flow-controller.ts';
import { mockAIService } from '../../lib/ai/mock-service.ts';
import type { GameState, LimitedActionId } from '../../lib/game/types.ts';

/** 旧路线增加用户确认的前置选择；每一步仍经过真实页面事件和规则校验。 */
export async function prepareService(state: GameState, id: LimitedActionId, route?: string[]): Promise<GameState> {
  if (!state.player.alive || state.gatePhase === 'detained' || state.prologueEnding) return state;
  const steps: LimitedActionId[] = [];
  if (id === 'rest-night' && state.locationId === 'inn' && state.dayOne.registration === 'none') steps.push('open-dayone', 'register-true');
  if (id === 'request-treatment' && state.locationId === 'clinic' && state.dayOne.interview === 'none') steps.push('open-dayone', 'medical-truth', 'consent-exam', 'retain-cloth');
  for (const step of steps) {
    const result = await createActionRunner(mockAIService)(state, latestDialogueIndex(state), step, state.selectedNpcId);
    assert.ok(result, `前置选项不可用：${step}`);
    state = result.state;
    if (step !== 'open-dayone') route?.push(step);
  }
  return state;
}

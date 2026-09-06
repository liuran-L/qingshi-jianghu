import type { AIInteractionProposal, InteractionRequest, InteractionView } from '../game/types.ts';

/** 服务只能读取规则投影并生成表达候选，不能取得或修改完整 GameState。 */
export interface DialogueAIService {
  reply(view: InteractionView, request: InteractionRequest): Promise<AIInteractionProposal>;
}

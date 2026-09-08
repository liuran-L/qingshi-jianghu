import type { GameState, NpcRuntimeState } from '../game/types.ts';

export type RelationshipStage = '陌路' | '熟稔' | '信赖' | '知己';

const score = (npc: NpcRuntimeState) => Math.max(0, Math.min(100,
  30 + npc.trust * 5 + npc.favor * 3 + npc.attitude * 2 - npc.suspicion * 4 - npc.hostility * 8,
));

/** 关系数值只参与本地推导；玩家界面只看到离散阶段。 */
export function relationshipStage(state: GameState, npcId: string): RelationshipStage {
  const value = state.npcStates[npcId] ? score(state.npcStates[npcId]) : 0;
  if (value <= 30) return '陌路';
  if (value <= 60) return '熟稔';
  if (value <= 85) return '信赖';
  return '知己';
}

export function relationshipStageChanges(before: GameState, after: GameState): Array<{ npcId: string; from: RelationshipStage; to: RelationshipStage }> {
  return Object.keys(after.npcStates).flatMap((npcId) => {
    if (!before.npcStates[npcId]) return [];
    const from = relationshipStage(before, npcId);
    const to = relationshipStage(after, npcId);
    return from === to ? [] : [{ npcId, from, to }];
  });
}

import type { DialogueLine, GameState } from './types.ts';
import { npcs } from './world.ts';

/** 显示层资源登记；替换 src 即可换正式美术，不接触剧情或身份结算。 */
export const portraits: Record<string, { src: string; position: string }> = Object.fromEntries(
  ['player', ...npcs.map(n => n.id)].map(id => [id, { src: `/portraits/${id}.svg`, position: 'center bottom' }]),
);
export function portraitForLine(state: GameState, line: DialogueLine | undefined) {
  if (!line || line.kind === 'narration') return null;
  if (line.kind === 'player') return portraits.player;
  const id = line.portraitId ?? npcs.find(n => n.observedLabel === line.speaker || state.npcKnowledge[n.id]?.knownName === line.speaker)?.id;
  return id ? portraits[id] ?? null : null;
}

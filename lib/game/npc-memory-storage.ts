import { emptyNpcMemory, topicIds } from './npc-memory.ts';
import { evidenceMemoryIds } from './prologue.ts';
import { dayOneTopicIds } from './day-one.ts';
import { dayTwoTopicIds } from './day-two.ts';
import type { GameState } from './types.ts';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === 'string');
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const unique = (value: string[]) => new Set(value).size === value.length;

/** v6 缺失或损坏不得用默认值掩盖，让仓库走既有备份回退。 */
export function validNpcMemory(runtime: Record<string, unknown>, now: number): boolean {
  if (!['trust', 'favor'].every((key) => finite(runtime[key]) && Math.abs(runtime[key] as number) <= 100)) return false;
  const m = runtime.memory;
  if (!record(m) || !record(m.topics) || !strings(m.evidence) || !unique(m.evidence) || !m.evidence.every((id) => evidenceMemoryIds.includes(id)) || !strings(m.appliedEvents) || !unique(m.appliedEvents) || !Array.isArray(m.statements)) return false;
  if (!Object.entries(m.topics).every(([id, t]) => [...topicIds, ...dayOneTopicIds, ...dayTwoTopicIds].includes(id as typeof topicIds[number]) && record(t) && ['answered', 'refused', 'locked'].includes(t.status as string) && finite(t.atMinutes) && t.atMinutes >= 0 && t.atMinutes <= now && finite(t.day) && t.day === Math.floor(t.atMinutes / 1440) && finite(t.attempts) && Number.isInteger(t.attempts) && t.attempts >= 1 && strings(t.evidence) && t.evidence.every((e) => ['roadside-ambush', 'nameless-corpse', 'ding17-ship-arrives', 'yue-hansheng-hides', 'magistrate-assassination', 'qingyue-leader-dies', 'dock-ledger-fire', 'county-lockdown'].includes(e)) && typeof t.respected === 'boolean')) return false;
  const ids = m.statements.map((s) => record(s) ? s.id : null);
  if (new Set(ids).size !== ids.length) return false;
  return m.statements.every((s, index) => record(s) && ['id', 'subject', 'value', 'text'].every((key) => typeof s[key] === 'string' && (s[key] as string).length > 0) && finite(s.atMinutes) && s.atMinutes >= 0 && s.atMinutes <= now && ['unknown', 'verified', 'false'].includes(s.truth as string) && strings(s.contradicts) && unique(s.contradicts) && s.contradicts.every((id) => ids.slice(0, index).includes(id)));
}

/** 仅在旧字段全部校验后调用。保留 v5 数值、原口供和拒答；不猜测旧对话含义或赋予虚构信任。 */
export function upgradeV5(value: Record<string, unknown>): GameState {
  const state = value as unknown as GameState;
  const npcStates = Object.fromEntries(Object.entries(state.npcStates).map(([id, npc]) => {
    const memory = emptyNpcMemory();
    if (state.npcKnowledge[id].learnedFacts.includes('对方已婉拒透露姓名')) memory.topics['ask-name'] = { status: 'refused', attempts: 1, atMinutes: state.worldMinutes, day: Math.floor(state.worldMinutes / 1440), evidence: [], respected: false };
    // 无法可靠结构化的旧口供保留在 playerClaims，不制造矛盾或惩罚。
    return [id, { ...npc, trust: 0, favor: 0, memory }];
  }));
  return { ...state, version: 6, npcStates };
}

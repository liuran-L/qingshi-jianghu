import type { GameState, InteractionRequest, LimitedActionId, NpcMemory, NpcStatement, NpcRuntimeState, TopicMemory } from './types.ts';
import { getLocation } from './world.ts';

export const socialNpcIds = ['ma-sandao', 'su-wantang', 'lu-guanlan', 'shen-yanqiu'];
export const topicIds: LimitedActionId[] = ['tell-attack', 'tell-pass-lost', 'ask-guard-name', 'stay-silent', 'ask-lodging', 'ask-clinic', 'mention-ding17', 'challenge-search', 'offer-bribe', 'request-entry', 'submit-search', 'ask-name', 'ask-news', 'request-room', 'request-treatment', 'ask-corpse', 'compare-corpse-wound'];
export const emptyNpcMemory = (): NpcMemory => ({ topics: {}, statements: [], evidence: [], appliedEvents: [] });
const day = (state: GameState) => Math.floor(state.worldMinutes / 1440);
const bound = (value: number) => Math.max(-100, Math.min(100, value));

/** 仅供本地规则调用；事件去重，读档/重复观察不能刷关系。 */
export function changeNpcRelationship(state: GameState, npcId: string, eventId: string, changes: Partial<Pick<NpcRuntimeState, 'attitude' | 'trust' | 'suspicion' | 'hostility' | 'favor'>>): GameState {
  const npc = state.npcStates[npcId];
  if (!npc || !eventId || npc.memory.appliedEvents.includes(eventId) || Object.values(changes).some((n) => !Number.isFinite(n))) return state;
  const next = { ...npc, memory: { ...npc.memory, appliedEvents: [...npc.memory.appliedEvents, eventId] } };
  for (const key of ['attitude', 'trust', 'suspicion', 'hostility', 'favor'] as const) {
    if (changes[key] !== undefined) next[key] = bound(npc[key] + changes[key]);
  }
  return { ...state, npcStates: { ...state.npcStates, [npcId]: next } };
}

function withMemory(state: GameState, npcId: string, memory: NpcMemory): GameState {
  return { ...state, npcStates: { ...state.npcStates, [npcId]: { ...state.npcStates[npcId], memory } } };
}

/** subject/value 必须来自本地动作映射，不能从自由文字或 AI 提案直接写入。不同 NPC 不共享口供。 */
export function recordNpcStatement(state: GameState, npcId: string, statement: Omit<NpcStatement, 'atMinutes' | 'contradicts'>): GameState {
  const npc = state.npcStates[npcId];
  if (!npc || !statement.id || !statement.subject || !statement.value || npc.memory.statements.some((item) => item.id === statement.id)) return state;
  const contradicts = npc.memory.statements.filter((item) => item.subject === statement.subject && item.value !== 'unknown' && statement.value !== 'unknown' && item.value !== statement.value).map((item) => item.id);
  let next = withMemory(state, npcId, { ...npc.memory, statements: [...npc.memory.statements, { ...statement, atMinutes: state.worldMinutes, contradicts }] });
  if (contradicts.length || statement.truth === 'false') next = changeNpcRelationship(next, npcId, `statement:${statement.id}`, { trust: -2, suspicion: 2 });
  return next;
}

/** 由本地证据规则核验已有口供；不把全局真相或别人的口供传给该 NPC。 */
export function verifyNpcStatement(state: GameState, npcId: string, statementId: string, truth: 'verified' | 'false', evidence: string): GameState {
  const npc = state.npcStates[npcId];
  const statement = npc?.memory.statements.find((item) => item.id === statementId);
  if (!statement || statement.truth === truth || !npc.memory.evidence.includes(evidence)) return state;
  let next = withMemory(state, npcId, { ...npc.memory, statements: npc.memory.statements.map((item) => item.id === statementId ? { ...item, truth } : item) });
  if (truth === 'false') next = changeNpcRelationship(next, npcId, `disproved:${statementId}`, { trust: -2, suspicion: 2 });
  return next;
}

/** 实际展示才记录；仅在背包内或玩家自行检查不等于 NPC 已看过。 */
export function showNpcEvidence(state: GameState, npcId: string, evidence: 'ding17-fragment' | 'abnormal-wound'): GameState {
  const npc = state.npcStates[npcId];
  if (!npc || !getLocation(state.locationId).npcIds.includes(npcId) || npc.memory.evidence.includes(evidence) || (evidence === 'ding17-fragment' ? !state.inventoryItemIds.includes(evidence) : state.player.injury === '无')) return state;
  return withMemory(state, npcId, { ...npc.memory, evidence: [...npc.memory.evidence, evidence] });
}

export function getTopicStatus(state: GameState, npcId: string, actionId: LimitedActionId): 'unasked' | 'reopened' | TopicMemory['status'] {
  const npc = state.npcStates[npcId];
  const topic = npc?.memory.topics[actionId];
  if (!topic) return 'unasked';
  if (actionId === 'ask-news' && (day(state) > topic.day || (!topic.evidence.includes('nameless-corpse') && state.triggeredWorldEventIds.includes('nameless-corpse')))) return 'reopened';
  if (actionId === 'ask-name' && topic.status !== 'answered' && topic.respected && npc.trust >= 2 && npc.suspicion < 3 && npc.hostility <= 0 && day(state) > topic.day) return 'reopened';
  if (actionId === 'request-treatment' && state.player.money >= 3 && state.player.injury !== '无') return 'reopened';
  return topic.status;
}

export function isTopicAvailable(state: GameState, npcId: string | null, actionId: LimitedActionId): boolean {
  if (!npcId || !socialNpcIds.includes(npcId) || !topicIds.includes(actionId)) return true;
  const status = getTopicStatus(state, npcId, actionId);
  return status === 'unasked' || status === 'reopened';
}

/** 已通过动作校验且存活完成交互后调用。 */
export function rememberNpcInteraction(before: GameState, after: GameState, request: InteractionRequest): GameState {
  const id = request.npcId;
  if (!id || !socialNpcIds.includes(id)) return after;
  let next = after;
  let memory = next.npcStates[id].memory;
  for (const [key, topic] of Object.entries(memory.topics)) {
    if (topic && (topic.status === 'refused' || topic.status === 'locked') && !topic.respected && key !== request.actionId && key === 'ask-name') {
      memory = { ...memory, topics: { ...memory.topics, [key]: { ...topic, status: 'locked', respected: true } } };
      next = withMemory(next, id, memory);
      next = changeNpcRelationship(next, id, 'respect-name-refusal', { trust: 1 });
      memory = next.npcStates[id].memory;
    }
  }
  if (topicIds.includes(request.actionId)) {
    const previous = memory.topics[request.actionId];
    const status = request.actionId === 'ask-name' && !next.npcKnowledge[id].knownName ? 'refused' : request.actionId === 'request-treatment' && before.player.money < 3 ? 'locked' : 'answered';
    memory = { ...memory, topics: { ...memory.topics, [request.actionId]: { status, atMinutes: before.worldMinutes, day: day(before), attempts: (previous?.attempts ?? 0) + 1, evidence: request.actionId === 'ask-news' && before.triggeredWorldEventIds.includes('nameless-corpse') ? ['nameless-corpse'] : [], respected: previous?.respected ?? false } } };
    next = withMemory(next, id, memory);
  }
  if (request.actionId === 'tell-attack' || request.actionId === 'tell-pass-lost') {
    next = recordNpcStatement(next, id, { id: `claim:${before.worldMinutes}:${request.actionId}`, subject: 'road-pass', value: 'lost', text: request.input, truth: 'unknown' });
    if (request.actionId === 'tell-attack') next = recordNpcStatement(next, id, { id: `attack:${before.worldMinutes}`, subject: 'journey', value: 'attacked', text: request.input, truth: 'unknown' });
  }
  if (request.actionId === 'rest-night' && before.player.money >= 2) {
    next = recordNpcStatement(next, id, { id: `registration:${before.worldMinutes}`, subject: 'name', value: before.dayOne.registeredName ?? before.player.name, text: `住宿登记：${before.dayOne.registeredName ?? before.player.name}`, truth: 'unknown' });
    next = changeNpcRelationship(next, id, 'first-registration', { trust: 1 });
  }
  if (request.actionId === 'request-treatment' && before.player.money >= 3) {
    const shown = showNpcEvidence(before, id, 'abnormal-wound');
    next = withMemory(next, id, { ...next.npcStates[id].memory, evidence: shown.npcStates[id].memory.evidence });
  }
  if (request.actionId === 'submit-search' && before.inventoryItemIds.includes('ding17-fragment')) {
    next = withMemory(next, id, { ...next.npcStates[id].memory, evidence: [...new Set([...next.npcStates[id].memory.evidence, 'ding17-fragment'])] });
  }
  return next;
}

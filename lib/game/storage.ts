import { decodeBattles } from './battle-storage.ts';
import { decodeArts } from './arts-storage.ts';
import { snapshotSummary } from './session.ts';
import { clues, inventoryItems, knownFacts, locations, npcs, worldEvents } from './world.ts';
import type { GameState, LocationId } from './types.ts';
import { upgradeV5, validNpcMemory } from './npc-memory-storage.ts';
import { decodePrologue } from './prologue-storage.ts';
import { decodeDayOne } from './day-one-storage.ts';
import { decodeDayTwo } from './day-two-storage.ts';
import { decodeEconomy } from './economy-storage.ts';
import { decodeGrowth } from './growth-storage.ts';
import { decodeCampaign } from './campaign-storage.ts';

export const MANUAL_SAVE_LIMIT = 20;
export type ManualSaveSlotId = `manual-${number}`;
export type SaveSlotId = 'auto' | ManualSaveSlotId;
export interface SaveSlotSummary {
  id: SaveSlotId;
  label: string;
  exists: boolean;
  occupied?: boolean;
  recovered?: boolean;
  playerName: string | null;
  worldMinutes: number | null;
  locationId: LocationId | null;
  gameVersion: number | null;
  savedAt: number | null;
  storyDay?: number | null;
  characterStatus?: string | null;
  journeyStatus?: string | null;
}

interface BrowserSaveMeta { label: string; savedAt: number }
export interface SaveRecord extends BrowserSaveMeta { payload: string }
interface SaveEnvelope extends SaveRecord { format: 1; backup: SaveRecord | null }

const SAVE_PREFIX = 'qingshi-jianghu-save-v5';
export const SAVE_KEY = `${SAVE_PREFIX}:auto`;
export const AUTO_BACKUP_KEY = `${SAVE_PREFIX}:auto-backup`;
const slotKey = (slot: SaveSlotId) => `${SAVE_PREFIX}:${slot}`;
const metaKey = (slot: SaveSlotId) => `${SAVE_PREFIX}:${slot}:meta`;
export const manualSaveSlotIds = Array.from({ length: MANUAL_SAVE_LIMIT }, (_, index) => `manual-${index + 1}` as ManualSaveSlotId);
export const allSaveSlotIds: SaveSlotId[] = ['auto', ...manualSaveSlotIds];
export const isSaveSlotId = (value: string): value is SaveSlotId => value === 'auto' || /^manual-(?:[1-9]|1\d|20)$/.test(value);
export const defaultSaveLabel = (slot: SaveSlotId) => slot === 'auto' ? '自动存档' : `手动存档 ${Number(slot.slice(7))}`;
const validLocationIds = new Set(locations.map((item) => item.id));
const validNpcIds = new Set(npcs.map((item) => item.id));
const validClueIds = new Set<string>(clues.map((item) => item.id));
const validFactIds = new Set<string>(knownFacts.map((item) => item.id));
const validItemIds = new Set<string>(inventoryItems.map((item) => item.id));
const validEventIds = new Set<string>(worldEvents.map((item) => item.id));
const injuries = new Set(['无', '轻伤', '重伤']);
const poisons = new Set(['无', '未确认', '不明残毒']);
const gatePhases = new Set(['questioning', 'explaining', 'searched', 'cleared', 'detained']);

export function encodeSave(state: GameState): string {
  return JSON.stringify(state);
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasNumericAbilities = (value: unknown) => isRecord(value) && ['martial', 'agility', 'insight', 'eloquence', 'vigilance', 'medicine'].every((key) => isNumber(value[key]));

export function decodeSave(raw: string): GameState | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const player = value.player;
    if (
      ![5, 6].includes(value.version as number) || value.started !== true || !isRecord(player) ||
      !isString(player.name) || !hasNumericAbilities(player.abilities) ||
      !['health', 'maxHealth', 'qi', 'maxQi', 'fatigue', 'maxFatigue', 'woundUntreatedMinutes', 'money', 'reputation', 'chivalry', 'infamy'].every((key) => isNumber(player[key])) ||
      !injuries.has(player.injury as string) || !poisons.has(player.poison as string) ||
      typeof player.hasRoadPass !== 'boolean' || typeof player.alive !== 'boolean' ||
      (player.deathCause !== null && !isString(player.deathCause)) ||
      !isNumber(value.worldMinutes) || !isNumber(value.storyStartedAtMinutes) ||
      !validLocationIds.has(value.locationId as LocationId) ||
      !Array.isArray(value.dialogue) || !value.dialogue.every((item) => isRecord(item) && isString(item.id) && isString(item.speaker) && isString(item.text) && (item.tone === undefined || isString(item.tone)) && (item.portraitId === undefined || item.portraitId === 'player' || validNpcIds.has(item.portraitId as string)) && ['narration', 'npc', 'player'].includes(item.kind as string)) ||
      !Array.isArray(value.logs) || !value.logs.every((item) => isRecord(item) && isString(item.id) && isNumber(item.atMinutes) && isString(item.type) && isString(item.text)) ||
      !isStringArray(value.knownLocationIds) || !value.knownLocationIds.every((id) => validLocationIds.has(id as LocationId)) ||
      !isRecord(value.npcKnowledge) || !validNpcIds.has(value.selectedNpcId as string) && value.selectedNpcId !== null ||
      !isRecord(value.npcStates) || !isRecord(value.conversationTurns) ||
      !isStringArray(value.playerKnownFactIds) || !value.playerKnownFactIds.every((id) => validFactIds.has(id)) ||
      !Array.isArray(value.playerClaims) || !value.playerClaims.every((item) => isRecord(item) && isString(item.id) && isString(item.text) && validNpcIds.has(item.toldNpcId as string) && isNumber(item.atMinutes)) ||
      !Array.isArray(value.lodgingRecords) || !value.lodgingRecords.every((item) => isRecord(item) && item.locationId === 'inn' && isString(item.registeredName) && isNumber(item.atMinutes)) ||
      !gatePhases.has(value.gatePhase as string) || typeof value.gateAccess !== 'boolean' ||
      !isStringArray(value.knownClueIds) || !value.knownClueIds.every((id) => validClueIds.has(id)) ||
      !isStringArray(value.inventoryItemIds) || !value.inventoryItemIds.every((id) => validItemIds.has(id)) ||
      !isStringArray(value.triggeredWorldEventIds) || !value.triggeredWorldEventIds.every((id) => validEventIds.has(id)) ||
      !isStringArray(value.knownWorldEventIds) || !value.knownWorldEventIds.every((id) => validEventIds.has(id)) ||
      !isRecord(value.worldEventOutcomes)
    ) return null;
    const numeric = player as unknown as GameState['player'];
    if (numeric.health < 0 || numeric.health > numeric.maxHealth || numeric.maxHealth <= 0 ||
      numeric.qi < 0 || numeric.qi > numeric.maxQi || numeric.maxQi <= 0 ||
      numeric.fatigue < 0 || numeric.fatigue > numeric.maxFatigue || numeric.maxFatigue <= 0 ||
      numeric.money < 0 || numeric.woundUntreatedMinutes < 0 ||
      value.worldMinutes < value.storyStartedAtMinutes || value.storyStartedAtMinutes < 0 ||
      !value.knownLocationIds.includes(value.locationId as string)) return null;
    for (const id of validNpcIds) {
      const knowledge = value.npcKnowledge[id];
      const runtime = value.npcStates[id];
      if (!isRecord(knowledge) || typeof knowledge.observed !== 'boolean' || typeof knowledge.matched !== 'boolean' ||
        !(knowledge.knownName === null || isString(knowledge.knownName)) ||
        !(knowledge.knownIdentity === null || isString(knowledge.knownIdentity)) || !isStringArray(knowledge.learnedFacts) ||
        !isRecord(runtime) || !['attitude', 'suspicion', 'hostility'].every((key) => isNumber(runtime[key])) ||
        !['informedRiverGang', 'searchedPlayer', 'detainedPlayer'].every((key) => typeof runtime[key] === 'boolean') ||
        !isRecord(runtime.claimBeliefs) || !Object.values(runtime.claimBeliefs).every(isNumber) ||
        (value.version === 6 && !validNpcMemory(runtime, value.worldMinutes))) return null;
    }
    if (!Object.entries(value.conversationTurns).every(([id, count]) => validNpcIds.has(id) && isNumber(count) && Number.isInteger(count) && count >= 0) ||
      !Object.entries(value.worldEventOutcomes).every(([id, outcome]) => validEventIds.has(id) && isString(outcome)) ||
      !value.knownWorldEventIds.every((id) => (value.triggeredWorldEventIds as string[]).includes(id))) return null;
    if (Object.keys(value.npcKnowledge).some((id) => !validNpcIds.has(id)) || Object.keys(value.npcStates).some((id) => !validNpcIds.has(id)) ||
      Object.values(numeric.abilities).some((ability) => ability < 0) ||
      (value.selectedNpcId !== null && !locations.find((location) => location.id === value.locationId)!.npcIds.includes(value.selectedNpcId as string) && !(value.locationId === 'gate' && value.selectedNpcId === 'ning-buping' && isRecord(value.dayOne) && ['questioning', 'answered', 'disputed'].includes(value.dayOne.review as string))) ||
      numeric.alive !== (numeric.health > 0) || (numeric.alive ? numeric.deathCause !== null : !numeric.deathCause)) return null;
    return decodeBattles(decodeArts(decodeCampaign(decodeGrowth(decodeEconomy(decodeDayTwo(decodeDayOne(decodePrologue(value.version === 5 ? upgradeV5(value) : value as unknown as GameState))))))));
  } catch {
    return null;
  }
}

const readMeta = (slot: SaveSlotId): BrowserSaveMeta | null => {
  const raw = localStorage.getItem(metaKey(slot));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<BrowserSaveMeta>;
    return isString(value.label) && isNumber(value.savedAt) ? { label: value.label, savedAt: value.savedAt } : null;
  } catch { return null; }
};

export function saveToBrowser(state: GameState, slot: SaveSlotId = 'auto', label?: string): void {
  if (!isSaveSlotId(slot)) throw new Error('非法存档位');
  const payload = encodeSave(state);
  if (!decodeSave(payload)) throw new Error('存档数据不完整或不兼容');
  const previous = readBrowserSlot(slot);
  const backup = slot === 'auto' ? (previous.record?.payload === payload ? previous.backup : previous.record ?? previous.backup) : null;
  const nextLabel = slot === 'auto' ? '自动存档' : normalizeSaveLabel(label ?? '') || previous.record?.label || defaultSaveLabel(slot);
  if (slot === 'auto' && backup) localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(backup));
  // 内容、名称、时间与备份一次原子写入；配额不足时保留原记录。
  localStorage.setItem(slotKey(slot), JSON.stringify({ format: 1, payload, label: nextLabel, savedAt: Date.now(), backup } satisfies SaveEnvelope));
}

export const normalizeSaveLabel = (label: string) => Array.from(label.trim()).slice(0, 24).join('');
export function decodeSaveRecord(raw: string | null): SaveRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (isRecord(value) && isString(value.payload) && decodeSave(value.payload) && isString(value.label) && isNumber(value.savedAt) && value.savedAt >= 0)
      return { payload: value.payload, label: value.label, savedAt: value.savedAt };
  } catch { /* 损坏记录由调用方展示，不抛出页面异常。 */ }
  return null;
}

function readBrowserSlot(slot: SaveSlotId) {
  const raw = localStorage.getItem(slotKey(slot));
  let record = decodeSaveRecord(raw);
  let backup: SaveRecord | null = null;
  if (raw) {
    try { backup = decodeSaveRecord(JSON.stringify(JSON.parse(raw).backup)); } catch { /* 非 JSON */ }
    // 保留 v5 存储键和旧封装；v5 内容只在内存升级，不迁移 v1-v4。
    if (!record && decodeSave(raw)) record = { payload: raw, label: readMeta(slot)?.label ?? defaultSaveLabel(slot), savedAt: readMeta(slot)?.savedAt ?? 0 };
  }
  if (slot === 'auto' && !backup) {
    const legacy = localStorage.getItem(AUTO_BACKUP_KEY);
    backup = decodeSaveRecord(legacy);
    if (!backup && legacy && decodeSave(legacy)) backup = { payload: legacy, label: '自动存档', savedAt: 0 };
  }
  return { record, backup, occupied: raw !== null };
}

export function loadFromBrowser(slot: SaveSlotId = 'auto'): GameState | null {
  if (!isSaveSlotId(slot)) return null;
  const { record, backup } = readBrowserSlot(slot);
  const selected = record ?? (slot === 'auto' ? backup : null);
  return selected ? decodeSave(selected.payload) : null;
}

export function hasBrowserSave(): boolean {
  return getBrowserSaveSlots().some((slot) => slot.exists);
}

export function getBrowserSaveSlots(): SaveSlotSummary[] {
  return allSaveSlotIds.map((id) => {
    const entry = readBrowserSlot(id);
    const meta = entry.record ?? (id === 'auto' ? entry.backup : null);
    const state = meta ? decodeSave(meta.payload) : null;
    return {
      id,
      label: meta?.label ?? defaultSaveLabel(id),
      exists: Boolean(state),
      occupied: entry.occupied || Boolean(meta),
      recovered: Boolean(!entry.record && meta),
      ...snapshotSummary(state),
      playerName: state?.player.name ?? null,
      worldMinutes: state?.worldMinutes ?? null,
      locationId: state?.locationId ?? null,
      gameVersion: state?.version ?? null,
      savedAt: meta?.savedAt ?? null,
    };
  });
}

export function renameBrowserSave(slot: SaveSlotId, label: string): void {
  if (slot === 'auto' || !loadFromBrowser(slot)) throw new Error('不能重命名此存档');
  const meta = readBrowserSlot(slot).record!;
  const nextLabel = normalizeSaveLabel(label);
  if (!nextLabel) throw new Error('存档名称不能为空');
  localStorage.setItem(slotKey(slot), JSON.stringify({ ...meta, format: 1, label: nextLabel, backup: null } satisfies SaveEnvelope));
}

export function deleteBrowserSave(slot: SaveSlotId): void {
  if (!isSaveSlotId(slot)) throw new Error('非法存档位');
  if (slot === 'auto') throw new Error('自动存档不能手动删除');
  localStorage.removeItem(slotKey(slot));
}

export function findEmptyManualSlot(summaries: SaveSlotSummary[]): ManualSaveSlotId | null {
  const occupied = new Set(summaries.filter((item) => item.occupied || item.exists).map((item) => item.id));
  return manualSaveSlotIds.find((id) => !occupied.has(id)) ?? null;
}

export function orderSaveSummaries(summaries: SaveSlotSummary[]): SaveSlotSummary[] {
  return [...summaries].sort((a, b) => {
    if (a.id === 'auto') return -1;
    if (b.id === 'auto') return 1;
    return (b.savedAt ?? 0) - (a.savedAt ?? 0);
  });
}

export function findLatestExistingSave(summaries: SaveSlotSummary[]): SaveSlotSummary | null {
  return summaries.filter((slot) => slot.exists).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))[0] ?? null;
}

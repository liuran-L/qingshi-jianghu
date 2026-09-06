import { snapshotSummary } from './session.ts';
import { decodeSave, deleteBrowserSave, getBrowserSaveSlots, isSaveSlotId, loadFromBrowser, normalizeSaveLabel, renameBrowserSave, saveToBrowser } from './storage.ts';
import type { SaveSlotId, SaveSlotSummary } from './storage.ts';
import type { GameState } from './types.ts';

export interface SaveRepository {
  save(slot: SaveSlotId, state: GameState, label?: string): Promise<void>;
  load(slot: SaveSlotId): Promise<GameState | null>;
  list(): Promise<SaveSlotSummary[]>;
  rename(slot: SaveSlotId, label: string): Promise<void>;
  delete(slot: SaveSlotId): Promise<void>;
  hasAny(): Promise<boolean>;
}

export class BrowserSaveRepository implements SaveRepository {
  async save(slot: SaveSlotId, state: GameState, label?: string) { saveToBrowser(state, slot, label); }
  async load(slot: SaveSlotId) { return loadFromBrowser(slot); }
  async list() { return getBrowserSaveSlots(); }
  async rename(slot: SaveSlotId, label: string) { renameBrowserSave(slot, label); }
  async delete(slot: SaveSlotId) { deleteBrowserSave(slot); }
  async hasAny() { return (await this.list()).some((slot) => slot.exists); }
}

export type SaveInvoke = <T>(command: string, args: Record<string, unknown>) => Promise<T>;
export class TauriSaveRepository implements SaveRepository {
  private invoke: SaveInvoke;
  constructor(invoke?: SaveInvoke) { this.invoke = invoke ?? this.nativeInvoke; }
  private async nativeInvoke<T>(this: void, command: string, args: Record<string, unknown>): Promise<T> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  }

  async save(slot: SaveSlotId, state: GameState, label?: string) {
    const payload = JSON.stringify(state);
    if (!isSaveSlotId(slot) || !decodeSave(payload)) throw new Error('非法存档数据');
    const old = slot === 'auto' ? await this.invoke<string | null>('load_game', { slot }) : null;
    await this.invoke<void>('save_game', { slot, payload, savedAt: Date.now(), label: label ? normalizeSaveLabel(label) : null,
      rotateBackup: Boolean(old && decodeSave(old) && old !== payload) });
  }

  async load(slot: SaveSlotId) {
    if (!isSaveSlotId(slot)) throw new Error('非法存档位');
    const raw = await this.invoke<string | null>('load_game', { slot });
    const state = raw ? decodeSave(raw) : null;
    if (state || slot !== 'auto') return state;
    const backup = await this.invoke<{ payload: string; savedAt: number } | null>('load_backup', {});
    return backup ? decodeSave(backup.payload) : null;
  }

  async list() {
    const summaries = await this.invoke<SaveSlotSummary[]>('list_saves', {});
    return Promise.all(summaries.map(async (slot) => {
      const raw = await this.invoke<string | null>('load_game', { slot: slot.id });
      let state = raw ? decodeSave(raw) : null;
      let savedAt = slot.savedAt;
      let recovered = false;
      if (!state && slot.id === 'auto') {
        const backup = await this.invoke<{ payload: string; savedAt: number } | null>('load_backup', {});
        state = backup ? decodeSave(backup.payload) : null;
        if (state && backup) { savedAt = backup.savedAt; recovered = true; }
      }
      return { ...slot, ...snapshotSummary(state), occupied: slot.exists || Boolean(state), exists: Boolean(state), recovered,
        savedAt: state ? savedAt : null, playerName: state?.player.name ?? null,
        worldMinutes: state?.worldMinutes ?? null, locationId: state?.locationId ?? null, gameVersion: state?.version ?? null };
    }));
  }

  async rename(slot: SaveSlotId, label: string) {
    if (!isSaveSlotId(slot) || slot === 'auto' || !normalizeSaveLabel(label) || !await this.load(slot)) throw new Error('不能重命名此存档');
    await this.invoke<void>('rename_save', { slot, label: normalizeSaveLabel(label) });
  }
  async delete(slot: SaveSlotId) {
    if (!isSaveSlotId(slot) || slot === 'auto') throw new Error('不能删除此存档');
    await this.invoke<void>('delete_save', { slot });
  }

  async hasAny() { return (await this.list()).some((slot) => slot.exists); }
}

let repository: SaveRepository | null = null;

/** 所有读写按请求顺序执行；一次失败不阻断后续重试。 */
export function serializeSaveRepository(source: SaveRepository): SaveRepository {
  let tail: Promise<unknown> = Promise.resolve();
  const run = <T>(operation: () => Promise<T>): Promise<T> => {
    const pending = tail.then(operation);
    tail = pending.catch(() => undefined);
    return pending;
  };
  return {
    save: (slot, state, label) => {
      const snapshot = structuredClone(state);
      return run(() => source.save(slot, snapshot, label));
    },
    load: (slot) => run(() => source.load(slot)), list: () => run(() => source.list()),
    rename: (slot, label) => run(() => source.rename(slot, label)), delete: (slot) => run(() => source.delete(slot)),
    hasAny: () => run(() => source.hasAny()),
  };
}

export function getSaveRepository(): SaveRepository {
  if (repository) return repository;
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  repository = serializeSaveRepository(isTauri ? new TauriSaveRepository() : new BrowserSaveRepository());
  return repository;
}

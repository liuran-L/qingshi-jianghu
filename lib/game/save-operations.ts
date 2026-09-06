import type { GameState } from './types.ts';
import type { SaveRepository } from './save-repository.ts';
import { findEmptyManualSlot, type SaveSlotId } from './storage.ts';

export interface SavePrompts {
  confirm(message: string): boolean;
  prompt(message: string, initial: string): string | null;
}

const creationQueues = new WeakMap<SaveRepository, Promise<unknown>>();

/** 页面和回归测试共用同一操作流程，取消时不产生任何写入。 */
export function createManualSave(repo: SaveRepository, state: GameState, prompts: SavePrompts, initial: string) {
  const snapshot = structuredClone(state);
  const operation = (creationQueues.get(repo) ?? Promise.resolve()).then(() => createManualSaveNow(repo, snapshot, prompts, initial));
  creationQueues.set(repo, operation.catch(() => undefined));
  return operation;
}

async function createManualSaveNow(repo: SaveRepository, state: GameState, prompts: SavePrompts, initial: string) {
  const slot = findEmptyManualSlot(await repo.list());
  if (!slot) throw new Error('手动存档已达 20 个，请覆盖或删除一个旧档');
  const label = prompts.prompt('为这个存档命名（最多24个字）', initial);
  if (label === null) return false;
  await repo.save(slot, state, label.trim() || undefined);
  return true;
}

export async function overwriteSave(repo: SaveRepository, slot: SaveSlotId, state: GameState, prompts: SavePrompts) {
  if (slot === 'auto') throw new Error('自动存档由系统维护');
  const existing = (await repo.list()).find((item) => item.id === slot);
  if ((existing?.occupied || existing?.exists) && !prompts.confirm('确定覆盖这个手动存档吗？原有进度将被替换。')) return false;
  await repo.save(slot, state);
  return true;
}

export async function renameSave(repo: SaveRepository, slot: SaveSlotId, prompts: SavePrompts) {
  const existing = (await repo.list()).find((item) => item.id === slot);
  if (!existing?.exists || slot === 'auto') throw new Error('不能重命名此存档');
  const label = prompts.prompt('输入新的存档名称（最多24个字）', existing.label);
  if (label === null) return false;
  if (!label.trim()) throw new Error('存档名称不能为空');
  await repo.rename(slot, label);
  return true;
}

export async function deleteSave(repo: SaveRepository, slot: SaveSlotId, prompts: SavePrompts) {
  if (slot === 'auto') throw new Error('自动存档不能手动删除');
  const existing = (await repo.list()).find((item) => item.id === slot);
  if (!existing?.occupied && !existing?.exists) throw new Error('存档不存在');
  if (!prompts.confirm(`确定删除“${existing.label}”吗？此操作无法撤销。`)) return false;
  await repo.delete(slot);
  return true;
}

export async function loadSave(repo: SaveRepository, slot: SaveSlotId, current: GameState | null, dirty: boolean, prompts: SavePrompts) {
  const summary = (await repo.list()).find((item) => item.id === slot);
  if (summary?.recovered && !prompts.confirm('自动存档损坏或缺失，是否尝试读取上一份有效备份？')) return null;
  // 先捕获目标，避免“保存当前进度”覆盖正在选择的自动存档。
  const restored = await repo.load(slot);
  if (!restored) throw new Error('存档损坏、不兼容或已不存在，请选择其他存档');
  if (current && dirty) {
    if (prompts.confirm('当前进度尚未成功保存。是否先保存到自动存档再读取所选存档？')) {
      await repo.save('auto', current);
    } else if (!prompts.confirm('确定不保存当前进度，直接读取所选存档吗？')) return null;
  }
  return restored;
}

// 仅用于同一次运行中的地图往返，不替代持久化存档。
let sceneReturn: GameState | null = null;
export function rememberSceneReturn(state: GameState) { sceneReturn = structuredClone(state); }
export function consumeSceneReturn() { const state = sceneReturn; sceneReturn = null; return state; }

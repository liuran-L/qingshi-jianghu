import type { GameState, GrowthNodeId, GrowthState, InteractionRequest, LimitedActionId } from './types.ts';
import type { RuleResolution } from './interaction-rules.ts';
import type { LimitedAction } from './limited-actions.ts';

const emptyTree = () => ({ unlocked: false, unlockedAt: null, pointAwardedAt: null, availablePoints: 0 as const, nodes: [] as GrowthNodeId[] });
export const initialGrowth = (): GrowthState => ({ schema: 1, menu: false, step: emptyTree(), medicine: emptyTree() });
export const hasGrowthNode = (state: GameState, node: GrowthNodeId) => state.growth.step.nodes.includes(node) || state.growth.medicine.nodes.includes(node);

const blocked = (state: GameState) => !state.player.alive || state.gatePhase === 'detained' || Boolean(state.prologueEnding);
const action = (id: LimitedActionId, label: string, input: string, mode: 'action' | 'speech' = 'action'): LimitedAction => ({ id, label, input, mode });
const luEligible = (state: GameState) => state.locationId === 'inn' && state.selectedNpcId === 'lu-guanlan' && state.growth.step.unlocked && state.growth.step.pointAwardedAt === null && state.player.injury !== '重伤' && state.player.fatigue < 85 && state.npcStates['lu-guanlan'].suspicion < 3;
const shenEligible = (state: GameState) => state.locationId === 'clinic' && state.selectedNpcId === 'shen-yanqiu' && state.growth.medicine.unlocked && state.growth.medicine.pointAwardedAt === null && state.player.fatigue < 90;

export function growthEntry(state: GameState): LimitedAction[] {
  if (blocked(state) || state.dayOne.menu || state.dayTwo.menu || state.growth.menu) return [];
  return [action('open-growth', '查看成长线索', '我整理一路实际学到的手法与尚未成形的门路。')];
}
export function growthActions(state: GameState): LimitedAction[] {
  if (blocked(state)) return [];
  const choices: LimitedAction[] = [];
  if (luEligible(state)) choices.push(action('practice-lu', '请陆观澜正式指点步法（60分钟）', '我按你方才所说练一遍，请你当面纠正脚下。'));
  if (shenEligible(state)) choices.push(action('study-shen', '协助沈砚秋辨认创口（45分钟）', '我愿按你的吩咐辨认药性和创口，请你指出错处。'));
  if (state.growth.step.availablePoints) {
    if (!hasGrowthNode(state, 'step-foundation')) choices.push(action('spend-step-foundation', '投入步法点：基础步法', '我把这次脚下体会落实为基础步法。'));
    if (hasGrowthNode(state, 'step-foundation') && !hasGrowthNode(state, 'step-breath')) choices.push(action('spend-step-breath', '投入步法点：调息赶路', '我把调息法门融入赶路的步子。'));
  }
  if (state.growth.medicine.availablePoints) {
    if (!hasGrowthNode(state, 'medicine-diagnosis')) choices.push(action('spend-medicine-diagnosis', '投入医术点：基础辨伤', '我把辨认创口的要点记牢。'));
    if (hasGrowthNode(state, 'medicine-diagnosis') && !hasGrowthNode(state, 'medicine-bandage')) choices.push(action('spend-medicine-bandage', '投入医术点：基础包扎', '我把压迫包扎的手法练熟。'));
  }
  return [...choices, action('close-growth', '返回当前场景选项', '先回到眼前的事。')];
}

export function resolveGrowth(state: GameState, request: InteractionRequest): RuleResolution | null {
  switch (request.actionId) {
    case 'open-growth': case 'close-growth': case 'spend-step-foundation': case 'spend-step-breath': case 'spend-medicine-diagnosis': case 'spend-medicine-bandage': return { timeCostMinutes: 0 };
    case 'practice-lu': return luEligible(state) ? { timeCostMinutes: 60, narration: '陆观澜只纠正重心、换步和收势。你练得伤口发紧，却也把一套可验证的脚下规矩记住；这次正式指点只给一枚步法点。' } : null;
    case 'study-shen': return shenEligible(state) ? { timeCostMinutes: 45, narration: '沈砚秋让你辨认创缘和药渣，再逐项指出误处。所得只是入门辨伤的规矩，不是诊金、病案或完整医术。' } : null;
    default: return null;
  }
}

export function applyGrowth(before: GameState, state: GameState, request: InteractionRequest): GameState {
  const g = { ...state.growth, step: { ...state.growth.step, nodes: [...state.growth.step.nodes] }, medicine: { ...state.growth.medicine, nodes: [...state.growth.medicine.nodes] } };
  const unlockStep = state.dayOne.guidanceSeed && state.npcStates['lu-guanlan'].memory.evidence.includes('stance-observation');
  const unlockMedicine = state.dayOne.interview !== 'none' && (state.dayOne.consent !== 'none' || state.economy.medicalWorkAt !== null || state.player.injury === '无');
  if (unlockStep && !g.step.unlocked) { g.step.unlocked = true; g.step.unlockedAt = state.worldMinutes; }
  if (unlockMedicine && !g.medicine.unlocked) { g.medicine.unlocked = true; g.medicine.unlockedAt = state.worldMinutes; }
  if (request.actionId === 'open-growth') g.menu = true;
  if (request.actionId === 'close-growth') g.menu = false;
  if (request.actionId === 'practice-lu' && g.step.pointAwardedAt === null) { g.step.pointAwardedAt = state.worldMinutes; g.step.availablePoints = 1; }
  if (request.actionId === 'study-shen' && g.medicine.pointAwardedAt === null) { g.medicine.pointAwardedAt = state.worldMinutes; g.medicine.availablePoints = 1; }
  const spend = (tree: 'step' | 'medicine', node: GrowthNodeId, prerequisite?: GrowthNodeId) => {
    const target = g[tree];
    if (target.availablePoints !== 1 || target.nodes.includes(node) || (prerequisite && !target.nodes.includes(prerequisite))) return;
    target.nodes.push(node); target.availablePoints = 0;
  };
  if (request.actionId === 'spend-step-foundation') spend('step', 'step-foundation');
  if (request.actionId === 'spend-step-breath') spend('step', 'step-breath', 'step-foundation');
  if (request.actionId === 'spend-medicine-diagnosis') spend('medicine', 'medicine-diagnosis');
  if (request.actionId === 'spend-medicine-bandage') spend('medicine', 'medicine-bandage', 'medicine-diagnosis');
  return { ...state, growth: g };
}

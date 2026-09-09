import type { LimitedAction } from '../game/limited-actions.ts';

export type ActionTab = '眼前' | '谋生' | '修习' | '旧事';

export const actionTabOf = (id: string): ActionTab => /journey-(work:|pledge:)/.test(id)
  ? '谋生'
  : /journey-(train:|lesson:|teach:|node:|arts:)/.test(id)
    ? '修习'
    : /journey-(break|debt|medical-debt|amends|rumors)$/.test(id)
      ? '旧事'
      : '眼前';

/** 仅收纳没有即时重大代价的本地察看；推进时间、立场、风险和关键抉择始终直列。 */
export function secondaryAction(action: LimitedAction, inCampaign: boolean): boolean {
  return !inCampaign && /^(ask-name|ask-news|ask-local-news|observe-(?:gate|inn|clinic|scene)|inspect-(?:wound|bag|fragment))$/.test(action.id);
}

export function partitionActions(actions: LimitedAction[], inCampaign: boolean) {
  return {
    primary: actions.filter((item) => !secondaryAction(item, inCampaign)),
    secondary: actions.filter((item) => secondaryAction(item, inCampaign)),
  };
}

/** 当前状态所有标签中最大的顶层按钮数；二级探索收纳器按一个按钮计。 */
export function actionSlotCapacity(actions: LimitedAction[], inCampaign: boolean): number {
  const counts = (inCampaign ? (['眼前', '谋生', '修习', '旧事'] as const).map((tab) => actions.filter((item) => actionTabOf(item.id) === tab)) : [actions])
    .map((items) => {
      const parts = partitionActions(items, inCampaign);
      return parts.primary.length + (parts.secondary.length ? 1 : 0);
    });
  return Math.max(1, ...counts);
}

/** 会话内只增不减，选项完成后不会把下面内容突然向上拉。 */
export function reserveActionSlots(previous: number, actions: LimitedAction[], inCampaign: boolean): number {
  return Math.max(previous, actionSlotCapacity(actions, inCampaign));
}

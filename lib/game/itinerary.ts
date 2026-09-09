import type { GameState } from './types.ts';
import { campaignActive, campaignDay, dayAt, upcomingEvent } from './campaign.ts';
import { storyEvents, routeNames } from './campaign-content.ts';
import type { LifeRoute } from './campaign-types.ts';
export function itinerary(s: GameState) {
  const c = s.campaign, day = campaignDay(s);
  if (!s.player.alive || c.ending) return { appointment: '这一程已经结束，可读档或回看。', deadline: null, routes: [] };
  if (!campaignActive(s)) return { appointment: '先处理眼前的伤势、身份与落脚处；已知线索可在历史中查阅。', deadline: null, routes: [] };
  const e = upcomingEvent(s), current = e && s.worldMinutes >= dayAt(s, e.day);
  const endDay = e ? storyEvents[storyEvents.indexOf(e) + 1]?.day ?? 58 : 60;
  const appointment = e ? current ? `当前可赴约：${c.activeEvent === e.id ? e.title : '当地来信所指的现场'}。` : `第 ${e.day} 日有下一次当地消息；事情尚未发生。` : '第 58–60 日可整理此生去向，不必所有方向都满足。';
  const routes = (Object.keys(routeNames) as LifeRoute[]).map(route => {
    const missing: string[] = [];
    if (c.scores[route] < 4) missing.push(`实践：还需 ${4 - c.scores[route]} 次`);
    if (route === 'office') { if (!s.player.hasRoadPass) missing.push('身份：缺路引'); if (c.wanted >= 4) missing.push('追查：需低于四级'); if (!c.evidence.includes('official')) missing.push('证据：缺可核验的官面材料'); }
    if (route === 'trade') { if (s.player.money < 12) missing.push(`资源：周转金还差 ${12 - s.player.money} 两`); if (!c.flags.includes('guild-founded')) missing.push('门路：尚未建立持续经营的转运行'); }
    if (route === 'xia' && !c.flags.includes('assembly-won') && !c.flags.includes('civil-order')) missing.push('经历：尚缺公开议事或乡民互保实践');
    if (route === 'shadow') { if (!c.flags.includes('waterway')) missing.push('门路：缺已走通的水路'); if (c.evidence.length < 2) missing.push(`证据：还需 ${2 - c.evidence.length} 类实际材料`); }
    if (route === 'healer') { if (!c.evidence.includes('medicine')) missing.push('证据：缺可核验的用药记录'); if (!c.trained.healer) missing.push('技能：还需一次医术研习'); }
    const learning = ({xia:'武学',trade:'口才',shadow:'轻功',office:'洞察',healer:'医术'}[route]) + '：' + (c.trained[route] >= 3 ? '属性研习已到本篇上限' : [c.experience[route] < 2 ? `阅历还差 ${2 - c.experience[route]} 点` : '阅历足够', s.player.money < 3 ? `银两还差 ${3 - s.player.money}` : '需花三两', c.lastTrainDay === day ? '今日已训练，次日再练' : '需四小时'].join('；'));
    return { route, name: routeNames[route], missing, learning };
  });
  return { appointment, deadline: e ? `窗口在第 ${endDay} 日 09:00 失效（行动完成也须早于该时刻）；赶路与训练会占用时间。` : '最迟第 60 日 23:59 作出最后选择。', routes };
}

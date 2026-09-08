import type { GameState } from '../game/types.ts';
import type { LimitedAction } from '../game/limited-actions.ts';
import { campaignActive, dayAt, upcomingEvent } from '../game/campaign.ts';
import { getLocation } from '../game/world.ts';
import { isDayTwo } from '../game/day-two.ts';

export interface SceneGuidance { id: string; text: string; urgent: boolean }

function hasEffectiveExploration(state: GameState, actions: LimitedAction[]): boolean {
  return actions.some((action) => {
    if (/^journey-(attend:|choose:|leave:|battle:)/.test(action.id)) return true;
    if (action.id === 'open-dayone') return (state.locationId === 'clinic' && state.player.injury !== '无') || (state.locationId === 'inn' && state.dayOne.registration === 'none') || (state.locationId === 'gate' && !state.gateAccess);
    if (['open-daytwo', 'request-entry', 'present-gate-document', 'show-gate-fragment', 'submit-search', 'request-review', 'request-treatment', 'ask-corpse', 'compare-corpse-wound', 'inspect-wound', 'inspect-bag', 'inspect-fragment', 'observe-gate', 'mention-ding17', 'accept-broker-contact', 'decline-report'].includes(action.id)) return true;
    if (action.id === 'observe-inn') return !state.playerKnownFactIds.includes('inn-arrival-inquiry');
    if (action.id === 'ask-news') return state.triggeredWorldEventIds.includes('nameless-corpse') && !state.playerKnownFactIds.includes('inn-corpse-rumor');
    return false;
  });
}

/** 最多给两条叙事内去向；有仍会产出新状态的眼前行动时不抢答。 */
export function sceneGuidance(state: GameState, actions: LimitedAction[]): SceneGuidance[] {
  if (!state.player.alive || state.campaign.ending || hasEffectiveExploration(state, actions)) return [];
  const items: SceneGuidance[] = [];
  const add = (id: string, text: string, urgent = false) => {
    if (!items.some((item) => item.id === id)) items.push({ id, text, urgent });
  };

  if (state.gatePhase === 'detained') {
    add('review', actions.some((action) => action.id === 'request-review')
      ? '扣留记录仍在城门值房。可以请当值总捕头逐条复核口供、经手人与暂扣物。'
      : '人和物都被留在城门一侧，眼下只能保存记录，等待复核机会。', true);
    return items;
  }

  if (state.player.injury !== '无') {
    add('injury', state.knownLocationIds.includes('clinic') && state.gateAccess
      ? '血还没有止稳。地图上记着回春堂；验伤范围、诊金与布条去留仍由你当面决定。'
      : '伤口仍在渗血。先从眼前人的说法里问清医馆方向与进城规矩。', true);
  }

  const movingLead = state.playerKnownFactIds.some((id) => ['inn-arrival-inquiry', 'day-end-watch-rumor', 'next-morning-moving-lead'].includes(id));
  if (movingLead && isDayTwo(state)) {
    const knownPlace = state.knownLocationIds.includes('dock') ? '码头' : state.knownLocationIds.includes('inn') ? '悦来客栈' : '城门';
    add('moving-lead', `昨夜问话者会换人、换船或换落脚处。${knownPlace}是你已经记下、可以重新核对人证与时序的地方；晚去只会看到变化后的痕迹。`, true);
  }

  if (state.playerKnownFactIds.includes('inn-corpse-rumor') && !state.playerKnownFactIds.includes('clinic-corpse-details') && state.knownLocationIds.includes('clinic')) {
    add('corpse', '客栈传闻只到“人被送去回春堂”为止。若要知道伤口与身份线索，医馆是可核对的去处。', true);
  }

  if (campaignActive(state)) {
    const event = upcomingEvent(state);
    if (event) add('letter', state.worldMinutes >= dayAt(state, event.day)
      ? `来信所指的动静已经发生在${getLocation(event.location).name}；现场会随时间推移，不会替你保留原样。`
      : `下一封来信尚未到。地图上的已知地点仍可谋生、疗伤或核对旧记录，江湖日志留着此前的时序。`);
  } else if (state.locationId === 'gate' && state.gateAccess) {
    if (state.knownLocationIds.includes('inn')) add('lodging', '城门已经让开。悦来客栈是已知的落脚处，也能留下可供次日回查的登记。');
    else add('map', '城门已经让开。地图只列你确实知道的地方；先去其中一处落脚或问路。');
  } else if (state.locationId !== 'inn' && state.knownLocationIds.includes('inn') && !state.lodgingRecords.length) {
    add('lodging', '天色与疲劳都在往前走。悦来客栈是已知落脚处；登记姓名和房钱会留下各自的后果。');
  } else {
    add('records', '眼前暂时没有新的可核查之物。地图、江湖日志以及已知人物和地点仍保留此前的方向。');
  }

  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent)).slice(0, 2);
}

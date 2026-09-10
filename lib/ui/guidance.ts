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
      ? '你和暂扣物都留在城门一侧。可以请当值总捕头逐条复核口供与经手人。'
      : '你被留在城门墙边，暂时走不了；值房还没有来人接手。', true);
    return items;
  }

  if (state.player.injury !== '无') {
    add('injury', state.knownLocationIds.includes('clinic') && state.gateAccess
      ? '血还没有止稳。地图上记着回春堂；拆不拆布、旧布条留给谁，都可当面说清。'
      : '伤口仍在渗血。先问清医馆方向，也得设法过城门。', true);
  }

  const movingLead = state.playerKnownFactIds.some((id) => ['inn-arrival-inquiry', 'day-end-watch-rumor', 'next-morning-moving-lead'].includes(id));
  if (movingLead && isDayTwo(state)) {
    const knownPlace = state.knownLocationIds.includes('dock') ? '码头' : state.knownLocationIds.includes('inn') ? '悦来客栈' : '城门';
    add('moving-lead', `昨夜打听你的人今早要换船、换落脚处。${knownPlace}是你认得的去处；再迟些，那里留下的只会是换过班的人与旧脚印。`, true);
  }

  if (state.playerKnownFactIds.includes('inn-corpse-rumor') && !state.playerKnownFactIds.includes('clinic-corpse-details') && state.knownLocationIds.includes('clinic')) {
    add('corpse', '酒客只知道担架进了回春堂。要看伤口、问体貌，只能去找验过尸身的医者。', true);
  }

  if (campaignActive(state)) {
    const event = upcomingEvent(state);
    if (event) add('letter', state.worldMinutes >= dayAt(state, event.day)
      ? `信里提到的动静已经出现在${getLocation(event.location).name}。人会走，现场也不会一直留着原样。`
      : '眼下没有新信。你仍可谋生、疗伤，或去旧地方问问留下的人。');
  } else if (state.locationId === 'gate' && state.gateAccess) {
    if (state.knownLocationIds.includes('inn')) add('lodging', '城门已经让开。悦来客栈可以落脚，房簿也会记下你报出的姓名。');
    else add('map', '城门已经让开。地图上只画着你问到的去处，先选一处落脚或问路。');
  } else if (state.locationId !== 'inn' && state.knownLocationIds.includes('inn') && !state.lodgingRecords.length) {
    add('lodging', '天色与疲劳都在往前走。悦来客栈是已知落脚处；登记姓名和房钱会留下各自的后果。');
  } else {
    add('records', '眼前暂时没有新痕迹。可以翻看地图与旧事，或换个认得的地方走走。');
  }

  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent)).slice(0, 2);
}

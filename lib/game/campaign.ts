import { battles, battleContext, battleEnabled, battlePreview, battleLabel, battlePresentation, judgeBattle, tacticNames, type BattleTactic } from './battle.ts';
import { artActions, settleArtAction, hasArt, artTrainingBlock } from './arts.ts';
import { totalArtPoints } from './arts-content.ts';
import type { GameState, LimitedActionId, DialogueLine } from './types.ts';
import type { CampaignState, LifeRoute, LifeEnding, StoryChoice, StoryEffect, StoryEvent } from './campaign-types.ts';
import type { LimitedAction } from './limited-actions.ts';
import { advanceGameTime } from './engine.ts';
import { changeNpcRelationship } from './npc-memory.ts';
import { coreNames, evidenceNames, firstActPreludes, routeNames, storyEvents } from './campaign-content.ts';

export const lifeRoutes = Object.keys(routeNames) as LifeRoute[];
const zeroRoutes = () => ({ xia: 0, trade: 0, shadow: 0, office: 0, healer: 0 });
export const initialCampaign = (): CampaignState => ({ schema: 1, startedAt: null, origin: null, prologueRecord: null, extraLessons: { step: 0, medicine: 0 }, scores: zeroRoutes(), experience: zeroRoutes(), trained: zeroRoutes(), pledge: null, wanted: 0, debt: 0, flags: [], evidence: [], npcAlive: Object.fromEntries(Object.keys(coreNames).map(id => [id, true])), resolved: {}, activeEvent: null, lastWorkDay: null, lastTrainDay: null, finale: null, finaleStep: 0, ending: null, endedAt: null, journal: [] });
export const campaignDay = (s: GameState) => Math.floor((s.worldMinutes - s.storyStartedAtMinutes + 1020) / 1440) + 1;
export const dayAt = (s: GameState, day: number) => s.storyStartedAtMinutes + (day - 1) * 1440 - 480;
export const campaignDeadline = (s: GameState) => dayAt(s, 60) + 14 * 60 + 59;
export const campaignActive = (s: GameState) => s.campaign?.startedAt !== null && s.campaign?.startedAt !== undefined;
export const gameEnded = (s: GameState) => !!s.campaign?.ending || !!s.prologueEnding;
const has = (s: GameState, flag: string) => s.campaign.flags.includes(flag);
const fresh = (s: GameState): GameState => ({ ...s, player: { ...s.player, abilities: { ...s.player.abilities } }, campaign: structuredClone(s.campaign) });
function tell(s: GameState, text: string, speaker = '旁白', kind: DialogueLine['kind'] = 'narration', npcId?: string): GameState {
  const tones: Record<string, string> = { 'ma-sandao': '审视', 'su-wantang': '话留三分', 'gu-qinghe': '克制', 'ning-buping': '沉声', 'qiao-wu': '笑里藏锋', 'shen-yanqiu': '平缓', 'yue-hansheng': '气息微弱', 'lu-guanlan': '收起笑意' };
  const parts = text.match(/[^。！？\n]+[。！？]?[”」]?/gu) ?? [text];
  const entries: DialogueLine[] = parts.filter(t => t.trim()).map((t, i) => ({ id: `journey:${s.worldMinutes}:${s.dialogue.length + i}`, speaker, text: t, kind, ...(npcId ? { portraitId: npcId } : {}), tone: kind === 'npc' ? tones[npcId ?? ''] ?? '交谈' : kind === 'player' ? '你的选择' : '叙述' }));
  return { ...s, dialogue: [...s.dialogue, ...entries] };
}
const campaignNameDisclosure: Record<string, string> = {
  'ma-sandao': '复核簿当众点到守门差役的姓名：马三刀。',
  'su-wantang': '搬货伙计当面唤她“苏晚棠”，她应了一声。',
  'ning-buping': '佩刀汉子先报姓名：“宁不平，负责此处查验。”',
  'qiao-wu': '河上脚夫替他让路，招呼道：“乔五爷，船位留着。”',
  'shen-yanqiu': '医者把署着“沈砚秋”的药牌放回案头。',
  'yue-hansheng': '老者先报了姓名：“岳寒声。”',
  'lu-guanlan': '送来的名帖写着“陆观澜”，负剑客接过后没有否认。',
  'gu-qinghe': '书吏当面称他“顾清河大人”，姓名与官署名册相合。',
};
const action = (id: string, label: string, disabledReason?: string, hint?: string, details?: string): LimitedAction => ({
  id: `journey-${id}`, label, input: label, mode: 'action',
  ...(disabledReason ? { disabledReason } : {}), ...(hint ? { hint } : {}), ...(details ? { details } : {}),
});
const firstActAttendLabels:Record<string,string>={
  temple:'去城外破庙，看看药渣与脚印', assassin:'应县衙告示，进廊作证', inheritance:'回客栈看青岳门讣帖',
  fire:'赶去码头木账房', identity:'到城门复核姓名',
};
const stamp = (s: GameState, id: string, text: string, money = 0, debt = 0) => {
  s.campaign.journal.push({ at: s.worldMinutes, action: id, money, debt, text });
  s.logs = [...s.logs, { id: `journey-log:${s.worldMinutes}:${s.logs.length}`, atMinutes: s.worldMinutes, type: 'system', text }];
};
function gain(s: GameState, route: LifeRoute, amount = 1) {
  s.campaign.scores[route] += amount;
  s.campaign.experience[route] += amount;
  if (route === 'xia' || route === 'healer') s.player.chivalry += amount;
  if (route === 'shadow') s.player.infamy += amount;
  s.player.reputation += amount;
}
function effects(s: GameState, e: StoryEffect, id: string): GameState {
  let next = fresh(s);
  const c = next.campaign;
  if (e.route) gain(next, e.route);
  next.player.money += e.money ?? 0;
  c.wanted = Math.max(0, Math.min(10, c.wanted + (e.wanted ?? 0)));
  c.flags = [...new Set([...c.flags, ...(e.flags ?? [])])];
  c.evidence = [...new Set([...c.evidence, ...(e.evidence ?? [])])];
  for (const dead of e.dead ?? []) c.npcAlive[dead] = false;
  if (e.pass) next.player.hasRoadPass = true;
  if (e.help) next = changeNpcRelationship(next, e.help, `journey:${id}:help`, { trust: 2, attitude: 1, favor: 1 });
  if (e.harm) next = changeNpcRelationship(next, e.harm, `journey:${id}:harm`, { trust: -2, suspicion: 2, hostility: 1 });
  return next;
}
export function endLife(s: GameState, ending: LifeEnding): GameState {
  if (s.campaign.ending) return s;
  const next = fresh(s);
  next.campaign.ending = ending;
  next.campaign.endedAt = next.worldMinutes;
  next.campaign.activeEvent = null;
  stamp(next, `ending:${ending}`, `这一程写到末页：${endingTitles[ending]}。`);
  return tell(next, lifeSummary(next)!.facts.join('\n'));
}

/** 时钟写入口调用；不在渲染、读档或场景切换时重放事件。 */
export function settleCampaign(s: GameState): GameState {
  if (!campaignActive(s) || s.campaign.ending) return s;
  if (!s.player.alive) return endLife(s, 'dead');
  let next = s;
  for (let i = 0; i < storyEvents.length; i++) {
    const event = storyEvents[i];
    const deadline = dayAt(next, storyEvents[i + 1]?.day ?? 58);
    if (next.campaign.resolved[event.id] || next.worldMinutes < deadline) continue;
    next = effects(next, event.missed.effect, `${event.id}:missed`);
    next.campaign.resolved[event.id] = { choice: 'missed', at: deadline, text: event.missed.text, witnessed: false };
    if (next.campaign.activeEvent === event.id) {
      next.campaign.activeEvent = null;
      next = tell(next, '你离开后，现场的机会已过去。想知道后来的消息，可向行旅打听。');
    }
  }
  if (next.worldMinutes >= dayAt(next, 6) && !has(next, 'yue-safe') && next.campaign.npcAlive['yue-hansheng']) {
    next = fresh(next); next.campaign.npcAlive['yue-hansheng'] = false;
  }
  if (next.worldMinutes >= campaignDeadline(next)) return endLife(next, next.campaign.wanted >= 6 ? 'prison' : 'retired');
  return next;
}
export function upcomingEvent(s: GameState): StoryEvent | undefined {
  return storyEvents.find(event => !s.campaign.resolved[event.id]);
}
export function canChooseStory(s: GameState, choice: StoryChoice): boolean {
  const n = choice.need;
  return !n || ((!n.ally || s.campaign.npcAlive[n.ally] && s.npcStates[n.ally].trust >= 4 && s.npcStates[n.ally].hostility < 3) && (!n.node || hasArt(s, n.node)) && s.player.money >= (n.money ?? 0) && (!n.flag || has(s, n.flag)) && (!n.evidence || s.campaign.evidence.includes(n.evidence)) && (!n.route || s.campaign.scores[n.route] >= (n.score ?? 1)));
}
const mainProof = (s: GameState) => ['official', 'transport', 'medicine'].every(id => s.campaign.evidence.includes(id));
export function routeQualification(s: GameState, route: LifeRoute): string | null {
  const c = s.campaign;
  if (c.scores[route] < 4) return `至少四次${routeNames[route]}实践`;
  if (route === 'office' && (!s.player.hasRoadPass || c.wanted >= 4 || !c.evidence.includes('official'))) return '需路引、真档副本且追查低于四级';
  if (route === 'trade' && (!has(s, 'guild-founded') || s.player.money < 12)) return '需平价转运行与十二两周转金';
  if (route === 'xia' && (!has(s, 'assembly-won') && !has(s, 'civil-order'))) return '需公议问责或乡民互保';
  if (route === 'shadow' && (!has(s, 'waterway') || c.evidence.length < 2)) return '需水道门路与两类筹码';
  if (route === 'healer' && (!c.evidence.includes('medicine') || c.trained.healer < 1)) return '需药库记录与一次医术研习';
  return null;
}
export function conflictPreview(s: GameState) {
  const p = battlePreview(s, 'finale', 'attack');
  return { ...p, allies: battleContext(s, 'finale').allies.length };
}

export function campaignActions(s: GameState): LimitedAction[] {
  const c = s.campaign;
  if (!s.player.alive || c?.ending || s.gatePhase === 'detained') return [];
  if (!campaignActive(s)) {
    if (s.gateAccess && !['questioning', 'answered', 'disputed'].includes(s.dayOne.review) && (s.prologueEnding || s.day3CargoStatus === 'departed')) return [action('begin', '继续这一生 · 盐路风云（保留全部经历）')];
    return [];
  }
  if (c.activeEvent) {
    const event = storyEvents.find(e => e.id === c.activeEvent)!;
    const battleActions = battles[event.id] ? (Object.keys(tacticNames) as BattleTactic[]).filter(t=>battleEnabled(s,event.id,t)).map(t=>{
      if(event.day<=8){const view=battlePresentation(s,event.id,t);return action(`battle:${event.id}:${t}`,view.title,undefined,view.hint,view.details);}
      return action(`battle:${event.id}:${t}`,battleLabel(s,event.id,t));
    }) : [];
    return [...battleActions, ...event.choices.filter(choice => !choice.id.startsWith('battle-') && canChooseStory(s, choice)).map(choice => action(`choose:${event.id}:${choice.id}`, choice.label, undefined, event.day<=8 ? choice.hint : undefined)), action(`leave:${event.id}`, event.day<=8?'离开现场':'暂离现场，承担缺席后果', undefined, event.day<=8?'你一走，本次现场不会等你。':undefined)];
  }
  if (c.finale) return finaleActions(s);
  const options: LimitedAction[] = [...artActions(s)];
  const event = upcomingEvent(s);
  const eventIndex = event ? storyEvents.indexOf(event) : -1;
  const openEventDeadline = event && s.worldMinutes >= dayAt(s, event.day) ? dayAt(s, storyEvents[eventIndex + 1]?.day ?? 58) : null;
  const prelude = event && firstActPreludes.find(item => item.eventId === event.id);
  if (event && prelude && s.worldMinutes >= dayAt(s, event.day - 1) && s.worldMinutes < dayAt(s, event.day) && !c.journal.some(entry => entry.action === `scout:${event.id}`)) {
    const tooLate = s.worldMinutes + prelude.minutes >= dayAt(s, event.day);
    const reason = tooLate ? '距事件窗口太近，已来不及完成这次布置。' : s.player.money < prelude.money ? `需${prelude.money}两，当前只有${s.player.money}两。` : undefined;
    options.push(action(`scout:${event.id}`, prelude.label, reason, prelude.hint));
  }
  if (event && s.worldMinutes >= dayAt(s, event.day)) options.push(action(`attend:${event.id}`, event.day<=8 ? firstActAttendLabels[event.id] : `前往 · ${event.title}（往返与交涉另计时）`));
  if (s.worldMinutes >= dayAt(s, 58)) {
    for (const route of lifeRoutes) if (!routeQualification(s, route)) options.push(action(`finale:${route}`, `为此生作结 · ${routeNames[route]}`));
    options.push(action('retire', '留在城中退隐，接受尚未解决的旧事'));
  }
  if (s.worldMinutes >= dayAt(s, 18) && c.wanted < 6) options.push(action('away', `远走他乡，结束此生篇章${c.debt ? '（旧债随行）' : ''}`));
  if (c.wanted >= 4) options.push(action('amends', `具名自首并做一日赈济（追查 -3，人情债 +4）`));
  if (s.player.injury !== '无' || s.player.poison !== '无' || s.player.health < 70) options.push(action('care', '请行脚医者清创调养（四两；不足记债，不产生验伤证据）'));
  options.push(action('rest', '借住歇息八小时（食宿一两；不足记债）'));
  if (c.lastWorkDay !== campaignDay(s)) {
    options.push(action('work:xia', `护送乡民（六小时，收入四两；侠行积累）`));
    options.push(action('work:trade', c.scores.trade >= 2 && s.player.money >= 3 ? '走一趟商货（六小时，本钱三两，按商誉结利）' : '替商号核货（六小时，收入五两）'));
    options.push(action('work:shadow', `夜取恶霸私库（六小时；${stealPreview(s).win ? '可取六两' : '手法不足：失手损血十二、追查 +2'}）`));
    if (c.wanted < 4 && s.npcStates['ning-buping'].hostility < 4) options.push(action('work:office', s.player.hasRoadPass && c.scores.office >= 3 ? '以衙役身份核仓（六小时，俸银六两）' : '协助公门抄册（六小时，收入三两）'));
    if (c.npcAlive['shen-yanqiu']) options.push(action('work:healer', '帮医馆分药照料病人（六小时，收入三两）'));
  }
  for (const route of lifeRoutes) {
    if (c.experience[route] >= 2 && c.trained[route] < 3 && c.lastTrainDay !== campaignDay(s) && s.player.money >= 3) options.push(action(`train:${route}`, `研习${routeNames[route]}（四小时、三两、两点阅历）`));
    if (!c.pledge && c.scores[route] >= 3 && c.npcAlive[patron[route]] && s.npcStates[patron[route]].trust >= 2 && s.npcStates[patron[route]].hostility < 3) options.push(action(`pledge:${route}`, `立约${routeNames[route]}（差事多得二两；转向须解约）`));
  }
  for (const [tree, route, name, nodeIds] of [['step', 'xia', '步法', ['step-foundation', 'step-breath']], ['medicine', 'healer', '医术', ['medicine-diagnosis', 'medicine-bandage']]] as const) {
    const growth = s.growth[tree];
    if (growth.pointAwardedAt === null && !artTrainingBlock(s, tree, true)) options.push(action(`teach:${tree}`, `请导师当面指点${name}（一小时、免费，首点）`));
    if (c.npcAlive[tree === 'step' ? 'lu-guanlan' : 'shen-yanqiu'] && totalArtPoints(s) < 7 && c.scores[route] >= 2 && growth.nodes.length < 2 && growth.availablePoints === 0 && c.extraLessons[tree] === 0 && c.lastTrainDay !== campaignDay(s) && s.player.money >= 3) options.push(action(`lesson:${tree}`, `重练${name}基础（六小时、三两，获得一点原有技能树点数）`));
    if (growth.availablePoints === 1) {
      const node = nodeIds[growth.nodes.length];
      if (node) options.push(action(`node:${node}`, `投入${name}点：${node === 'step-foundation' ? '基础步法' : node === 'step-breath' ? '调息赶路' : node === 'medicine-diagnosis' ? '基础辨伤' : '基础包扎'}`));
    }
  }
  if (c.pledge) options.push(action('break', `解除${routeNames[c.pledge]}约定（六两；不足记债，旧伙伴信任受损）`));
  if (s.player.injury !== '无' && s.growth.medicine.nodes.includes('medicine-bandage') && s.player.money >= 1 && s.dayOne.bleedingGraceMinutes < 30) options.push(action('bandage', '自行包扎（十五分钟、一两，缓解失血四小时；不治毒）'));
  if (c.debt > 0 && s.player.money > 0) options.push(action('debt', `偿还食宿、转向旧债（最多${Math.min(c.debt, s.player.money)}两）`));
  if (s.economy.medicalDebt && s.player.money >= 3) options.push(action('medical-debt', '补清序章三两诊金'));
  if (Object.values(c.resolved).some(r => !r.witnessed)) options.push(action('rumors', '向过路行旅打听已发生的消息（一刻钟）'));
  options.push(action('wait', event ? `安顿生活，等到下一封来信（最迟第${event.day}日；食宿每日一两）` : '安顿生活，等到清算之日（食宿每日一两）'));
  if (openEventDeadline === null) return options;
  const actionMinutes: Record<string, number> = {
    'journey-amends': 1440, 'journey-care': 60, 'journey-rest': 480,
    'journey-work:xia': 360, 'journey-work:trade': 360, 'journey-work:shadow': 360, 'journey-work:office': 360, 'journey-work:healer': 360,
    'journey-arts:mentor:step': 60, 'journey-arts:mentor:medicine': 60, 'journey-arts:mentor:martial': 60, 'journey-arts:mentor:speech': 60,
    'journey-arts:train:step': 240, 'journey-arts:train:medicine': 240, 'journey-arts:train:martial': 240, 'journey-arts:train:speech': 240,
    'journey-teach:step': 60, 'journey-teach:medicine': 60, 'journey-lesson:step': 360, 'journey-lesson:medicine': 360,
    'journey-bandage': 15, 'journey-rumors': 15,
    [`journey-attend:${event!.id}`]: 60,
  };
  return options.map(item => {
    const forfeits = item.id === 'journey-wait' || actionMinutes[item.id] !== undefined && s.worldMinutes + actionMinutes[item.id] >= openEventDeadline;
    return forfeits ? { ...item, hint: item.hint ?? '这项行动会越过眼前这次机会的时限，现场不会等你。' } : item;
  });
}
export const stealPreview = (s: GameState) => ({ win: s.player.abilities.agility + s.campaign.trained.shadow + (s.growth.step.nodes.includes('step-foundation') ? 1 : 0) >= 3 + Math.floor(s.campaign.wanted / 2) });
export const patron: Record<LifeRoute, string> = { xia: 'lu-guanlan', trade: 'su-wantang', shadow: 'qiao-wu', office: 'ning-buping', healer: 'shen-yanqiu' };
function pay(s: GameState, cost: number) {
  const paid = Math.min(cost, s.player.money);
  s.player.money -= paid;
  s.campaign.debt += cost - paid;
}
function elapse(s: GameState, minutes: number): GameState {
  let next = s;
  for (let left = minutes; left > 0 && next.player.alive && !next.campaign.ending; left -= 720) next = advanceGameTime(next, Math.min(720, left));
  return next;
}
function livingUntil(s: GameState, target: number): GameState {
  let next = s;
  while (next.worldMinutes < target && next.player.alive && !next.campaign.ending) {
    next = fresh(next);
    pay(next, 1);
    const chunk = Math.min(1440, target - next.worldMinutes);
    next = elapse(next, chunk);
    if (next.player.alive && !next.campaign.ending) {
      next = fresh(next);
      next.player.fatigue = Math.max(0, next.player.fatigue - Math.ceil(chunk / 30));
      if (next.player.injury === '无') next.player.health = Math.min(next.player.maxHealth, next.player.health + 4);
    }
  }
  return next;
}

/** 页面与自动测试共用；无合法按钮就不产生任何副作用。 */
export function applyCampaignAction(state: GameState, id: LimitedActionId): GameState {
  const choice = campaignActions(state).find(a => a.id === id);
  if (!choice || choice.disabledReason) return state;
  let next = fresh(state);
  const beforeMoney = next.player.money;
  const beforeDebt = next.campaign.debt;
  const aid = id.slice('journey-'.length);
  next = tell(next, choice.input, state.player.name, 'player', 'player');
  if (aid === 'begin') {
    next.campaign.startedAt = next.worldMinutes;
    next.campaign.origin = next.prologueEnding ?? 'missed';
    next.campaign.prologueRecord = { ending: next.prologueEnding, endedAt: next.saltCase.endedAt, stayPermitUntil: next.saltCase.stayPermitUntil, cargoStatus: next.day3CargoStatus };
    if (next.prologueEnding === 'sealed-salt') gain(next, 'office', 2);
    if (next.prologueEnding === 'fragment-transferred') gain(next, 'shadow');
    if (next.economy.innWorkAt !== null) gain(next, 'trade');
    if (next.economy.medicalWorkAt !== null) gain(next, 'healer');
    if (next.dayOne.guidanceSeed) gain(next, 'xia');
    next.campaign.wanted = next.dayOne.registrationDiscrepancy ? 1 : 0;
    next.prologueEnding = null;
    next.day3CargoStatus = next.worldMinutes - next.storyStartedAtMinutes >= 46 * 60 ? 'departed' : 'unloading';
    next.saltCase = { ...next.saltCase, endedAt: null, stayPermitUntil: null };
    next.dayOne = { ...next.dayOne, menu: false };
    next.dayTwo = { ...next.dayTwo, menu: false };
    next.growth = { ...next.growth, menu: false };
    next = tell(next, next.campaign.origin === 'night-ferry' ? '小渡在下游靠岸。你可以沿河谋生，也可以循着来信回县；离开过青石这件事，仍留在旁人记忆里。' : next.campaign.origin === 'sealed-salt' ? '盐引已经交存，收据仍在手里。接卷的差役翻过封条：“扣住一辆车，河上的船可还多着。”三日暂留期内，你还得补验身份。' : '第三日的船已经离岸，交出去的纸没有回来，错过的封验也已散场。沿盐路仍有活路，旧痕迹也仍能追。');
    next = tell(next, '这几日，往来人把零碎消息带进城：药铺伙计在破庙外见过新药渣，码头仍招短工，邻府商队也在问路。差事过日便揭，来信也有时辰；你若谋生、治伤或练功，日头一样会往前走。');
    next.knownLocationIds = ['gate', 'inn', 'clinic', 'dock', 'temple', 'yamen'];
    next.selectedNpcId = null;
    next = settleCampaign(next);
  } else if (aid.startsWith('scout:')) {
    const eventId = aid.slice('scout:'.length);
    const prelude = firstActPreludes.find(item => item.eventId === eventId)!;
    next.player.money -= prelude.money;
    next.campaign.flags = [...new Set([...next.campaign.flags, ...(prelude.flags ?? [])])];
    next = elapse(next, prelude.minutes);
    if (!next.campaign.ending && next.player.alive && !next.campaign.resolved[eventId]) {
      next = tell(next, prelude.activeSource);
    }
  } else if (aid.startsWith('attend:')) {
    const event = storyEvents.find(e => e.id === aid.split(':')[1])!;
    next = elapse(next, 60);
    if (!next.campaign.ending && !next.campaign.resolved[event.id]) {
      next.campaign.activeEvent = event.id;
      next.locationId = event.location;
      next.selectedNpcId = null;
      if (next.campaign.npcAlive[event.speaker] && next.npcKnowledge[event.speaker].knownName !== coreNames[event.speaker]) {
        next = tell(next, campaignNameDisclosure[event.speaker] ?? `${coreNames[event.speaker]}当面报出姓名。`);
        next.npcKnowledge = { ...next.npcKnowledge, [event.speaker]: { ...next.npcKnowledge[event.speaker], observed: true, matched: true, knownName: coreNames[event.speaker] } };
      }
      const prelude = firstActPreludes.find(item => item.eventId === event.id);
      if (prelude) next = tell(next, prelude.naturalSource);
      for (let i = 0; i < event.opening.length; i++) next = tell(next, event.opening[i], i === 1 && next.campaign.npcAlive[event.speaker] ? coreNames[event.speaker] : '旁白', i === 1 && next.campaign.npcAlive[event.speaker] ? 'npc' : 'narration', i === 1 && next.campaign.npcAlive[event.speaker] ? event.speaker : undefined);
    }
  } else if (aid.startsWith('choose:') || aid.startsWith('leave:')) {
    const [, eventId, optionId] = aid.split(':');
    const event = storyEvents.find(e => e.id === eventId)!;
    const option = event.choices.find(o => o.id === optionId);
    const duration = optionId === 'escort' && eventId === 'survivor' ? 3 * 1440 : eventId === 'roads' && option ? 2 * 1440 : 30;
    next = duration >= 1440 ? livingUntil(next, next.worldMinutes + duration) : elapse(next, duration);
    if (!next.campaign.ending && !next.campaign.resolved[eventId]) {
      next = effects(next, option?.effect ?? event.missed.effect, `${eventId}:${optionId ?? 'missed'}`);
      const text = option?.reply ?? event.missed.text;
      next.campaign.resolved[eventId] = { choice: optionId ?? 'missed', at: next.worldMinutes, text, witnessed: true };
      next.campaign.activeEvent = null;
      next = tell(next, text);
      const prelude = firstActPreludes.find(item => item.eventId === eventId);
      if (prelude) next = tell(next, prelude.aftermath);
      if (eventId === 'assassin' && option?.effect.flags?.includes('gu-safe')) {
        next.npcKnowledge = { ...next.npcKnowledge, 'gu-qinghe': { ...next.npcKnowledge['gu-qinghe'], observed: true, matched: true, knownName: '顾清河', knownIdentity: '青石县令' } };
        next = tell(next, '“顾清河。今日蒙你出手，这份情我记着。案卷里该写谁的名字，还得看谁留下了证据。”', '顾清河', 'npc', 'gu-qinghe');
      }
    }
  } else if (aid.startsWith('battle:')) {
    const [,event,tactic] = aid.split(':');
    next = performBattle(next,event,tactic as BattleTactic);
  } else if (aid.startsWith('work:')) {
    const route = aid.split(':')[1] as LifeRoute;
    const workDay = campaignDay(next);
    const stealing = stealPreview(next);
    const professional = route === 'trade' && next.campaign.scores.trade >= 2 && next.player.money >= 3;
    const capital = professional ? 3 : 0;
    if (next.player.money < capital) return state;
    next.player.money -= capital;
    next = elapse(next, 360);
    if (next.player.alive && !next.campaign.ending) {
      next.campaign.lastWorkDay = workDay;
      gain(next, route);
      let wage = route === 'trade' ? professional ? 8 + Math.min(4, next.campaign.trained.trade) : 5 : route === 'xia' ? 4 : route === 'shadow' ? 6 : route === 'office' && next.player.hasRoadPass && next.campaign.scores.office >= 3 ? 6 : 3;
      let text = { xia: '你把乡民送到渡口，按约收了护送工钱。刀没有出鞘，这一趟也算走完。', trade: '你核对货重、运价与交接人，钱款当面结清。账上多一笔收入，也多一个愿意再托货的人。', shadow: '你从恶霸私库带出碎银，夜路留下新风声。江湖记得你敢取，官府记得有人报失。', office: '你把仓数逐一抄验，未拿疑点冒充查实。公门付了这次差事的钱，日后也能查到你的签押。', healer: '你照药签分药、煎汤，又替几名病人换水。坐堂医逐一验过，才把三两工钱交给你。' }[route];
      if (route === 'shadow') {
        next.campaign.wanted = Math.min(10, next.campaign.wanted + (stealing.win ? 1 : 2));
        if (!stealing.win) { wage = 0; next.player.health = Math.max(0, next.player.health - 12); text = '你被守夜人截住，失手退走。没取到银钱，气血损失十二，追查增加二级；轻功与旧风声决定了这次失败。'; }
      }
      if (next.campaign.pledge === route && wage > 0) wage += 2;
      else if (next.campaign.pledge) {
        const old = next.campaign.pledge;
        next = changeNpcRelationship(next, patron[old], `journey:neglect:${workDay}`, { trust: -1, suspicion: 1 });
        text += `你尚有${routeNames[old]}约定，旧伙伴记下了这次另接差事。`;
      }
      if (route === 'trade' && next.npcStates['su-wantang'].trust >= 4 && next.npcStates['su-wantang'].hostility < 3) { wage += 2; text += '苏掌柜愿意替你担保交接，商誉让这趟多结二两。'; }
      next.player.money += wage;
      next = changeNpcRelationship(next, patron[route], `journey:work:${workDay}:${route}`, { trust: 1, attitude: 1 });
      next = tell(next, text);
    }
  } else if (aid.startsWith('arts:')) {
    if (!aid.startsWith('arts:learn:')) {
      const training = aid.startsWith('arts:train:');
      if (training) next.player.money -= 3;
      next = elapse(next, training ? 240 : 60);
    }
    if (!next.campaign.ending) {
      next = settleArtAction(next, id);
      next = tell(next, aid.startsWith('arts:learn:') ? '你把心力落在这门手法上。往后遇到合适处境，自可决定是否使用。' : '导师照着你做过的动作逐一纠正，今日这番练习也记进了成长账。');
    }
  } else if (aid.startsWith('teach:')) {
    const tree = aid.split(':')[1] as 'step' | 'medicine';
    next = elapse(next, 60);
    if (!next.campaign.ending) {
      const old = next.growth[tree];
      next.growth = { ...next.growth, [tree]: { ...old, unlocked:true, unlockedAt:old.unlockedAt??next.worldMinutes, pointAwardedAt:next.worldMinutes, availablePoints:1 } };
      next.campaign.lastTrainDay=campaignDay(next);
      next=tell(next, '你把先前做过的动作重练一遍，导师当面纠正。这一回不收银两，只看你肯不肯沉下心。');
    }
  } else if (aid.startsWith('lesson:')) {
    const tree = aid.split(':')[1] as 'step' | 'medicine';
    next.player.money -= 3;
    next = elapse(next, 360);
    if (!next.campaign.ending) {
      const old = next.growth[tree];
      if (old.pointAwardedAt !== null) next.campaign.extraLessons[tree] = 1;
      next.growth = { ...next.growth, [tree]: { ...old, unlocked: true, unlockedAt: old.unlockedAt ?? next.worldMinutes, pointAwardedAt: old.pointAwardedAt ?? next.worldMinutes, availablePoints: 1 } };
      next.campaign.lastTrainDay = campaignDay(next);
      next = tell(next, '你在导师当面纠正下重练基础动作，逐项改正实践中的错处。记下一点技能树点数，待自己决定投入；已学节点仍然有效。', tree === 'step' ? '陆观澜' : '沈砚秋', 'npc', tree === 'step' ? 'lu-guanlan' : 'shen-yanqiu');
    }
  } else if (aid.startsWith('node:')) {
    const node = aid.slice(5) as 'step-foundation' | 'step-breath' | 'medicine-diagnosis' | 'medicine-bandage';
    const tree = node.startsWith('step-') ? 'step' : 'medicine';
    next.growth = { ...next.growth, [tree]: { ...next.growth[tree], availablePoints: 0, nodes: [...next.growth[tree].nodes, node] } };
    next = tell(next, '你把练习所得用在这项技艺上。点数已投入，以后行路或辨伤时便按这项本事结算。');
  } else if (aid.startsWith('train:')) {
    const route = aid.split(':')[1] as LifeRoute;
    next.player.money -= 3;
    next = elapse(next, 240);
    if (next.player.alive && !next.campaign.ending) {
      next.campaign.experience[route] -= 2;
      next.campaign.trained[route]++;
      next.campaign.lastTrainDay = campaignDay(next);
      const ability = { xia: 'martial', trade: 'eloquence', shadow: 'agility', office: 'insight', healer: 'medicine' } as const;
      next.player.abilities[ability[route]]++;
      next = tell(next, `你把${routeNames[route]}实践中的失误逐一重做，耗去三两纸墨器材钱和两点阅历。四小时没有白过，技艺精进一级；这一门最多研习三级。`);
    }
  } else if (aid.startsWith('pledge:')) {
    const pledgedRoute = aid.split(':')[1] as LifeRoute;
    next.campaign.pledge = pledgedRoute;
    const npcId = patron[pledgedRoute];
    if (next.npcKnowledge[npcId].knownName !== coreNames[npcId]) next = tell(next, campaignNameDisclosure[npcId] ?? `${coreNames[npcId]}当面报出姓名。`);
    next.npcKnowledge = { ...next.npcKnowledge, [npcId]: { ...next.npcKnowledge[npcId], observed: true, matched: true, knownName: coreNames[npcId] } };
    next = tell(next, `你与${coreNames[npcId]}立下${routeNames[pledgedRoute]}约定。额外工钱对应优先出力的义务；想转向，可以明说解约，不能抹去旧约。`);
  } else if (aid === 'break') {
    const old = next.campaign.pledge!;
    pay(next, 6); next.campaign.pledge = null;
    next = changeNpcRelationship(next, patron[old], `journey:break:${next.campaign.journal.length}`, { trust: -3, favor: -2, suspicion: 1 });
    next = tell(next, '你把换人的路费和空下的差事认在自己账上。约解了，过去学过的本事还在；旧伙伴也仍记得你如何离开。');
  } else if (aid === 'amends') {
    next = elapse(next, 1440);
    if (!next.campaign.ending) { next.campaign.wanted = Math.max(0, next.campaign.wanted - 3); next.campaign.debt += 4; next = tell(next, '你具名交代自己做过的事，替赈所做满一日。追查减了三级，四两赔补记入债账；原来的夜行记录没有删去。'); }
  } else if (aid === 'care') {
    pay(next, 4);
    next = elapse(next, 60);
    if (!next.campaign.ending) { next.player.injury = '无'; next.player.poison = '无'; next.player.woundUntreatedMinutes = 0; next.player.health = Math.min(next.player.maxHealth, next.player.health + 25); next = tell(next, '行脚医者清创、换药，确认浅伤残毒已去。你付清四两，或把不足部分记作救治债；此事没有产生能用于盐案的验伤文书。'); }
  } else if (aid === 'bandage') {
    next.player.money -= 1;
    next = elapse(next, 15);
    if (!next.campaign.ending) { next.dayOne = { ...next.dayOne, bleedingGraceMinutes: 240 }; next = tell(next, '你按学过的次序加压包扎，四小时内暂缓失血；伤还在，毒也没有因此消失。'); }
  } else if (aid === 'rest') {
    pay(next, 1); next = elapse(next, 480);
    if (!next.campaign.ending) { next.player.fatigue = Math.max(0, next.player.fatigue - 65); next.player.health = Math.min(next.player.maxHealth, next.player.health + 6); next = tell(next, '你借住歇息八小时。钱不足的部分记在食宿账上；窗外换过一轮人，错过的事仍照常发生。'); }
  } else if (aid === 'debt') {
    const amount = Math.min(next.campaign.debt, next.player.money); next.player.money -= amount; next.campaign.debt -= amount;
    next = tell(next, `你补上${amount}两，旧账划去实还的数目；其余经历没有被划去。`);
  } else if (aid === 'medical-debt') {
    next.player.money -= 3;
    next.economy = { ...next.economy, medicalDebt: 0, medicalDebtAt: null, transactions: [...next.economy.transactions, { id: 'settle-medical-debt', atMinutes: next.worldMinutes, moneyDelta: -3, debtDelta: -3, creditDelta: 0 }] };
    next = changeNpcRelationship(next, 'shen-yanqiu', 'economy:settle-medical-debt', { favor: 3 });
    next = tell(next, '三两交还回春堂账房，序章诊金债清了。病案授权不随还钱改变。');
  } else if (aid === 'rumors') {
    next = elapse(next, 15);
    if (!next.player.alive || next.campaign.ending) return next;
    for (const [eventId, result] of Object.entries(next.campaign.resolved)) {
      if (!result.witnessed) {
        const event = storyEvents.find(e => e.id === eventId)!;
        const prelude = firstActPreludes.find(item => item.eventId === eventId);
        next = tell(next, prelude ? `后来有人带来${event.title}的消息：${prelude.recoverySource}` : `行旅带来的消息 · ${event.title}：${result.text}`);
        if (prelude) next = tell(next, prelude.aftermath);
        result.witnessed = true;
      }
    }
  } else if (aid === 'wait') {
    const event = upcomingEvent(next);
    const target = event && next.worldMinutes < dayAt(next, event.day) ? dayAt(next, event.day) : event ? dayAt(next, storyEvents[storyEvents.indexOf(event) + 1]?.day ?? 58) : next.worldMinutes < dayAt(next, 58) ? dayAt(next, 58) : campaignDeadline(next);
    next = livingUntil(next, target);
    next = tell(next, '你按日安排食宿与歇息，等候下一次消息。每过一日付一两，不足记债；这段日子没有替你查案、训练或救人。');
  } else if (aid === 'away') return endLife(next, 'away');
  else if (aid === 'retire') return endLife(next, next.campaign.wanted >= 6 ? 'prison' : 'retired');
  else if (aid.startsWith('finale:')) {
    next.campaign.finale = aid.split(':')[1] as LifeRoute;
    next = tell(next, finaleOpening[next.campaign.finale]);
  } else if (aid.startsWith('end:')) next = applyFinale(next, aid);
  if (!next.player.health && next.player.alive) { next.player.alive = false; next.player.deathCause = '带伤夜行失手，气血在追逐中耗尽。'; }
  if (!next.player.alive && !next.campaign.ending) next = endLife(next, 'dead');
  stamp(next, aid, choice.label, next.player.money - beforeMoney, next.campaign.debt - beforeDebt);
  return next;
}

/** 走回事发地点可以补看已经留下的痕迹；只改“玩家已得知”，不重演事件、不补发奖励。 */
export function observeCampaignAftermath(state: GameState): GameState {
  if (!campaignActive(state) || state.campaign.ending || state.campaign.activeEvent) return state;
  const prelude = firstActPreludes.find((item) => {
    const event = storyEvents.find(candidate => candidate.id === item.eventId)!;
    const result = state.campaign.resolved[item.eventId];
    return event.location === state.locationId && result?.choice === 'missed' && !result.witnessed;
  });
  if (!prelude) return state;
  const next = fresh(state);
  next.campaign.resolved[prelude.eventId].witnessed = true;
  return tell(tell(next, `你回到旧地，又看见这些痕迹：${prelude.recoverySource}`), prelude.aftermath);
}

const finaleOpening: Record<LifeRoute, string> = {
  xia: '盐仓外，愿意作证的人站在你身后。陆观澜的门人带来公议副本。你不需要成为天下第一，却必须决定：用刀破阵，还是让三份账拆散对方的同盟。',
  trade: '平价转运行的脚夫到齐了，十二两只能让第一班船离岸。乔五的人要你沿用旧规矩抽私份，乡民要明账。你今天签下的条款，会成为往后的生计。',
  shadow: '你踩过的水道连到盐仓后窗。怀里有两类能让人睡不安稳的筹码。今夜可以勒出一笔远走的钱，也可以把账撒到众人手里，换自己一条不再受挟的路。',
  office: '宁不平把巡按的判稿推给你：只列了一个替罪羊。你已做过抄册核仓，知道每枚印的分量。现在是把真档钉进公卷，还是用一个小结案换一份安稳差事。',
  healer: '盐仓外的伤者比持刀者多。药库记录在你手里，你懂得了怎样辨伤，也见过记录怎样被拿去杀人。今晚可以随队护送病人，也可以留下开一间谁都能来的诊所。',
};
function finaleActions(s: GameState): LimitedAction[] {
  const c = s.campaign;
  const route = c.finale!;
  if (c.finaleStep === 0) {
    if (route === 'xia') { const p = conflictPreview(s); return [...(['guard','environment','retreat','bargain'] as BattleTactic[]).filter(t=>battleEnabled(s,'finale',t)).map(t=>action(`battle:finale:${t}`,battleLabel(s,'finale',t))), action('end:xia:fight', `合力破阵：力量${p.power} / 对阵${p.target}，${p.win ? '可胜' : '会败'}，损血${p.damage}${p.damage >= s.player.health ? '（致命）' : ''}`), ...(mainProof(s) ? [action('end:xia:proof', '当众对三账，拆散同盟，不与高手单斗')] : []), action('end:xia:escort', '放弃追凶，护送证人出围（花六两；不足记债）'), action('end:surrender', '交械认拘，保住性命')]; }
    if (route === 'trade') return [action('end:trade:public', '以十二两立公开股约，脚夫分利'), action('end:trade:monopoly', '以十二两接独占运输契，承担旧债主的要价')];
    if (route === 'shadow') return [action('end:shadow:publish', '把两类筹码公开，舍弃勒索收益'), action('end:shadow:sell', '以筹码换二十两，留一份自保')];
    if (route === 'office') return [action('end:office:trial', mainProof(s) ? '提交三账互证，申请重审许惟谦等人' : '只控告真档可证的伪印，不夸大证据'), action('end:office:compromise', '接受有限追责，换取核仓职缺')];
    return [action('end:healer:clinic', '留下开义诊，承担食宿旧债'), action('end:healer:travel', '带病人离开河湾，行医沿途还债')];
  }
  if (c.finaleStep === 1) return [action('end:record', '第59日 · 逐项核对最终案卷与身边人')];
  return [action('end:finish', '第60日 · 在这一页落款')];
}
function applyFinale(s: GameState, aid: string): GameState {
  let next = s;
  const c = next.campaign;
  if (aid === 'end:surrender') return performBattle(next, 'finale', 'surrender');
  if (aid === 'end:record') {
    next = livingUntil(next, Math.max(next.worldMinutes, dayAt(next, 59)));
    if (!next.campaign.ending) { next.campaign.finaleStep = 2; next = tell(next, worldReckoning(next).join('\n')); }
    return next;
  }
  if (aid === 'end:finish') {
    next = livingUntil(next, Math.max(next.worldMinutes, dayAt(next, 60)));
    return next.campaign.ending ? next : endLife(next, next.campaign.finale!);
  }
  if (aid === 'end:xia:fight') {
    return performBattle(next,'finale','attack');
  } else if (aid === 'end:xia:proof') { c.flags.push('public-truth', 'xia-victory'); next = tell(next, '官印、货重、药签在众人面前逐一相合。对方的门人撤开刀，你们用可以核验的事实拆开了同盟。'); }
  else if (aid === 'end:xia:escort') { pay(next, 6); c.flags.push('xia-escort'); next = tell(next, '你付船钱，把人带出围堵。背后仍有人争输赢，你先让同行的人活过今晚。'); }
  else if (aid.startsWith('end:trade:')) { next.player.money -= 12; c.flags.push(aid.endsWith('public') ? 'trade-public' : 'trade-monopoly'); next = tell(next, aid.endsWith('public') ? '十二两投入船具，三方各留一份股约。你成了行商，往后靠运价与信用吃饭，不能再拿救急作涨价的借口。' : '独占契约落印。你接下盈利，也接下旧盐路主人的盘剥义务；钱来得快，码头的人却未必肯帮你。'); }
  else if (aid === 'end:shadow:publish') { c.flags.push('shadow-public'); c.wanted = Math.max(0, c.wanted - 3); next = tell(next, '你把副本放到公示处，只留下自己那份底稿。威胁别人的价码没了，别人威胁你的秘密也少了。'); }
  else if (aid === 'end:shadow:sell') { next.player.money += 20; c.flags.push('shadow-rich'); c.wanted = Math.min(10, c.wanted + 2); next = tell(next, '二十两换走一份沉默。你保留底稿，知道买家也会保留找你的路；这门生意没有最后一单。'); }
  else if (aid === 'end:office:trial') { c.flags.push(mainProof(next) ? 'public-truth' : 'partial-trial'); next = tell(next, mainProof(next) ? '三账相合，许惟谦的伪印、乔五的转运、韩百川的领药都进入重审。宁不平签名，你也签名，没有只把风险留给证人。' : '真档足以控告伪印，却不足以替毒案定全责。你坚持把未证实之处留空，领取录事职缺继续查账。'); }
  else if (aid === 'end:office:compromise') { c.flags.push('office-compromise'); next = tell(next, '你接受只追已证亏空的判稿，领到核仓职缺。县城恢复运转，余下的人与事却不因盖印而清白。'); }
  else if (aid.startsWith('end:healer:')) { c.flags.push(aid.endsWith('clinic') ? 'healer-clinic' : 'healer-travel'); next = tell(next, aid.endsWith('clinic') ? '你租下一间临街小屋，把诊金与赊账分栏记。门开着，不问病人属于哪一派。' : '你带着能走的伤者离开污染的河湾，沿途换药、借宿、偿债。所学不是绝世医术，却足以让下一程少死一个人。'); }
  next.campaign.finaleStep = 1;
  return next;
}
const endingTitles: Record<LifeEnding, string> = { xia: '江湖有路', trade: '一船一诺', shadow: '月过无痕', office: '公门留名', healer: '灯下杏林', away: '无名客远走', retired: '青石余生', prison: '铁窗残卷', dead: '未竟之路' };
export function worldReckoning(s: GameState): string[] {
  const c = s.campaign;
  return [
    has(s, 'public-truth') ? '三类账目进入公开核验。伪印、私运与药库流出形成可追责的链条；你没有声称已经抓到所有逃走的人。' : has(s, 'partial-trial') ? '官档只追究已有真档佐证的伪印案，毒案与盐路仍留疑点。' : '盐案没有因你这一生的选择自动大白。官府只按现有材料留下有限结论，江湖仍传着另一份说法。',
    c.resolved.assassin ? (c.npcAlive['gu-qinghe'] ? '顾清河躲过刺杀，仍须面对官盐亏空与自己妥协的代价。' : '顾清河死于那次刺杀。他的旧档仍在，无法再替后来的人作承诺。') : '顾清河的后事尚未进入你这段经历，案卷留空。',
    c.resolved.sister ? has(s, 'sister-safe') ? '苏小蝉已经脱离盐场控制，姐妹可以自己决定去留。' : '小蝉没有被你救出。苏晚棠仍在寻人，你不能把这段缺席写成团圆。' : '小蝉的去向尚未由你介入，未作团圆记载。',
    c.resolved.hunt ? c.npcAlive['shen-yanqiu'] ? '沈砚秋活过灭口之夜，病案和诊所还可以继续。' : '沈砚秋死于医馆夜袭，病案副本无法补回一个医者。' : '回春堂的灯还亮在你离去的时刻。',
    has(s, 'river-safe') ? '运药船被控制在封锁河湾或浅滩，沿河取水得以保全。' : has(s, 'river-poisoned') ? '沉船留下药害，沿岸仍须封井清理；沉没不是问题消失。' : '你尚未亲历运药船的末路，不替后来的人预写结果。',
    `实际留存：${c.evidence.map(id => evidenceNames[id]).join('、') || '没有取得后续案卷材料'}。`,
  ];
}
export function lifeSummary(s: GameState) {
  const c = s.campaign;
  if (!c?.ending) return null;
  const personal: Record<LifeEnding, string> = {
    xia: has(s, 'xia-escort') ? '你没有争夺盐仓，选择以护送守诺谋生。救下的人知道你如何退让，逍遥并不是无所牵挂。' : has(s, 'xia-defeat') ? '盐仓一战你败了。后来你只接力所能及的护送，学会把活人带回来，比赢一场更难。' : '你以公议、互保或合力护证留下侠名，往后行走各地，不接掌任何人的高位。',
    trade: has(s, 'trade-public') ? '你经营脚夫参与分利的转运行，靠公开运价、信誉与周转金过日子。货路重新开通，是你亲手做成的事。' : '你成了独占盐路契约的经营者，靠货运与垄断吃饭。有人靠你得活，也有人因你的私份离开码头。',
    shadow: has(s, 'shadow-public') ? '你放弃勒索，把筹码送到明处。今后凭夜行技艺取富户钱、替人寻物，旧通缉不会因为雅号彻底消失。' : '你换来二十两，靠消息与暗路继续谋生。留底保护了你，也让交易的另一方永远记着你。',
    office: has(s, 'public-truth') ? '你留下担任录事，协助重审盐案；公门成为一份按卷承担责任的生计，不能靠一句自称获得。' : '你接下核仓录事的职缺。安稳俸银伴着未完的案卷，每次签押都不再是局外人的字。',
    healer: has(s, 'healer-clinic') ? '你留下开诊所，按所学辨伤换药。此生的成就，是门外的人肯把性命托给你。' : '你带药囊与伤者远行，靠诊治与帮工生活。未还的债按日偿，不冒称天下名医。',
    away: '你离开了青石。活着、保留自己的去向也是一种结局；没有参与的清算不计作你的功绩。',
    retired: '你留在城中，放下争夺，靠零工与旧交安顿余生。没做完的案留在案里，不必假装每个人都得登上高位。',
    prison: '你交械认拘，或因未处理的追查被收押。此生暂止于铁窗，原有证据与经历仍留在存档里。',
    dead: s.player.deathCause ?? '你的身体未能撑过这一程。',
  };
  return { title: endingTitles[c.ending], facts: [personal[c.ending], ...worldReckoning(s), `身后账：余银${s.player.money}两，食宿及赔补债${c.debt}两，旧诊金债${s.economy.medicalDebt}两；追查${c.wanted}级。`], stayPermitUntil: null };
}

function performBattle(s:GameState,event:string,tactic:BattleTactic):GameState {
  const context=battleContext(s,event), verdict=judgeBattle(event,tactic,context);
  let next=fresh(s);
  next.battles={schema:1,records:[...s.battles.records,{event,tactic,at:s.worldMinutes,context,...verdict}]};
  next.player.health=verdict.healthAfter; next.player.qi-=verdict.qiCost; next.player.money-=verdict.cost;
  next.player.injury=verdict.injuryAfter as GameState['player']['injury'];
  next.player.fatigue=Math.min(next.player.maxFatigue,next.player.fatigue+8);
  for(const change of verdict.relationChanges) next=changeNpcRelationship(next,change.id,`battle:${event}:${tactic}`,{trust:change.trust,favor:change.favor});
  if(event!=='finale') {
    const story=storyEvents.find(e=>e.id===event)!;
    const result=story.choices.find(c=>c.id===`battle-${tactic}-${verdict.win?'win':'loss'}`)!;
    // 死亡时不发救人奖励，按失败结果保留案卷后果。
    const effective=verdict.healthAfter>0?result:story.choices.find(c=>c.id===`battle-${tactic}-loss`)!;
    next=effects(next,effective.effect,`${event}:${effective.id}`);
    next.campaign.resolved[event]={choice:effective.id,at:next.worldMinutes,text:effective.reply,witnessed:true};
    next.campaign.activeEvent=null;
    next=tell(next,effective.reply);
    const prelude = firstActPreludes.find(item => item.eventId === event);
    if (prelude) next = tell(next, prelude.aftermath);
  } else {
    if(tactic==='retreat') next.campaign.flags.push('xia-escort');
    else if(tactic!=='surrender') next.campaign.flags.push(verdict.win?'xia-victory':'xia-defeat');
    next.campaign.finaleStep=1;
  }
  next.campaign.evidence=next.campaign.evidence.filter(id=>!verdict.lostEvidence.includes(id));
  if(event==='assassin') {
    const changes:string[]=[];
    if(!['bargain','surrender'].includes(tactic)) changes.push(`力量 ${verdict.power} / 对阵 ${verdict.target}`);
    if(verdict.damage>0) changes.push(`气血 -${verdict.damage}`);
    if(verdict.qiCost>0) changes.push(`真气 -${verdict.qiCost}`);
    if(verdict.cost>0) changes.push(`用银 ${verdict.cost} 两`);
    if(verdict.lostEvidence.length) changes.push(`遗失：${verdict.lostEvidence.map(id=>evidenceNames[id] ?? '随身材料').join('、')}`);
    if(verdict.companionInjuries.length) changes.push('一名助阵同伴负伤');
    next=tell(next,`${battles[event].title} · ${verdict.outcome}${changes.length?`。${changes.join(' · ')}`:''}。`);
  } else {
    next=tell(next,`${battles[event].title} · ${verdict.outcome}。己方力量${verdict.power}，对方压力${verdict.target}；损血${verdict.damage}、耗气${verdict.qiCost}、用银${verdict.cost}。${verdict.lostEvidence.length?'遗失随身材料：'+verdict.lostEvidence.map(id=>evidenceNames[id] ?? '随身材料').join('、')+'。':''}${verdict.companionInjuries.length?'同伴为断后负伤，之后助阵力量降低。':''}${context.allies.map(a=>a.style).join('、')}`);
  }
  if(!next.player.health) {next.player.alive=false;next.player.deathCause=event==='assassin'?`${battles[event].title}中受创过重，气血耗尽。`:`${battles[event].title}中气血耗尽：力量${verdict.power}/${verdict.target}，战前已明示致命风险，损血${verdict.damage}。`;return endLife(next,'dead');}
  if(tactic==='surrender') return endLife(next,'prison');
  return next;
}


'use client';
/* eslint-disable next/no-img-element -- 离线 SVG 立绘必须直接加载本地文件，桌面构建不依赖图片优化服务器。 */
import { beginSession, startNewJourney, saveCheckpoint, sessionAutoAllowed, sendToMap, returnToTitle, initialScreen } from '@/lib/game/session';
import { useDialogueReveal } from './use-dialogue-reveal';
import { parseTextSpeed } from '@/lib/game/text-reveal';
import { itinerary } from '@/lib/game/itinerary';
import { artTrees } from '@/lib/game/arts';
import { ArtTreeDiagram } from './art-tree';
import { KnownInformation } from './known-information';
import { ReturnJourneyActions } from './return-journey-actions';
import { knowledgeGroups, knowledgeScope } from '@/lib/ui/knowledge';
import { totalArtPoints, type ArtTree } from '@/lib/game/arts-content';
import { battles, battleContext } from '@/lib/game/battle';
import { presentNpcIds } from '@/lib/game/day-one';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpenText,
  ChevronRight,
  HardDriveDownload,
  HardDriveUpload,
  History,
  Map,
  Moon,
  RotateCcw,
  ScrollText,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { mockAIService } from '@/lib/ai/mock-service';
import {
  formatWorldTime,
  getNpcDisplayName,
  getNpcVisibleIdentity,
  selectNpc,
} from '@/lib/game/engine';
import { getLocation, getNpc, locations } from '@/lib/game/world';
import { getAvailableActions as getLimitedActions, type LimitedAction } from '@/lib/game/limited-actions';
import { continueReading, createActionRunner, readingPosition, finishPrologueDemo } from '@/lib/game/flow-controller';
import { endingSummary, prologueNotice } from '@/lib/game/prologue';
import { getSaveRepository } from '@/lib/game/save-repository';
import { consumeSceneReturn, createManualSave as createSaveOperation, deleteSave, loadSave, overwriteSave, renameSave } from '@/lib/game/save-operations';
import { findEmptyManualSlot, MANUAL_SAVE_LIMIT, orderSaveSummaries, type SaveSlotId, type SaveSlotSummary } from '@/lib/game/storage';
import type { GameState } from '@/lib/game/types';
import { campaignActive, gameEnded, lifeSummary, campaignDay, routeQualification, patron } from '@/lib/game/campaign';
import { routeNames } from '@/lib/game/campaign-content';
import { portraitForLine, portraits } from '@/lib/game/portraits';
import type { LifeRoute } from '@/lib/game/campaign-types';

const abilityLabels = {
  martial: '武学',
  agility: '轻功',
  insight: '洞察',
  eloquence: '口才',
  vigilance: '警觉',
  medicine: '医术',
} as const;

export default function Home() {
  const router = useRouter();
  return <GameHome navigate={(path) => router.push(path)} />;
}

export function GameHome({ navigate }: { navigate: (path: string) => void }) {
  const saveRepository = useMemo(() => getSaveRepository(), []);
  const [game, setGame] = useState<GameState | null>(null);
  const [screen, setScreen] = useState<'title' | 'new'>(initialScreen);
  const [knowledgeRevision, setKnowledgeRevision] = useState(0);
  const [growthOpen, setGrowthOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [name, setName] = useState('');
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [instantDialogue, setInstantDialogue] = useState(false);
  const reveal = useDialogueReveal(game?.dialogue[game ? readingPosition(game, dialogueIndex).current : 0], instantDialogue);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionTab, setActionTab] = useState('眼前');
  const [saveManagerMode, setSaveManagerMode] = useState<'save' | 'load' | null>(null);
  const [saveSlots, setSaveSlots] = useState<SaveSlotSummary[]>([]);
  const [, setSaveExists] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState('');
  const [interactionBusy, setBusy] = useState(false);
  const [storageBusy, setStorageBusy] = useState(false);
  const busy = interactionBusy || storageBusy;
  const storageLock = useRef(false);
  const [saveDirty, setSaveDirty] = useState(false);
  const savedState = useRef<GameState | null>(null);
  const interactionLock = useRef(false);
  const runAction = useMemo(() => createActionRunner(mockAIService), []);
  const orderedSaveSlots = useMemo(() => orderSaveSummaries(saveSlots), [saveSlots]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setSaveExists(await saveRepository.hasAny());
          const restored = consumeSceneReturn();
          if (restored) { setInstantDialogue(true); setGame(restored); setDialogueIndex(Math.max(0, restored.dialogue.length - 1)); }
        } catch { setNotice('无法读取存档列表，请检查本地存储权限后重试'); }
        finally { setHydrated(true); }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [saveRepository]);

  const location = game ? getLocation(game.locationId) : locations[0];
  const presentNpcs = useMemo(() => (game ? presentNpcIds(game) : location.npcIds).map(getNpc), [game, location]);
  const selectedNpc = game?.selectedNpcId ? getNpc(game.selectedNpcId) : undefined;

  const start = async () => {
    const next = await startNewJourney(saveRepository, name);
    savedState.current = null; setSaveDirty(true);
    setScreen('title'); setInstantDialogue(false); setGame(next);
    setDialogueIndex(0);
  };
  const openMap = async () => {
    if (!game || gameEnded(game) || game.campaign.finale || busy || !game.player.alive || game.gatePhase === 'detained' || !readingPosition(game, dialogueIndex).latest) return;
    sendToMap(game);
    navigate('/map');
  };
  const storageAction = async (operation: () => Promise<void>) => {
    if (storageLock.current || interactionLock.current) return;
    storageLock.current = true;
    setStorageBusy(true);
    try { await operation(); }
    catch (error) { setNotice(error instanceof Error ? `存档操作失败：${error.message}` : '存档操作失败，请重试'); }
    finally { storageLock.current = false; setStorageBusy(false); }
  };
  const submitInteraction = async (choice: LimitedAction) => {
    if (!game || !reveal.complete || busy || storageLock.current || interactionLock.current) return;
    interactionLock.current = true;
    setBusy(true);
    try {
      const result = await runAction(game, dialogueIndex, choice.id, selectedNpc?.id ?? null);
      if (result) {
        try { const saved = await saveCheckpoint(saveRepository, result.state); setSaveDirty(!saved); if (saved) savedState.current = result.state; } catch { setSaveDirty(true); setNotice('自动存档失败，进度仍在内存，请手动保存'); }
        setInstantDialogue(false); setGame(result.state); setDialogueIndex(result.dialogueIndex); setActionTab('眼前'); }
    } catch {
      setNotice('这次交互没有成功，请稍后再试');
    } finally {
      interactionLock.current = false;
      setBusy(false);
    }
  };
  const save = async () => {
    if (!game) return;
    setSaveSlots(await saveRepository.list());
    setSaveManagerMode('save');
  };
  const saveSlot = async (slot: SaveSlotId) => {
    if (!game || slot === 'auto') return;
    if (!await overwriteSave(saveRepository, slot, game, window)) return;
    savedState.current = game;
    setSaveDirty(false);
    setSaveSlots(await saveRepository.list());
    setSaveExists(true);
    setNotice('手动存档已保存');
    window.setTimeout(() => setNotice(''), 1800);
  };
  const openLoadManager = async () => {
    setSaveSlots(await saveRepository.list());
    setSaveManagerMode('load');
  };
  const loadSlot = async (slot: SaveSlotId) => {
    const restored = await loadSave(saveRepository, slot, game, saveDirty || Boolean(game && savedState.current !== game), window);
    if (!restored) return;
    await beginSession(saveRepository, slot);
    savedState.current = restored; setSaveDirty(false);
    setInstantDialogue(true); setGame(restored); setKnowledgeRevision(value => value + 1);
    setDialogueIndex(Math.max(0, restored.dialogue.length - 1));
    setSaveManagerMode(null);
    setNotice(`已读取${saveSlots.find((item) => item.id === slot)?.label ?? '存档'}`);
    window.setTimeout(() => setNotice(''), 1800);
  };
  const createManualSave = async () => {
    if (!game) return;
    if (!await createSaveOperation(saveRepository, game, window, `${formatWorldTime(game.worldMinutes)} · ${getLocation(game.locationId).shortName}`)) return;
    savedState.current = game;
    setSaveDirty(false);
    setSaveSlots(await saveRepository.list());
    setSaveExists(true);
    setNotice('手动存档已保存');
  };
  const renameSlot = async (slot: SaveSlotSummary) => {
    if (!await renameSave(saveRepository, slot.id, window)) return;
    setSaveSlots(await saveRepository.list());
  };
  const deleteSlot = async (slot: SaveSlotSummary) => {
    if (!await deleteSave(saveRepository, slot.id, window)) return;
    const next = await saveRepository.list();
    setSaveSlots(next);
    setSaveExists(next.some((item) => item.exists));
    setNotice('手动存档已删除');
  };
  const discard = () => {
    setGame(returnToTitle(game, true)); setScreen('title'); setReturnOpen(false);
    savedState.current = null; setSaveDirty(false); setDialogueIndex(0); setName('');
    setHistoryOpen(false); setSaveManagerMode(null); setNotice('');
  };

  if (!hydrated)
    return (
      <main className="opening-screen flex min-h-screen items-center justify-center p-4 text-paper">
        <p className="font-serif tracking-[0.2em] text-stone-300">正在翻开江湖旧页……</p>
      </main>
    );

  if (!game)
    return (
      <main className="opening-screen min-h-screen p-4 text-paper">
        {notice && <output className="save-notice" aria-live="polite">{notice}</output>}
        <div className="opening-card mx-auto mt-[10vh] max-w-xl p-7 sm:p-10">
          <p className="text-sm tracking-[0.35em] text-[#c67b68]">低魔 · 危险 · 自由江湖</p>
          <h1 className="mt-3 font-serif text-4xl font-bold tracking-[0.16em] sm:text-5xl">青石江湖</h1>
          <p className="mt-6 max-w-md font-serif text-lg leading-8 text-stone-300">
            暮雨中的商旅在青石县外遇袭。你带着一道止不住血的伤口醒来，只记得有人在雨里喊着：“找丁字十七。”
          </p>
          {screen === 'new' && <> <label className="mt-8 block text-sm text-stone-300" htmlFor="name">
            你的江湖名号
          </label>
          <input
            id="name"
            value={name}
            maxLength={12}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void storageAction(start)}
            placeholder="留空则称无名客"
            className="mt-2 h-11 w-full rounded-[3px] border border-stone-500 bg-black/20 px-3 text-sm text-paper outline-none placeholder:text-stone-500 focus:border-[#c67b68] focus:ring-2 focus:ring-[#c67b68]/25"
          />
          <Button className="mt-4" onClick={() => void storageAction(start)} disabled={busy}>踏入青石县</Button>
          <Button variant="ghost" onClick={() => setScreen('title')}>返回主界面</Button></>}
          {screen === 'title' && <div className="mt-6 grid gap-3">
            <Button size="lg" onClick={() => setScreen('new')} disabled={busy}>新的旅程</Button>
            <Button size="lg" onClick={() => void storageAction(openLoadManager)} disabled={busy}>继续旅程</Button>
          </div>}
          <p className="mt-5 text-sm leading-6 text-stone-300">六十日盐路风云。侠行、行商、夜盗、公门、行医，都从一次次选择中成为你的路。全程离线，本地存档。</p>
        </div>
        <Dialog open={saveManagerMode === 'load'} onOpenChange={(open) => !open && setSaveManagerMode(null)}>
          <DialogContent className="paper-panel max-h-[86vh] rounded-[3px] bg-[#eee8d8] text-ink sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">选择要读取的存档</DialogTitle>
              <DialogDescription className="text-ink/55">自动存档与手动存档彼此独立。请选择你要继续的进度。</DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[60vh] gap-2 overflow-y-auto border-t border-ink/15 pt-4 pr-1">
              {!orderedSaveSlots.some(slot => slot.exists) && <p>尚无可读取存档。返回主界面，选择“新的旅程”开始。</p>}
              {orderedSaveSlots.filter((slot) => slot.occupied || slot.exists).map((slot) => (
                <div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 border border-ink/15 p-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-serif font-bold">{slot.label}{slot.recovered ? '（备份可恢复）' : !slot.exists && slot.occupied ? '（损坏或不兼容）' : ''}</p>
                    <p className="mt-1 text-ink/55">{slot.playerName} · {slot.worldMinutes != null ? formatWorldTime(slot.worldMinutes) : ''}{slot.locationId ? ` · ${getLocation(slot.locationId).shortName}` : ''}</p>
                    <p className="text-sm text-ink/60">第{slot.storyDay ?? '—'}日 · {slot.characterStatus} · {slot.journeyStatus}</p>{slot.savedAt ? <p className="mt-1 text-xs text-ink/40">{new Date(slot.savedAt).toLocaleString('zh-CN')} · v{slot.gameVersion}</p> : null}
                  </div>
                  <Button size="sm" disabled={busy || !slot.exists} onClick={() => void storageAction(() => loadSlot(slot.id))}>读取</Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    );

  const selectedName = selectedNpc ? getNpcDisplayName(game, selectedNpc.id) : null;
  const selectedIdentity = selectedNpc ? getNpcVisibleIdentity(game, selectedNpc.id) : null;
  const knownGroups = knowledgeGroups(game);
  const currentDialogueIndex = readingPosition(game, dialogueIndex).current;
  const currentLine = game.dialogue[currentDialogueIndex];
  const isLatestLine = currentDialogueIndex >= game.dialogue.length - 1 && reveal.complete;
  const confirmLine = () => { if (!reveal.complete) reveal.finish(); else if (currentDialogueIndex < game.dialogue.length - 1) { setInstantDialogue(false); setDialogueIndex(index => continueReading(game, index)); } };
  const limitedActions = getLimitedActions(game, selectedNpc?.id ?? null);
  const ending = lifeSummary(game) ?? endingSummary(game);
  const caseNotice = campaignActive(game) ? null : prologueNotice(game);
  const battleId = game.campaign.activeEvent && battles[game.campaign.activeEvent] ? game.campaign.activeEvent : game.campaign.finale === 'xia' && game.campaign.finaleStep === 0 ? 'finale' : null;
  const journeyNote = itinerary(game);
  const portrait = portraitForLine(game, currentLine);
  const tabOf = (id: string) => /journey-(work:|pledge:)/.test(id) ? '谋生' : /journey-(train:|lesson:|teach:|node:|arts:)/.test(id) ? '修习' : /journey-(break|debt|medical-debt|amends|rumors)$/.test(id) ? '旧事' : '眼前';
  const tabs = ['眼前', '谋生', '修习', '旧事'].filter(tab => limitedActions.some(choice => tabOf(choice.id) === tab));
  const currentTab = tabs.includes(actionTab) ? actionTab : tabs[0];
  const visibleActions = campaignActive(game) ? limitedActions.filter(choice => tabOf(choice.id) === currentTab) : limitedActions;

  return (
    <main className="min-h-screen p-3 text-ink sm:p-5">
      <header className="wood-panel sticky top-0 z-40 mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-5 py-3 text-paper">
        <div>
          <p className="text-xs tracking-[0.32em] text-[#c67b68]">低魔 · 危险 · 自由江湖</p>
          <h1 className="font-serif text-2xl font-bold tracking-[0.14em]">青石江湖</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-300">
          <span className="flex items-center gap-1.5">
            <Moon className="size-4" /> {formatWorldTime(game.worldMinutes)}
          </span>
          <span>{location.weather}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => void storageAction(openMap)} disabled={busy || !!ending || !!game.campaign.finale || !isLatestLine || !game.player.alive || game.gatePhase === 'detained'} className="text-stone-200 hover:bg-white/10 hover:text-white">
            <Map /> 地图
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setGrowthOpen(true)} className="text-stone-200">功法</Button>
          <Button size="sm" variant="ghost" onClick={() => void storageAction(save)} disabled={busy} className="text-stone-200 hover:bg-white/10 hover:text-white">
            <HardDriveDownload /> 存档
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void storageAction(openLoadManager)} disabled={busy} className="text-stone-200 hover:bg-white/10 hover:text-white">
            <HardDriveUpload /> 读档
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setReturnOpen(true)} disabled={busy} className="text-stone-200 hover:bg-white/10 hover:text-white">
            <RotateCcw /> 返回游戏主界面
          </Button>
        </div>
      </header>

      {!sessionAutoAllowed() && <p className="mx-auto max-w-[1320px] p-2 text-sm">旧自动档受保护，本旅程请使用手动存档保存；新建不会覆盖已有档位。</p>}
      {notice && (
        <output className="save-notice" aria-live="polite">
          {notice}
        </output>
      )}

      <div className="mx-auto mt-4 grid max-w-[1320px] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
        <section className="paper-panel min-w-0 overflow-hidden">
          {caseNotice && <output className="block border-b border-ink/20 bg-[#f7f1e3] p-5 leading-7" aria-live="polite">{caseNotice}</output>}
          {ending && isLatestLine && <section className="border-b-2 border-cinnabar p-6 sm:p-8" aria-label="人生与案卷">
            <p className="text-sm tracking-widest text-cinnabar">{game.campaign.ending ? '此生定稿 · 可存读回看' : '案卷暂结 · 江湖未尽'}</p>
            <h2 className="mt-3 font-serif text-3xl">{ending.title}</h2>
            <div className="mt-5 space-y-4 font-serif text-lg leading-8">{ending.facts.map((fact) => <p key={fact}>{fact}</p>)}</div>
            {ending.stayPermitUntil !== null && <p className="mt-4 text-sm text-ink/65">暂留凭条有效至：{formatWorldTime(ending.stayPermitUntil)}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={busy} onClick={() => void storageAction(async () => {
                if (sessionAutoAllowed() ? await finishPrologueDemo(saveRepository, game, dialogueIndex) : await createSaveOperation(saveRepository, game, window, '人生案卷')) { setGame(null); setDialogueIndex(0); setNotice('此页已保存，可从存档继续或回看。'); }
              })}>保存并返回主界面</Button>
            </div>
            {!game.campaign.ending && <p className="mt-3 text-sm text-ink/55">下方可选择继续这一生。此前的口供、旧债、证物归属和关系全部保留。</p>}
          </section>}
          <div className={`scene story-stage scene-${location.id} relative flex items-end p-6`}>
            {portrait && <img className="character-portrait" src={portrait.src} alt={`${currentLine?.speaker}的水墨立绘`} style={{ objectPosition: portrait.position }} />}
            <div className="relative z-10 max-w-2xl text-paper drop-shadow-lg">
              <p className="text-sm tracking-[0.2em] text-stone-300">{campaignActive(game) ? `盐路风云 · 第${campaignDay(game)}日` : '雨夜盐引 · 初入青石'}</p>
              <h2 className="mt-1 font-serif text-3xl font-bold">{location.name}</h2>
              <p className="scene-description mt-2 leading-7 text-stone-200">{location.description}</p>
            </div>
          </div>

          <div className="p-5">
            {!campaignActive(game) && <details className="border-b border-ink/15 pb-4">
              <summary className="cursor-pointer text-sm tracking-[0.08em] text-ink/70">眼前的人 · {selectedName ?? '留意四周'}（切换与观察）</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {presentNpcs.length ? (
                  presentNpcs.map((npc) => (
                    <Button
                      key={npc.id}
                      size="sm"
                      variant={selectedNpc?.id === npc.id ? 'default' : 'outline'}
                      disabled={busy || !!ending || !isLatestLine || !game.player.alive || game.gatePhase === 'detained'}
                      onClick={() => { if (!interactionLock.current && !storageLock.current && isLatestLine) setGame(selectNpc(game, npc.id)); }}
                    >
                      <UserRound /> {getNpcDisplayName(game, npc.id)}
                    </Button>
                  ))
                ) : (
                  <span className="text-sm text-ink/55">附近没有引人注意的人。</span>
                )}
              </div>
              {selectedNpc && (
                <div className="mt-3 text-sm leading-6 text-ink/65">
                  <b className="font-serif text-ink">{selectedName}</b>
                  {selectedIdentity ? <span className="ml-2 text-cinnabar">你已确认：{selectedIdentity}</span> : null}
                  <p className="mt-1">{selectedNpc.observation}</p>
                </div>
              )}
            </details>}

            {battleId && !game.campaign.ending && <section className="my-4 border border-cinnabar/30 p-4 text-sm" aria-label="冲突形势"><h3 className="font-serif text-lg">{battles[battleId].title}</h3><p>起因：{battles[battleId].cause}；对手：{battles[battleId].opponent}</p><p>目标：{battles[battleId].goal}。失守可能失证、增加追查或使受护者遇害；撤退只保证尝试脱离自己，投降会结束旅程。</p><p>可助阵：{battleContext(game,battleId).allies.map(a=>getNpcDisplayName(game,a.id)+' · '+a.style+' · 战斗等级 '+a.level+(a.injured?'（负伤）':'')).join('；') || '目前没有满足在场或约定、信任和敌意条件的同伴'}</p></section>}
            <section className="dialogue-window" aria-label="当前对话">
              <div className="dialogue-paper min-h-[170px] p-5 sm:p-6">
                <button type="button" className="w-full text-left" onClick={confirmLine} aria-label={currentLine ? `${currentLine.speaker}：${currentLine.text}。确认以跳过显示或继续。` : '此刻无人开口'}>
                {currentLine ? (
                  <div className="font-serif text-lg leading-9">
                    <p className="mb-3 flex items-center gap-3"><span className={`speaker ${currentLine.kind === 'npc' ? 'npc' : ''}`}>{currentLine.speaker}</span><span className="text-sm font-normal text-ink/55">{currentLine.tone ?? (currentLine.kind === 'narration' ? '叙述' : currentLine.kind === 'player' ? '你的选择' : '交谈')}</span></p>
                    <p className="whitespace-pre-line">
                    <span aria-hidden="true">{reveal.text}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-ink/50">此刻无人开口。</p>
                )}
                </button>
              </div>

              <div className="mt-3 min-h-32">
                {!isLatestLine ? (
                  <Button
                    className="w-full justify-between py-6"
                    variant="outline"
                    onClick={confirmLine}
                  >
                    {reveal.complete ? '继续' : '跳过'} <ChevronRight />
                  </Button>
                ) : limitedActions.length ? (
                  <div>
                    {campaignActive(game) && tabs.length > 1 && <fieldset className="mb-3 flex flex-wrap gap-2"><legend className="sr-only">行动类别</legend>{tabs.map(tab => <Button key={tab} variant={currentTab === tab ? 'default' : 'outline'} size="sm" onClick={() => setActionTab(tab)}>{tab}</Button>)}</fieldset>}
                  <div className="grid gap-2 sm:grid-cols-2" aria-label="当前可选回应">
                    {visibleActions.map((choice) => (
                      <Button
                        key={choice.id}
                        variant="outline"
                        className="h-auto min-h-12 justify-start whitespace-normal px-4 py-3 text-left leading-6"
                        onClick={() => void submitInteraction(choice)}
                        disabled={busy}
                      >
                        {busy ? '等待回应……' : choice.id === 'open-growth' ? '查看功法线索' : choice.label}
                      </Button>
                    ))}
                  </div>
                  </div>
                ) : (
                  <p className="border border-dashed border-ink/20 p-4 text-sm text-ink/50">
                    {ending ? '此页已写完，可保存、读档与回看历史。' : !game.player.alive
                      ? `你已经死亡：${game.player.deathCause ?? '原因不明。'}`
                      : game.gatePhase === 'detained'
                        ? '你已被城门差役扣留，当前无法自由行动。'
                        : game.locationId === 'gate' && game.gateAccess
                          ? '城门已经放行。你可以打开地图，选择已知去处。'
                        : '眼下没有明确可做的事。'}
                  </p>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-ink/15 pt-3">
                <div className="flex gap-2">
                  <Button size="icon-sm" variant="ghost" aria-label="查看对话历史" title="查看对话历史" onClick={() => { setInstantDialogue(true); setHistoryOpen(true); }}>
                    <History />
                  </Button>
                </div>
                <label className="text-xs">逐字速度 <select aria-label="逐字显示速度" value={reveal.speed} onChange={e => reveal.setSpeed(parseTextSpeed(e.target.value))}><option value="slow">慢</option><option value="normal">标准</option><option value="fast">快</option><option value="off">关闭</option></select></label>
                <Button size="sm" variant="ghost" onClick={() => { setInstantDialogue(true); setDialogueIndex(game.dialogue.length - 1); }}>跳过本段显示</Button>
                <span className="text-xs text-ink/45">{currentDialogueIndex + 1} / {game.dialogue.length}</span>
              </div>
            </section>
            <p className="mt-3 text-sm text-ink/55">读完当前一句再行动。选择会留下经历，翻阅文字不会流逝时间。</p>
          </div>
        </section>

        <aside className="grid content-start gap-4 lg:sticky lg:top-4">
          <section className="paper-panel p-4" aria-label="行程笺"><h2 className="section-title">行程笺</h2>
            <p className="mt-3 text-sm leading-6">{journeyNote.appointment}</p><p className="text-sm text-cinnabar">{journeyNote.deadline}</p>
            <details className="mt-3"><summary>下一步成长与去向条件</summary>{journeyNote.routes.map(r => <div key={r.route} className="mt-3 text-sm"><b>{r.name}</b><p>研习：{r.learning}</p><p>去向条件：{r.missing.join('；') || '目前准备已足，待清算窗口开启'}</p></div>)}</details>
          </section>
          <section className="paper-panel p-4">
            <h2 className="section-title">
              <img src={portraits.player.src} alt="主角头像" className="player-avatar" /> {game.player.name}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {Object.entries(game.player.abilities).map(([key, value]) => (
                <span key={key}>
                  {abilityLabels[key as keyof typeof abilityLabels]} <b className="float-right">{value}</b>
                </span>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-ink/15 pt-3 text-sm">
              <p>气血 <b className="float-right">{game.player.health} / {game.player.maxHealth}</b></p>
              <p>内力 <b className="float-right">{game.player.qi} / {game.player.maxQi}</b></p>
              <p>疲劳 <b className="float-right">{game.player.fatigue} / {game.player.maxFatigue}</b></p>
              <p>伤势 / 中毒 <b className="float-right">{game.player.injury} / {game.player.poison}</b></p>
              <p>路引 <b className="float-right">{game.player.hasRoadPass ? '在身' : '遗失'}</b></p>
              <p>碎银 <b className="float-right">{game.player.money} 两</b></p>
              {game.locationId === 'gate' ? <p>城门状态 <b className="float-right">{game.gatePhase === 'detained' ? '被扣留' : game.gateAccess ? '已放行' : game.gatePhase === 'searched' ? '等待搜查' : '盘查中'}</b></p> : null}
            </div>
          </section>

          {campaignActive(game) && <section className="paper-panel p-4" aria-label="此生行迹">
            <h2 className="section-title"><BookOpenText className="size-4" /> 此生行迹</h2>
            <div className="mt-3 space-y-3 text-sm leading-6">
              {Object.entries(routeNames).map(([route, label]) => <div key={route}>
                <p>{label}<span className="float-right">实践 {game.campaign.scores[route as LifeRoute]} · 研习 {game.campaign.trained[route as LifeRoute]}/3</span></p>
                {campaignDay(game) >= 53 && <p className="text-ink/60">{routeQualification(game, route as LifeRoute) ?? '已具备此路终局条件'}</p>}
              </div>)}
              <p className="border-t border-ink/15 pt-2">约定：{game.campaign.pledge ? routeNames[game.campaign.pledge] : '尚未立约'}<br />追查：{game.campaign.wanted}/10 · 食宿旧债：{game.campaign.debt}两<br />序章诊金债：{game.economy.medicalDebt}两</p>
              <p className="text-ink/60">实践逐次积累；立约后可解约转向。追查四级起影响公门差事，六级起需先处理追查才能远走。</p>
            </div>
          </section>}

          <section className="paper-panel p-4"><h2 className="section-title">技艺与师承</h2><p className="mt-3 text-sm">本篇已获 {totalArtPoints(game)} / 7 点。基础、分支与剧情技艺均需实际前置。</p><Button className="mt-3" onClick={() => setGrowthOpen(true)}>打开功法页</Button></section>

          <KnownInformation key={knowledgeScope(game, knowledgeRevision, knownGroups)} groups={knownGroups} />

          <section className="paper-panel p-4">
            <h2 className="section-title">
              <ScrollText className="size-4" /> 江湖日志
            </h2>
            <ol className="mt-3 max-h-56 space-y-3 overflow-y-auto text-sm leading-6 text-ink/70">
              {[...game.logs].reverse().map((item) => (
                <li key={item.id}>
                  <time className="block text-xs text-cinnabar">{formatWorldTime(item.atMinutes)}</time>
                  {item.text}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <Dialog open={growthOpen} onOpenChange={setGrowthOpen}>
        <DialogContent className="paper-panel max-h-[88vh] overflow-y-auto bg-[#eee8d8] text-ink sm:max-w-3xl">
          <DialogHeader><DialogTitle>功法 · 所学皆有来处</DialogTitle><DialogDescription>本篇最多七点；四小时研习需两点阅历与三两，每日一次。先完成眼前对话，才能进行训练或投入点数。</DialogDescription></DialogHeader>
          <p>已立约：{game.campaign.pledge ? routeNames[game.campaign.pledge] + ' · ' + getNpcDisplayName(game,patron[game.campaign.pledge]) : '无'} · 已获技能点 {totalArtPoints(game)}/7</p>
          {journeyNote.routes.map(r => <div key={r.route} className="border-b border-ink/15 pb-2 text-sm"><b>{r.name}</b> · 实践 {game.campaign.scores[r.route]} · 剩余阅历 {game.campaign.experience[r.route]} · 属性研习 {game.campaign.trained[r.route]}/3<p>{r.learning}</p></div>)}
          {(Object.keys(artTrees) as ArtTree[]).map(tree => <ArtTreeDiagram key={tree} game={game} tree={tree} actions={limitedActions} ready={!busy && isLatestLine} onLearn={action => { setGrowthOpen(false); void submitInteraction(action); }} />)}
          <div className="grid gap-2 sm:grid-cols-2">{limitedActions.filter(a=>/journey-(train:|lesson:|teach:|node:|arts:|pledge:)/.test(a.id)||/^(practice-lu|study-shen|spend-|open-growth)/.test(a.id)).map(a=><Button key={a.id} disabled={busy||!isLatestLine} className="h-auto whitespace-normal" onClick={()=>{setGrowthOpen(false);void submitInteraction(a);}}>{a.id === 'open-growth' ? '查看功法线索' : a.label}</Button>)}</div>
        </DialogContent>
      </Dialog>
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent showCloseButton={false} className="paper-panel bg-[#eee8d8] text-ink">
          <DialogHeader><DialogTitle>返回游戏主界面</DialogTitle><DialogDescription>未保存的进度将会丢失。已有存档会保留，本次返回不会保存。</DialogDescription></DialogHeader>
          <ReturnJourneyActions onCancel={() => setReturnOpen(false)} onConfirm={discard} busy={busy} />
        </DialogContent>
      </Dialog>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="paper-panel max-h-[80vh] rounded-[3px] bg-[#eee8d8] text-ink sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">对话历史</DialogTitle>
            <DialogDescription className="text-ink/55">这里只用于回看记录，不会改变已发生的选择与世界状态。</DialogDescription>
          </DialogHeader>
          <div className="max-h-[58vh] space-y-3 overflow-y-auto border-t border-ink/15 pt-4 pr-2">
            {game.dialogue.map((item) => (
              <p key={item.id} className={item.kind === 'player' ? 'pl-4 text-ink/70' : ''}>
                <span className={`speaker ${item.kind === 'npc' ? 'npc' : ''}`}>{item.speaker}</span>
                {item.text}
              </p>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(saveManagerMode)} onOpenChange={(open) => !open && setSaveManagerMode(null)}>
        <DialogContent className="paper-panel max-h-[86vh] rounded-[3px] bg-[#eee8d8] text-ink sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{saveManagerMode === 'save' ? '管理手动存档' : '选择要读取的存档'}</DialogTitle>
            <DialogDescription className="text-ink/55">
              自动存档独立维护。你可以保留最多 {MANUAL_SAVE_LIMIT} 个手动存档，并从列表中任选一个读取。
            </DialogDescription>
          </DialogHeader>
          {saveManagerMode === 'save' ? (
            <Button onClick={() => void storageAction(createManualSave)} disabled={busy || !findEmptyManualSlot(saveSlots)}>
              新建手动存档（{saveSlots.filter((slot) => slot.id !== 'auto' && (slot.occupied || slot.exists)).length}/{MANUAL_SAVE_LIMIT}）
            </Button>
          ) : null}
          <div className="grid max-h-[60vh] gap-2 overflow-y-auto border-t border-ink/15 pt-4 pr-1">
            {orderedSaveSlots.filter((slot) => slot.id === 'auto' || slot.occupied || slot.exists).map((slot) => (
              <div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 border border-ink/15 p-3">
                <div className="min-w-0 text-sm">
                  <p className="font-serif font-bold">{slot.label}{slot.recovered ? '（备份可恢复）' : !slot.exists && slot.occupied ? '（损坏或不兼容）' : ''}</p>
                  <p className="mt-1 text-ink/55">
                    {slot.exists
                      ? `${slot.playerName} · ${slot.worldMinutes != null ? formatWorldTime(slot.worldMinutes) : ''}${slot.locationId ? ` · ${getLocation(slot.locationId).shortName}` : ''}`
                      : slot.occupied ? '损坏或不兼容，可覆盖或删除' : '尚未产生自动存档'}
                  </p>
                  <p className="text-sm text-ink/60">第{slot.storyDay ?? '—'}日 · {slot.characterStatus} · {slot.journeyStatus}</p>{slot.savedAt ? <p className="mt-1 text-xs text-ink/40">{new Date(slot.savedAt).toLocaleString('zh-CN')} · v{slot.gameVersion}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {saveManagerMode === 'save' && slot.id !== 'auto' ? (
                    <>
                      <Button size="sm" onClick={() => void storageAction(() => saveSlot(slot.id))}>覆盖</Button>
                      <Button size="sm" variant="outline" onClick={() => void storageAction(() => renameSlot(slot))}>重命名</Button>
                      <Button size="sm" variant="outline" onClick={() => void storageAction(() => deleteSlot(slot))}>删除</Button>
                    </>
                  ) : <Button size="sm" onClick={() => void storageAction(() => loadSlot(slot.id))} disabled={busy || !slot.exists}>读取</Button>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

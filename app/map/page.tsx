'use client';

import { ReliableImage } from '../reliable-image';
import { assetPath } from '@/lib/ui/asset-path';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock3, MapPin, Navigation, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatWorldTime } from '@/lib/game/engine';
import { createTravelRunner, previewTravel } from '@/lib/game/flow-controller';
import { getSaveRepository } from '@/lib/game/save-repository';
import { takeMapSnapshot, saveCheckpoint } from '@/lib/game/session';
import { rememberSceneReturn } from '@/lib/game/save-operations';
import { getLocation, locations } from '@/lib/game/world';
import type { GameState, LocationId } from '@/lib/game/types';

export default function MapPage() {
  const router = useRouter();
  return <GameMap navigate={(path) => router.push(path)} replace={(path) => router.replace(path)} />;
}

export function GameMap({ navigate, replace }: { navigate: (path: string) => void; replace: (path: string) => void }) {
  const saveRepository = useMemo(() => getSaveRepository(), []);
  const [game, setGame] = useState<GameState | null>(null);
  const [destinationId, setDestinationId] = useState<LocationId | null>(null);
  const [notice, setNotice] = useState('');
  const saving = useRef(false);
  const runTravel = useMemo(() => createTravelRunner({ ...saveRepository, save: async (_slot, state) => { await saveCheckpoint(saveRepository, state); } }), [saveRepository]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => { void Promise.resolve(takeMapSnapshot()).then((restored) => {
      if (cancelled) return;
      if (!restored) replace('/');
      else setGame(restored);
    }).catch(() => { if (!cancelled) setNotice('会话读取失败，请返回主界面后重试'); }); }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [replace, saveRepository]);

  const knownLocations = useMemo(
    () => (game ? locations.filter((location) => game.knownLocationIds.includes(location.id)) : []),
    [game],
  );
  const estimate = game && destinationId ? previewTravel(game, destinationId) : null;

  const confirmTravel = async () => {
    if (!game || !destinationId || saving.current) return;
    saving.current = true;
    try {
      const result = await runTravel(game, destinationId, true);
      if (!result) return;
      const next = result.state;
      rememberSceneReturn(next);
      setGame(next);
      setDestinationId(null);
      navigate('/');
    } catch { setNotice('行程保存失败，尚未出发，请重试'); }
    finally { saving.current = false; }
  };

  if (!game) {
    return <main className="map-screen min-h-screen p-5 text-paper">{notice || '正在展开地图……'}{notice && <Button onClick={() => replace('/')}>返回开场</Button>}</main>;
  }

  const current = getLocation(game.locationId);
  const destination = destinationId ? getLocation(destinationId) : null;

  return (
    <main className="map-screen min-h-screen p-3 text-paper sm:p-6">
      {notice && <output>{notice}</output>}
      <header className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 border-b border-paper/20 pb-4">
        <div>
          <p className="text-xs tracking-[0.3em] text-[#c67b68]">主角认知中的青石县</p>
          <h1 className="mt-1 font-serif text-3xl font-bold tracking-[0.12em]">行路图</h1>
        </div>
        <div className="text-sm text-stone-300">
          <p>{formatWorldTime(game.worldMinutes)}</p>
          <p className="mt-1 text-right">当前：{current.name}</p>
        </div>
        <Button variant="outline" onClick={() => { if (!saving.current) { rememberSceneReturn(game); navigate('/'); } }} className="border-paper/30 bg-transparent text-paper hover:bg-white/10 hover:text-paper">
          <ArrowLeft /> 返回当前场景
        </Button>
      </header>

      <section className="map-parchment relative mx-auto mt-6 min-h-[620px] max-w-[1180px] overflow-hidden">
        <div className="map-river" aria-hidden="true" />
        <div className="map-road map-road-one" aria-hidden="true" />
        <div className="map-road map-road-two" aria-hidden="true" />

        {knownLocations.map((location) => {
          const isCurrent = location.id === game.locationId;
          const blockedByGate = !isCurrent && !previewTravel(game, location.id);
          return (
            <button
              key={location.id}
              type="button"
              className={`map-location ${isCurrent ? 'current' : ''}`}
              style={{ left: `${location.mapPosition.x}%`, top: `${location.mapPosition.y}%` }}
              onClick={() => !isCurrent && !blockedByGate && setDestinationId(location.id)}
              disabled={isCurrent || blockedByGate}
              aria-label={isCurrent ? `当前位于${location.name}` : blockedByGate ? `尚未获准前往${location.name}` : `选择前往${location.name}`}
            >
              <span className="map-location-mark"><MapPin /></span>
              <span className="map-location-name">{location.name}</span>
              <span className="map-location-note">{isCurrent ? '你在此处' : blockedByGate ? '当前无法动身' : '选择此处'}</span>
            </button>
          );
        })}

        <div className="absolute right-5 bottom-5 max-w-xs border border-ink/15 bg-[#eee8d8]/90 p-4 text-sm text-ink shadow-lg">
          <p className="font-serif font-bold">地图只记录你知道的地方</p>
          <p className="mt-2 leading-6 text-ink/65">
            未曾听闻或发现的地点不会出现在这里。与人交谈、观察环境和取得路线消息都可能补全地图。
          </p>
        </div>
      </section>

      <Dialog open={Boolean(destinationId)} onOpenChange={(open) => !open && setDestinationId(null)}>
        <DialogContent className="paper-panel rounded-[3px] bg-[#eee8d8] text-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">确认前往{destination?.name}</DialogTitle>
            <DialogDescription className="leading-6 text-ink/60">
              一旦确认动身，江湖时间会继续推进。确认前你可以取消此次选择。
            </DialogDescription>
          </DialogHeader>
          {destination && <ReliableImage src={assetPath(`scenes/${destination.id}.svg`)} alt={`${destination.name}的水墨画卷`} className="h-36 w-full object-cover" />}
          {estimate && (
            <div className="space-y-3 border-y border-ink/15 py-4 text-sm">
              <p className="flex items-center justify-between"><span className="flex items-center gap-2"><Navigation className="size-4" />基础路程</span><b>{estimate.baseMinutes}分钟</b></p>
              <p className="flex items-center justify-between"><span className="flex items-center gap-2"><Wind className="size-4" />天气影响</span><b>{estimate.weatherMinutes ? `+${estimate.weatherMinutes}分钟` : '无'}</b></p>
              <p className="flex items-center justify-between"><span>伤势影响</span><b>{estimate.injuryMinutes ? `+${estimate.injuryMinutes}分钟` : '无'}</b></p>
              <p className="flex items-center justify-between"><span>轻功影响</span><b>{estimate.agilityMinutes ? `${estimate.agilityMinutes}分钟` : '无'}</b></p>
              <p className="flex items-center justify-between border-t border-ink/15 pt-3 text-base"><span className="flex items-center gap-2"><Clock3 className="size-4" />预计耗时</span><b className="text-cinnabar">{estimate.totalMinutes}分钟</b></p>
            </div>
          )}
          <DialogFooter className="border-ink/10 bg-transparent">
            <Button variant="outline" onClick={() => setDestinationId(null)}>暂不前往</Button>
            <Button onClick={() => void confirmTravel()}>确认动身</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

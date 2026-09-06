import { useEffect, useState } from 'react';
import { startReveal, tickReveal, textSpeeds, parseTextSpeed, type TextSpeed } from '@/lib/game/text-reveal';
import type { DialogueLine } from '@/lib/game/types';
export function useDialogueReveal(line: DialogueLine | undefined, instant: boolean) {
  const [speed, setSpeed] = useState<TextSpeed>('normal');
  const key = line ? `${line.id}:${line.text}` : '';
  const text = line?.text ?? '';
  const [state, setState] = useState(() => startReveal(key, text, instant));
  const view = state.key === key ? state : startReveal(key, text, instant);
  const complete = instant || speed === 'off' || view.count >= view.length;
  useEffect(() => { const timer = window.setTimeout(() => { try { setSpeed(parseTextSpeed(localStorage.getItem('qingshi-text-speed'))); } catch { /* 偏好不可写不影响游戏。 */ } }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    if (instant || speed === 'off') return;
    const timer = window.setInterval(() => setState(s => { const next = tickReveal(s.key === key ? s : startReveal(key, text), key); if (next.count >= next.length) window.clearInterval(timer); return next; }), textSpeeds[speed]);
    return () => window.clearInterval(timer);
  }, [key, text, instant, speed]);
  return { complete, text: complete ? text : Array.from(text).slice(0, view.count).join(''), speed,
    finish: () => setState(startReveal(key, text, true)),
    setSpeed: (value: TextSpeed) => { setSpeed(value); try { localStorage.setItem('qingshi-text-speed', value); } catch { /* 保留本次运行偏好。 */ } } };
}

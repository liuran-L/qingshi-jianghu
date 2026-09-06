export const textSpeeds = { slow: 65, normal: 35, fast: 12, off: 0 } as const;
export type TextSpeed = keyof typeof textSpeeds;
export interface RevealState { key: string; count: number; length: number }
export const startReveal = (key: string, text: string, instant = false): RevealState => ({ key, count: instant ? Array.from(text).length : Math.min(1, Array.from(text).length), length: Array.from(text).length });
export const tickReveal = (s: RevealState, key: string): RevealState => key === s.key ? { ...s, count: Math.min(s.length, s.count + 1) } : s;
export const confirmReveal = (s: RevealState) => ({ state: { ...s, count: s.length }, advance: s.count >= s.length });
export const visibleText = (text: string, s: RevealState) => Array.from(text).slice(0, s.count).join('');
export const parseTextSpeed = (value: string | null): TextSpeed => value && Object.hasOwn(textSpeeds, value) ? value as TextSpeed : 'normal';

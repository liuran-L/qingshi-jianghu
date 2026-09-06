import assert from 'node:assert/strict';
import test from 'node:test';
import { startReveal, tickReveal, confirmReveal, visibleText, parseTextSpeed, textSpeeds } from '../lib/game/text-reveal.ts';
import { createInitialGame } from '../lib/game/engine.ts';
import { encodeSave } from '../lib/game/storage.ts';
void test('U02 逐字确认先补全再推进，旧计时器无效，四档和中文字符不截断', () => {
  const game = createInitialGame('读者'), saved = encodeSave(game);
  let s = startReveal('a', '雨😀落。'); assert.equal(visibleText('雨😀落。', s), '雨');
  s = tickReveal(s, 'a'); assert.equal(visibleText('雨😀落。', s), '雨😀');
  assert.equal(tickReveal(s, '旧句'), s);
  const first = confirmReveal(s); assert.equal(first.advance, false); assert.equal(first.state.count, 4);
  assert.equal(confirmReveal(first.state).advance, true);
  assert.equal(startReveal('读档', '完整句', true).count, 3);
  assert.equal(parseTextSpeed(null), 'normal'); assert.equal(parseTextSpeed('伪造'), 'normal');
  assert.deepEqual(Object.values(textSpeeds), [65, 35, 12, 0]);
  assert.equal(encodeSave(game), saved);
});

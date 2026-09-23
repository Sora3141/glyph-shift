// 長押しが 2 回動いてしまう不具合の回帰テスト
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const same = (a, b) => a.every((v, i) => v === b[i]);

const realSet = globalThis.setTimeout;
let held = [];
globalThis.setTimeout = (fn, ms = 0) => {
  if (ms === 400) { held.push(fn); return held.length + 100000; }
  return realSet(fn, ms);
};
const fireLongPressTimer = () => { const q = held; held = []; for (const fn of q) fn(); };

W = H = 5; SIZE = 25; buildDom(); types = 4;
// 回転のブロック（位数 3 以上）が打てる盤面を選ぶ。使うブロックは盤面ごとに
// 引き直されるので、種を決め打ちすると回転が 1 つも出ないことがある。
let SEED = 6;
for (; SEED < 200; SEED++) { newPuzzle(SEED); if (legalCells().some((c) => orderOf(cyclesAt(c)) > 2)) break; }
newPuzzle(SEED);
const i = legalCells().find((c) => orderOf(cyclesAt(c)) > 2);
ok(i !== undefined, '回転のブロックが打てる位置がない');
const once = (dir) => { const b = [...board]; applyTo(b, cyclesAt(i), dir); return b; };

// 1. タッチ長押し: 自前タイマーが先、そのあとブラウザの contextmenu が来る
{
  newPuzzle(SEED);
  const expect = once(-1);
  held = [];
  gridEl.fire('pointerdown', { button: 0, target: slots[i] });
  fireLongPressTimer();                                            // 長押し成立
  gridEl.fire('contextmenu', { target: slots[i], preventDefault: () => {} }); // ブラウザの長押し
  gridEl.fire('pointerup', {});
  gridEl.fire('pointerleave', {});
  ok(same(board, expect), 'タイマー→contextmenu の順で 2 回動いている');
  console.log('  長押し（タイマー→メニュー）: 1 回だけ動く');
}

// 2. 逆順: ブラウザの contextmenu が先、そのあと自前タイマー
{
  newPuzzle(SEED);
  const expect = once(-1);
  held = [];
  gridEl.fire('pointerdown', { button: 0, target: slots[i] });
  gridEl.fire('contextmenu', { target: slots[i], preventDefault: () => {} });
  fireLongPressTimer();                                            // 取り消されているはず
  gridEl.fire('pointerup', {});
  ok(same(board, expect), 'contextmenu→タイマー の順で 2 回動いている');
  console.log('  長押し（メニュー→タイマー）: 1 回だけ動く');
}

// 3. 長押しのあと離しても、タップとして足されない
{
  newPuzzle(SEED);
  const expect = once(-1);
  held = [];
  gridEl.fire('pointerdown', { button: 0, target: slots[i] });
  fireLongPressTimer();
  gridEl.fire('pointerup', {});
  gridEl.fire('pointerup', {});      // 念のため二重に来た場合も
  ok(same(board, expect), '長押しのあとタップぶんが足されている');
  console.log('  長押し後に離しても足されない: OK');
}

// 4. ふつうのタップは 1 回だけ
{
  newPuzzle(SEED);
  const expect = once(1);
  held = [];
  gridEl.fire('pointerdown', { button: 0, target: slots[i] });
  gridEl.fire('pointerup', {});
  gridEl.fire('pointerleave', {});
  ok(same(board, expect), 'タップが 1 回で収まっていない');
  console.log('  タップ: 1 回だけ動く');
}

// 5. デスクトップの右クリック（左の押下を伴わない）も 1 回だけ
{
  newPuzzle(SEED);
  // 直前にタップを済ませて、内部の印が立った状態から始める
  gridEl.fire('pointerdown', { button: 0, target: slots[i] });
  gridEl.fire('pointerup', {});
  const base = [...board];
  const expect = [...base]; applyTo(expect, cyclesAt(i), -1);
  gridEl.fire('pointerdown', { button: 2, target: slots[i] });
  gridEl.fire('contextmenu', { target: slots[i], preventDefault: () => {} });
  gridEl.fire('contextmenu', { target: slots[i], preventDefault: () => {} }); // 二重に来ても
  ok(same(board, expect), '右クリックが 1 回で収まっていない');
  console.log('  右クリック: 1 回だけ動く');
}

// 6. 押したまま外へ出たら発動しない
{
  newPuzzle(SEED);
  const before = [...board];
  held = [];
  gridEl.fire('pointerdown', { button: 0, target: slots[i] });
  gridEl.fire('pointerleave', {});
  fireLongPressTimer();
  gridEl.fire('pointerup', {});
  gridEl.fire('contextmenu', { target: slots[i], preventDefault: () => {} });
  ok(same(board, before), '外へ出たのに発動している');
  console.log('  押したまま外へ出たら発動しない: OK');
}

globalThis.setTimeout = realSet;
console.log(fail === 0 ? '\n長押しの二重発動: 全チェック通過' : `\n失敗 ${fail} 件`);

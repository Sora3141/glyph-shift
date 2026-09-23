// タップ / 長押し / 右クリックの入力まわり
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const same = (a, b) => a.every((v, i) => v === b[i]);

// 長押しの判定に使う setTimeout(400ms) を保留できるようにする
const realSet = globalThis.setTimeout;
let held = [];
globalThis.setTimeout = (fn, ms = 0) => {
  if (ms === 400) { held.push(fn); return held.length + 100000; }
  return realSet(fn, ms);
};

W = H = 5; SIZE = 25; buildDom(); types = 4;
// 回転のブロック（位数 3 以上）が打てる盤面を選ぶ。使うブロックは盤面ごとに
// 引き直されるので、種を決め打ちすると回転が 1 つも出ないことがある。
let SEED = 6;
for (; SEED < 200; SEED++) { newPuzzle(SEED); if (legalCells().some((c) => orderOf(cyclesAt(c)) > 2)) break; }
newPuzzle(SEED);
const i = legalCells().find((c) => orderOf(cyclesAt(c)) > 2);
ok(i !== undefined, '回転のブロックが打てる位置がない');

// タップ = 順方向
{
  newPuzzle(SEED);
  const before = [...board];
  const expect = [...board]; applyTo(expect, cyclesAt(i), 1);
  held = [];
  gridEl.fire('pointerdown', { button: 0, target: slots[i] });
  ok(same(board, before), 'pointerdown だけで動いてしまう');
  gridEl.fire('pointerup', {});
  ok(same(board, expect), 'タップで順方向に動いていない');
  console.log('  タップ = 順方向: OK');
}

// 長押し = 逆方向、離しても二重に発動しない
{
  newPuzzle(SEED);
  const expect = [...board]; applyTo(expect, cyclesAt(i), -1);
  held = [];
  gridEl.fire('pointerdown', { button: 0, target: slots[i] });
  ok(held.length === 1, '長押しの判定が仕掛けられていない');
  held[0]();                                   // 長押し成立
  ok(same(board, expect), '長押しで逆方向に動いていない');
  const afterLong = [...board];
  gridEl.fire('pointerup', {});
  ok(same(board, afterLong), '長押しのあと離したときに二重で発動している');
  console.log('  長押し = 逆方向、離しても二重発動しない: OK');
}

// 指が外れたら発動しない
{
  newPuzzle(SEED);
  const before = [...board];
  held = [];
  gridEl.fire('pointerdown', { button: 0, target: slots[i] });
  gridEl.fire('pointerleave', {});
  gridEl.fire('pointerup', {});
  ok(same(board, before), '離れたのに発動している');
  console.log('  盤の外へ外すと発動しない: OK');
}

// 右クリック = 逆方向
{
  newPuzzle(SEED);
  const expect = [...board]; applyTo(expect, cyclesAt(i), -1);
  let prevented = false;
  // 実ブラウザでは右クリックでも contextmenu の前に pointerdown(button 2) が来る
  gridEl.fire('pointerdown', { button: 2, target: slots[i] });
  gridEl.fire('contextmenu', { target: slots[i], preventDefault: () => { prevented = true; } });
  ok(same(board, expect), '右クリックで逆方向に動いていない');
  ok(prevented, '右クリックのメニューを抑止していない');
  console.log('  右クリック = 逆方向: OK');
}

// 自動再生中は受け付けない
{
  newPuzzle(SEED);
  const before = [...board];
  autoSolving = true;
  held = [];
  gridEl.fire('pointerdown', { button: 0, target: slots[i] });
  gridEl.fire('pointerup', {});
  gridEl.fire('contextmenu', { target: slots[i], preventDefault: () => {} });
  ok(same(board, before), '自動再生中に入力を受け付けている');
  autoSolving = false;
  console.log('  自動再生中は受け付けない: OK');
}

globalThis.setTimeout = realSet;
console.log(fail === 0 ? '\n入力の検証: 全チェック通過' : `\n失敗 ${fail} 件`);

// 解説の操作（再生・一時停止・一手進む・一手戻す）の検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);
const snap = () => board.join(',');

// 自動再生の刻みだけ保留して、テストから 1 拍ずつ進められるようにする
const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
let pending = null, nextId = 90000;
globalThis.setTimeout = (fn, ms = 0) => {
  if (ms === 340 || ms === 120) { pending = { id: ++nextId, fn }; return pending.id; }
  return realSet(fn, ms);
};
globalThis.clearTimeout = (id) => {
  if (pending && pending.id === id) { pending = null; return; }
  return realClear(id);
};
const tick = () => { const p = pending; pending = null; if (p) p.fn(); };
const playing = () => !el('autoBar')._cls.has('paused');

// 一手ずつの検証には、数手では終わらない盤面が要る
W = H = 5; SIZE = 25; buildDom(); types = 3;
let useSeed = 3;
for (; useSeed < 60; useSeed++) { newPuzzle(useSeed); if (planCost(activeRuns()) >= 8) break; }
ok(planCost(activeRuns()) >= 8, `検証に使える盤面が見つからない（残り ${planCost(activeRuns())} 手）`);
const atStart = snap();
const movesAtStart = moves;

console.log('解説をひらく');
el('solveBtn').fire('click', {});
ok(el('confirmOverlay').hidden === false, '確認が出ない');
ok(snap() === atStart, '確認の段階で盤面が動いている');
el('confirmYes').fire('click', {});
ok(el('autoBar').hidden === false, '再生バーが出ていない');
ok(autoSolving === true, '解説モードに入っていない');
ok(playing(), '開いた直後に動き出していない');
ok(snap() !== atStart, '再生しているのに盤面が動いていない');

console.log('\n一時停止と再生');
el('autoPlay').fire('click', {});
ok(!playing(), '一時停止にならない');
const held = snap();
tick();
ok(snap() === held, '止めたのに勝手に進んだ');
ok(el('autoText').textContent.includes('止まっています'), `案内: ${el('autoText').textContent}`);
el('autoPlay').fire('click', {});
ok(playing(), '再生に戻らない');
ok(el('autoText').textContent.includes('揃えています'), `案内: ${el('autoText').textContent}`);
el('autoPlay').fire('click', {});   // また止める

console.log('\n一手ずつ進む・戻る');
{
  ok(!isSolved() && activeRuns().length >= 2, 'まだ手が残っている前提が崩れている');
  const before = snap();
  const n = autoHist.length;
  el('autoNext').fire('click', {});
  ok(autoHist.length === n + 1, `進むで ${autoHist.length - n} 手ぶん動いた（期待 1）`);
  ok(snap() !== before, '進むを押しても盤面が変わらない');
  ok(!playing(), '進むを押したら勝手に再生が始まった');

  el('autoBack').fire('click', {});
  ok(autoHist.length === n, `戻すで ${n + 1 - autoHist.length} 手ぶん戻った（期待 1）`);
  ok(snap() === before, '戻しても元の盤面に戻らない');
}

console.log('\n最後まで戻すと、解説を開く前に戻る');
let guard = 0;
while (autoHist.length && guard++ < 500) el('autoBack').fire('click', {});
ok(snap() === atStart, '全部戻しても開く前の盤面に戻らない');
ok(moves === movesAtStart, `手数が戻らない: ${moves}（開いたときは ${movesAtStart}）`);
ok(autoSolvedFlag === false, '何も進めていないのに「自動で揃えた」扱いのまま');
ok(el('autoBack').disabled === true, '戻せないのに戻すボタンが押せる');

console.log('\n進むだけで最後まで揃う');
guard = 0;
while (!isSolved() && guard++ < 500) el('autoNext').fire('click', {});
ok(isSolved(), `進むだけでは揃わない（${guard} 回）`);
ok(el('autoBar').hidden === true, '揃ったのに再生バーが残っている');
ok(autoSolving === false, '揃ったのに解説モードのまま');
ok(el('log').textContent.includes('自動で揃えました'), `完成の文言: ${el('log').textContent}`);
console.log(`  ${guard} 回の「進む」で揃った`);

console.log('\n再生だけで最後まで揃う');
newPuzzle(useSeed + 1);
el('solveBtn').fire('click', {});
el('confirmYes').fire('click', {});
guard = 0;
while (!isSolved() && guard++ < 2000) tick();
ok(isSolved(), `再生だけでは揃わない（${guard} 拍）`);
ok(el('autoBar').hidden === true, '揃ったのに再生バーが残っている');

console.log('\nやめる');
newPuzzle(useSeed + 2);
el('solveBtn').fire('click', {});
el('confirmYes').fire('click', {});
const midway = snap();
el('autoStop').fire('click', {});
ok(autoSolving === false, 'やめても解説モードのまま');
ok(el('autoBar').hidden === true, 'やめても再生バーが残っている');
ok(snap() === midway, 'やめたら盤面が動いた');
tick();
ok(snap() === midway, 'やめたのに勝手に進んだ');
// やめたあとは自分で操作できる
{
  const i = legalCells()[0];
  fire(i, 1);
  ok(snap() !== midway, 'やめたあとに手が打てない');
}

globalThis.setTimeout = realSet;
globalThis.clearTimeout = realClear;
console.log(fail === 0 ? '\n解説の操作: 全チェック通過' : `\n失敗 ${fail} 件`);

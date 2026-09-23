// 再生成ボタンと確認画面の検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);
const sig = () => ({
  board: [...board].join(','),
  tiles: [...tileAbility].join(','),
  blocks: [...new Set(tileAbility)].sort((a, b) => a - b).join(','),
  seed,
});

W = H = 5; SIZE = 25; buildDom(); types = 4; newPuzzle(9);
const a = sig();

// 押しただけでは何も変わらない
el('newBtn').fire('click', {});
ok(!el('confirmOverlay').hidden, '確認画面が出ていない');
ok(el('confirmTitle').textContent.includes('新しい盤面'), `見出し: ${el('confirmTitle').textContent}`);
ok(el('confirmText').innerHTML.includes('ブロックも目標の柄も'), `本文: ${el('confirmText').innerHTML}`);
ok(el('confirmYes').textContent === '作る', `決定ボタン: ${el('confirmYes').textContent}`);
ok(sig().board === a.board, '確認だけで盤面が変わった');
console.log('  押すと確認が出て、盤面はまだ変わらない');

// やめる
el('confirmNo').fire('click', {});
ok(el('confirmOverlay').hidden, 'やめるで閉じない');
ok(sig().board === a.board && sig().seed === a.seed, 'やめたのに盤面が変わった');
console.log('  やめると何も起きない');

// 作る → サイズとブロック数は据え置き、盤面・ブロック・柄は変わる
el('newBtn').fire('click', {});
el('confirmYes').fire('click', {});
const b = sig();
ok(el('confirmOverlay').hidden, '作成後も確認が開いている');
ok(W === 5 && SIZE === 25, `サイズが変わった: ${W}`);
ok(types === 4 && new Set(tileAbility).size === 4, `ブロック数が変わった: ${new Set(tileAbility).size}`);
ok(b.seed !== a.seed, 'SEED が変わっていない');
ok(b.board !== a.board, '盤面が変わっていない');
ok(b.tiles !== a.tiles, '目標の柄が変わっていない');
ok(!isSolved(), '作成直後に完成している');
console.log(`  作ると盤面も柄も変わる（設定は据え置き）`);

// ブロックの顔ぶれも変わりうる
{
  let changed = 0;
  for (let t = 0; t < 12; t++) {
    const before = [...new Set(tileAbility)].sort((x, y) => x - y).join(',');
    el('newBtn').fire('click', {}); el('confirmYes').fire('click', {});
    if ([...new Set(tileAbility)].sort((x, y) => x - y).join(',') !== before) changed++;
  }
  ok(changed > 0, '使うブロックの顔ぶれが一度も変わらない');
  console.log(`  12 回中 ${changed} 回、使うブロックの顔ぶれも変わった`);
}

// 完成したあとでも押せる（次へ進む手段）
{
  newPuzzle(3);
  requestSolve();
  let guard = 0;
  while (!locked && activeRuns().length && guard++ < 20000) {
    const r = activeRuns()[0];
    fire(r.i, r.n <= r.order - r.n ? 1 : -1);
  }
  ok(isSolved() && locked, '完成させられなかった');
  el('newBtn').fire('click', {});
  ok(!el('confirmOverlay').hidden, '完成後に再生成が押せない');
  el('confirmYes').fire('click', {});
  ok(!locked && !isSolved(), '完成後に作り直せていない');
  console.log('  完成したあとでも押せて、次の盤面に進める');
}

// 「解説」の確認は文言が別
{
  newPuzzle(4);
  el('solveBtn').fire('click', {});
  ok(el('confirmTitle').textContent.includes('解説'), `見出し: ${el('confirmTitle').textContent}`);
  ok(el('confirmYes').textContent === '見る', `決定ボタン: ${el('confirmYes').textContent}`);
  el('confirmNo').fire('click', {});
  ok(!isSolved(), 'やめたのに揃ってしまった');
  console.log('  同じ確認画面を使い回しても文言が混ざらない');
}

console.log(fail === 0 ? '\n再生成ボタン: 全チェック通過' : `\n失敗 ${fail} 件`);

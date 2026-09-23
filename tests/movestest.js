// 手数のカウントと表示の検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

W = H = 4; SIZE = 16; buildDom(); types = 2;
newPuzzle(5);
ok(moves === 0, `生成直後の手数が ${moves}`);

// 使えないマスを押しても手数は増えない
const dead = [];
for (let i = 0; i < SIZE; i++) if (!cyclesAt(i)) dead.push(i);
ok(dead.length > 0, '使えないマスが無く検証できない');
fire(dead[0]);
ok(moves === 0, `使えないマスで手数が増えた: ${moves}`);

// 違うマスを順に押すと、まとまりが切れるたびに 1 手ずつ確定する
// （同じマスの連続押しの数え方は countertest.js で検証）
newPuzzle(5);
{
  let done = 0;
  for (let k = 0; k < 5; k++) {
    const i = legalCells().find((c) => c !== run.i);
    if (i === undefined) break;
    fire(i);
    done++;
    // 直前までのまとまりが確定している（今押したぶんはまだ未確定）
    ok(moves === done - 1, `${done} マス目を押した時点で確定 ${moves} 手（期待 ${done - 1}）`);
  }
  commitRun();
  ok(moves === done, `${done} マスを押して確定 ${moves} 手（期待 ${done}）`);
}

// 生成し直すと 0 に戻る
newPuzzle(6);
ok(moves === 0, `生成し直しで手数が ${moves}`);

// 完成させたときに手数が表示される
newPuzzle(6);
const rec = [];
{ // 崩し直して手順を記録し、逆再生で完成させる
  board = Array.from({ length: SIZE }, (_, i) => i);
  const r = mulberry32(999);
  for (let k = 0; k < 10; k++) {
    const legal = legalCells();
    const i = legal[Math.floor(r() * legal.length)];
    rec.push(i); applyTo(board, cyclesAt(i));
  }
  moves = 0; locked = false;
}
let expected = 0;
for (const i of [...rec].reverse()) {
  const target = [...board];
  const probe = [...board]; applyTo(probe, cyclesAt(i));
  let n = 1;
  while (!probe.every((v, k) => v === target[k])) { applyTo(probe, cyclesAt(i)); n++; if (n > 500) break; }
  for (let k = 0; k < n - 1; k++) { if (!locked) { fire(i); expected++; } }
}
ok(isSolved(), '完成させられなかった');
ok(locked, '完成してもロックされていない');
const log = document.getElementById('log');
ok(log._cls.has('done'), '完成の知らせが出ていない');
ok(log.textContent.includes(`${moves} 手`), `表示「${log.textContent}」に手数 ${moves} が出ていない`);
ok(moves > 0, `手数が ${moves}`);
console.log(`完成時の表示: 「${log.textContent}」`);

// シャッフル数
for (const n of [4, 5, 6]) { W = H = n; SIZE = n * n; console.log(`${n}×${n} → 崩す手数 ${scrambleSteps()}`); }

console.log(fail === 0 ? '手数の検証: 全チェック通過' : `失敗 ${fail} 件`);

// 探索がヒントに反映されているかの検証
// 注: Worker の無いテスト環境では同期の短い予算で解くため、
// 手順が保険（数千手）になることがある。押し切れるようガードを大きく取る。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// 1 手ごとに手順を読み直す。手を打つたびに解き直される場合があるため、
// 古い参照を握ったままにしない。
function playRuns(getRuns) {
  let guard = 0;
  while (!locked) {
    const r = getRuns()[0];
    if (!r) break;
    // 順方向に n 回進めるか、逆方向に (位数 - n) 回進めるか、少ない側を選ぶ
    fire(r.i, r.n <= r.order - r.n ? 1 : -1);
    if (++guard > 20000) return false;
  }
  return true;
}

for (const [n, k] of [[4, 2], [4, 4], [5, 3], [6, 2]]) {
  W = H = n; SIZE = n * n; buildDom(); types = k;
  for (let s = 1; s <= 4; s++) {
    clearHint();
    newPuzzle(s);
    ok(hintPlan === null, `${n}×${n} K=${k} seed ${s}: 生成時に前の手順が残っている`);

    // ヒントを開くと探索が走る
    requestSolve();
    ok(hintPlan !== null, `${n}×${n} K=${k} seed ${s}: 探索結果が入っていない`);
    ok(hintPlan.runs.length > 0, `${n}×${n} K=${k} seed ${s}: 手順が空`);

    // 逆手順より短いか同じであること。
    // 比べるのは「まとまりの数」ではなく手数。1 つのまとまりは押す向きを
    // 選べるので、まとまりが多くても手数は少ないことがある。
    const cost = (runs) => runs.reduce((a, r) => a + Math.min(r.n, r.order - r.n), 0);
    ok(cost(hintPlan.runs) <= cost(solution),
       `${n}×${n} K=${k} seed ${s}: 探索結果 ${cost(hintPlan.runs)} 手が逆手順 ${cost(solution)} 手より長い`);

    // 実際にその手順どおり押すと完成する
    ok(playRuns(() => hintPlan.runs), `${n}×${n} K=${k} seed ${s}: 手順が終わらない`);
    ok(isSolved(), `${n}×${n} K=${k} seed ${s}: 手順どおり押しても完成しない`);
  }
}

// 途中まで打ってから解き直しても正しいか
{
  W = H = 5; SIZE = 25; buildDom(); types = 3; newPuzzle(12);
  const r = mulberry32(4242);
  for (let t = 0; t < 8 && !locked; t++) { const L = legalCells(); fire(L[Math.floor(r() * L.length)]); }
  requestSolve();
  requestSolve();
  ok(hintPlan !== null, '途中局面で解き直せていない');
  ok(playRuns(() => hintPlan.runs), '途中局面からの手順が終わらない');
  ok(isSolved(), '途中局面から解き直した手順で完成しない');
  console.log('  途中局面からの解き直し: OK');
}

// 探索結果がないときは逆手順に落ちる
{
  clearHint();
  W = H = 4; SIZE = 16; buildDom(); types = 2; newPuzzle(3);
  ok(hintPlan === null, '生成直後に探索結果が残っている');
  ok(activeRuns() === solution, '探索結果がないのに逆手順に落ちていない');
  ok(playRuns(() => solution), '逆手順が終わらない');
  ok(isSolved(), '逆手順で完成しない');
  console.log('  探索結果がないときは逆手順に落ちる: OK');
}

// 盤面を作り直すと探索結果は捨てられ、押し直せば新しい盤面で解ける
{
  requestSolve();
  ok(hintPlan !== null, '解けていない');
  W = H = 4; SIZE = 16; buildDom(); types = 3; newPuzzle(21);
  ok(hintPlan === null, '新しい盤面で前の探索結果が残っている');
  showHint();
  ok(hintPlan !== null, 'ヒントを押しても解かれていない');
  ok(playRuns(() => hintPlan.runs), '新しい盤面の手順が終わらない');
  ok(isSolved(), '新しい盤面の手順で完成しない');
  console.log('  盤面を作り直すと捨てられ、押し直せば解き直される: OK');
}

console.log(fail === 0 ? '\n探索とヒントの連携: 全チェック通過' : `\n失敗 ${fail} 件`);

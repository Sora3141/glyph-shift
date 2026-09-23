// 長方形の盤でもソルバーが正しい手順を返すか
// 注: Worker が無いので同期の短い予算で解く。保険の手順（数千手）に
//     なることがあるので、押し切れるようガードを大きく取る。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

const shapes = [[3, 5], [5, 3], [4, 7], [7, 4], [3, 8], [8, 3], [6, 4], [4, 6], [5, 8]];
let solved = 0, optimal = 0;

for (const [w, h] of shapes) {
  for (const k of [2, 3]) {
    W = w; H = h; SIZE = w * h; buildDom();
    forcedAbilities = null; types = k;
    newPuzzle(w * 1000 + h * 10 + k);

    // 1. 返ってきた手順が本当に目標に着くか（fire を通さず素で検算）
    const P = buildProblem();
    const start = Uint8Array.from(board, (v) => tileAbility[v]);
    const goal = Uint8Array.from(tileAbility);
    const S = solverModule();
    const res = S.solvePuzzle(P, start, goal, 1200, null);
    ok(res && res.plan, `${w}×${h} / ${k} 種: 手順が返らない`);
    if (res && res.plan) {
      const lay = Uint8Array.from(start);
      let legal = true;
      for (const [i, dir] of res.plan) {
        const cyc = P.cyc[lay[i]][i];
        if (!cyc) { legal = false; break; }
        applyTo(lay, cyc, dir);
      }
      ok(legal, `${w}×${h} / ${k} 種: 使えない位置の手が入っている`);
      ok(legal && lay.every((v, i) => v === goal[i]), `${w}×${h} / ${k} 種: 手順が目標に着かない`);
      if (res.optimal) optimal++;
    }

    // 2. ゲーム側の経路（requestSolve → activeRuns → fire）でも揃うか
    requestSolve();
    let guard = 0;
    while (!locked && activeRuns().length && guard++ < 40000) {
      const r = activeRuns()[0];
      fire(r.i, r.n <= r.order - r.n ? 1 : -1);
    }
    ok(isSolved(), `${w}×${h} / ${k} 種: ヒントどおりに押しても揃わない（${guard} 手）`);
    if (isSolved()) solved++;
  }
}

console.log(`長方形 ${shapes.length * 2} 局面のうち ${solved} 局面が揃った（うち最短と確定 ${optimal} 件）`);
console.log(fail ? `\n長方形のソルバー: 失敗 ${fail} 件` : '\n長方形のソルバー: 全チェック通過');

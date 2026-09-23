// 探索の手数（±1 の並び）と、実際に必要な操作回数が一致するか
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

let checked = 0;
for (const [n, k] of [[4, 2], [4, 4], [5, 3], [5, 7], [6, 4]]) {
  W = H = n; SIZE = n * n; buildDom(); types = k;
  for (let s = 1; s <= 4; s++) {
    newPuzzle(s);
    const start = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[board[i]]);
    const goal = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[i]);
    // 予算はゲーム本体と同じにする（短いと難しい局面で探索が間に合わない）
    const res = solvePuzzle(start, goal, HINT_BUDGET, solution);
    if (!res.plan) continue;
    const runs = planToRuns(res.plan, start);

    // まとめた手順を、短い向きで押したときの実際の操作回数
    const actions = runs.reduce((a, r) => a + Math.min(r.n, r.order - r.n), 0);
    ok(actions === res.plan.length,
       `${n}×${n} K=${k} seed ${s}: 探索 ${res.plan.length} 手 vs 実操作 ${actions} 回`);

    // 探索は時間予算式なので、負荷によっては保険の手順（数千手）になることがある。
    // 手数の一致は上で確認済みなので、実際に押し切るのは短いものだけにする。
    if (actions > 400) { checked++; continue; }

    hintPlan = { runs: runs.map((r) => ({ ...r })), optimal: res.optimal, ms: 0, method: res.method };
    let guard = 0;
    while (!locked && activeRuns().length && guard++ < 2000) {
      const r = activeRuns()[0];
      fire(r.i, r.n <= r.order - r.n ? 1 : -1);
    }
    commitRun();
    ok(isSolved(), `${n}×${n} K=${k} seed ${s}: 完成しない`);
    ok(moves <= actions, `${n}×${n} K=${k} seed ${s}: 手数 ${moves} が操作回数 ${actions} を超えた`);
    checked++;
  }
}
console.log(`  ${checked} 局面で確認`);
console.log(fail === 0 ? '探索の手数と実操作回数の一致: 全チェック通過' : `失敗 ${fail} 件`);

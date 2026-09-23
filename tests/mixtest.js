// 新しいシャッフルの検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const cost = (runs) => runs.reduce((a, r) => a + Math.min(r.n, r.order - r.n), 0);

console.log('盤    色   生成ms  保険の手順(まとまり/手数)  保険で完成するか');
for (const [n, k] of [[4, 3], [5, 4], [6, 4], [8, 6], [10, 10]]) {
  W = H = n; SIZE = n * n; buildDom(); types = k;
  const ts = [], lens = [];
  for (let s = 1; s <= 5; s++) {
    const t0 = process.hrtime.bigint();
    newPuzzle(s);
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
    ok(!isSolved(), `${n}×${n} K=${k} seed ${s}: 完成済みで出てきた`);
    ok(solution.length > 0, `${n}×${n} K=${k} seed ${s}: 保険の手順が空`);
    lens.push([solution.length, cost(solution)]);

    // 保険の手順どおり押すと本当に完成するか
    const snapshot = [...board];
    let guard = 0;
    while (!locked && solution.length && guard++ < 60000) {
      const r = solution[0];
      fire(r.i, r.n <= r.order - r.n ? 1 : -1);
    }
    ok(isSolved(), `${n}×${n} K=${k} seed ${s}: 保険の手順で完成しない`);
    board = snapshot;
  }
  const avg = (f) => (lens.reduce((a, l) => a + f(l), 0) / lens.length).toFixed(0);
  console.log(`${n}×${n}  ${k}   ${(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(0).padStart(5)}   ${avg((l) => l[0]).padStart(7)} / ${avg((l) => l[1]).padStart(7)}`);
}
console.log(fail === 0 ? '\n新しいシャッフル: 全チェック通過' : `\n失敗 ${fail} 件`);

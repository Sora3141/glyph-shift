// 表示される「残り N 手」が、実際に必要な手数と一致するか
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

for (const [n, k, seed] of [[4, 4, 4], [5, 3, 9], [6, 2, 2]]) {
  W = H = n; SIZE = n * n; buildDom(); types = k; newPuzzle(seed);
  showHint();
  const shown = Number(el('log').textContent.match(/(\d+) 手/)[1]);

  // 表示どおりに押して、実際の手数と一致するか
  let guard = 0;
  while (!locked && activeRuns().length && guard++ < 600) {
    const r = activeRuns()[0];
    fire(r.i, r.n <= r.order - r.n ? 1 : -1);
  }
  commitRun();
  ok(isSolved(), `${n}×${n} K=${k}: 完成しない`);
  ok(moves === shown, `${n}×${n} K=${k}: 表示 ${shown} 手 / 実際 ${moves} 手`);
  console.log(`  ${n}×${n} ${k} 種: 表示 ${shown} 手 = 実際 ${moves} 手`);
}
console.log(fail === 0 ? '残り手数の表示: 全チェック通過' : `失敗 ${fail} 件`);

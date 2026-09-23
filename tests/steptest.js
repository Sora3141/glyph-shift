// どの盤面でも「順に」揃うことの検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

console.log('盤       色   手順      進め方（1 回の手数 × 間隔）  ティック数  想定時間   完成');
for (const [n, k, s] of [[4,3,3],[5,4,1],[6,3,3],[8,4,2],[10,10,1]]) {
  W = H = n; SIZE = n*n; buildDom(); types = k; newPuzzle(s);
  requestSolve();
  const cost = planCost(activeRuns());
  const { interval, chunk } = autoPace(cost);

  // 実際に自動再生して、盤面が段階的に進むことを見る
  const snapshots = [];
  let ticks = 0;
  el('solveBtn').fire('click', {});
  const realSet = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => {
    if (ms === interval || (ms >= 60 && ms <= 340)) { ticks++; snapshots.push([...board]); fn(); return 0; }
    return realSet(fn, ms);
  };
  el('confirmYes').fire('click', {});
  globalThis.setTimeout = realSet;

  ok(isSolved(), `${n}×${n} K=${k}: 揃わない`);
  ok(ticks > 1, `${n}×${n} K=${k}: ティックが ${ticks} 回（段階的に進んでいない）`);

  // 一気に飛んでいないこと: 途中の盤面が完成形と違う
  const mid = snapshots[Math.floor(snapshots.length / 2)];
  ok(mid && mid.some((v, i) => v !== i), `${n}×${n} K=${k}: 途中で既に完成している（一気に揃えている）`);

  const secs = (ticks * interval / 1000).toFixed(1);
  console.log(`${n}×${n}${n<10?' ':''}   ${String(k).padStart(2)}   ${String(cost).padStart(6)} 手   ${String(chunk).padStart(3)} 手 × ${String(interval).padStart(3)}ms      ${String(ticks).padStart(5)}      ${secs.padStart(5)} 秒   ${isSolved() ? 'OK' : 'NG'}`);
}
console.log(fail === 0 ? '\n順に揃える: 全チェック通過' : `\n失敗 ${fail} 件`);

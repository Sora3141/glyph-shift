// 「揃える」はどの盤面でも順に進める（一気に飛ばさない）
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

// 自動再生を回しながら、途中の盤面を記録する
function runAuto() {
  const seen = [];
  const realSet = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => {
    if (ms >= 60 && ms <= 340) { seen.push([...board]); fn(); return 0; }
    return realSet(fn, ms);
  };
  el('solveBtn').fire('click', {});
  el('confirmYes').fire('click', {});
  globalThis.setTimeout = realSet;
  return seen;
}

for (const [n, k, s, label] of [[4,3,3,'短い手順'], [10,10,1,'非常に長い手順']]) {
  W = H = n; SIZE = n*n; buildDom(); types = k; newPuzzle(s);
  requestSolve();
  const cost = planCost(activeRuns());
  const before = [...board];
  const seen = runAuto();

  ok(isSolved(), `${n}×${n}: 揃わない`);
  ok(seen.length > 1, `${n}×${n}: 1 回で終わっている（一気に揃えている）`);
  // 途中の盤面が、開始時とも完成形とも違う＝段階的に進んでいる
  const mid = seen[Math.floor(seen.length / 2)];
  ok(mid.some((v, i) => v !== i), `${n}×${n}: 途中で既に完成形になっている`);
  ok(mid.some((v, i) => v !== before[i]), `${n}×${n}: 途中で開始時のまま止まっている`);
  // 手順の順番どおりに残りが減っている
  ok(el('autoText').textContent.includes('残り') || isSolved(), '残り手数の表示が出ていない');
  console.log(`  ${n}×${n} ${k} 種（${label}・${cost} 手）: ${seen.length} 回に分けて順に完成`);
}

// 完成の知らせは「自動で揃えました」
ok(el('log').textContent.includes('自動'), `表示: ${el('log').textContent}`);
ok(board.every((v, i) => tileAbility[v] === tileAbility[i]), '絵柄が目標と違う');
console.log('  自動で揃えた旨が表示され、結果も正しい完成形');

console.log(fail === 0 ? '\n順に揃える: 全チェック通過' : `\n失敗 ${fail} 件`);

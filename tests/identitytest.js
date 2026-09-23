// 「同じ絵柄は入れ替え可能」を本当に前提にできているかの確認
// 注: Worker が無い環境（このテスト）では同期の短い予算で解くため、
// 手順が保険（数千手）になることがある。押し切れるようガードを大きく取る。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// 1. 状態空間が「絵柄の並び」で数えられていること（タイル個体では数えていない）
console.log('状態空間の比較（4×4）');
const fact = (n) => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
const multinom = (counts) => {
  let r = fact(counts.reduce((a, b) => a + b, 0));
  for (const c of counts) r /= fact(c);
  return r;
};
for (const k of [2, 3, 4]) {
  W = H = 4; SIZE = 16; buildDom(); types = k; newPuzzle(1);
  const counts = {};
  for (const a of tileAbility) counts[a] = (counts[a] || 0) + 1;
  const layouts = multinom(Object.values(counts));
  console.log(`  ${k} 色 (${Object.values(counts).join('/')})  タイル個体で数えると ${fact(16)} 通り / 絵柄の並びなら ${layouts} 通り`);
}

// 2. 目標に到達したとき、タイルの並びは元の並びと違ってよい
console.log('\n揃えたあとのタイル配置');
let differed = 0, total = 0;
for (const [n, k] of [[4, 2], [4, 3], [5, 2], [5, 4], [6, 3]]) {
  W = H = n; SIZE = n * n; buildDom(); types = k;
  for (let s = 1; s <= 6; s++) {
    newPuzzle(s);
    requestSolve();
    let guard = 0;
    while (!locked && activeRuns().length && guard++ < 20000) {
      const r = activeRuns()[0];
      fire(r.i, r.n <= r.order - r.n ? 1 : -1);
    }
    ok(isSolved(), `${n}×${n} K=${k} seed ${s}: 揃わなかった`);
    // 絵柄は目標どおり
    ok(board.every((v, i) => tileAbility[v] === tileAbility[i]),
       `${n}×${n} K=${k} seed ${s}: 絵柄が目標と違う`);
    // ただしタイルの個体の位置は元どおりとはかぎらない
    total++;
    if (board.some((v, i) => v !== i)) differed++;
  }
}
console.log(`  ${total} 局面中 ${differed} 局面で、タイルの個体位置は元と違う（絵柄は一致）`);
ok(differed > 0, '個体位置が必ず元どおりになっている＝入れ替え可能性を使えていない');

// 3. 「個体まで元どおり」にする逆手順と、絵柄だけ合わせる最短の差
console.log('\n絵柄だけ合わせる場合と、個体まで戻す場合の手数');
for (const [n, k] of [[4, 2], [4, 3], [5, 2], [5, 3]]) {
  W = H = n; SIZE = n * n; buildDom(); types = k;
  let sumOpt = 0, sumRev = 0, cnt = 0, optCnt = 0;
  for (let s = 1; s <= 6; s++) {
    newPuzzle(s);
    const start = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[board[i]]);
    const goal = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[i]);
    const res = solvePuzzle(start, goal, 900, solution);
    if (!res.plan) continue;
    // 逆手順は個体まで元どおりに戻す手順
    const revActions = solution.reduce((a, r) => a + Math.min(r.n, r.order - r.n), 0);
    sumOpt += res.plan.length; sumRev += revActions; cnt++;
    if (res.optimal) optCnt++;
  }
  console.log(`  ${n}×${n} ${k} 色: 絵柄だけ ${(sumOpt / cnt).toFixed(1)} 手 / 個体まで戻す ${(sumRev / cnt).toFixed(1)} 手` +
              `（最短と確定 ${optCnt}/${cnt}）`);
}

console.log(fail === 0 ? '\n入れ替え可能性の扱い: 全チェック通過' : `\n失敗 ${fail} 件`);

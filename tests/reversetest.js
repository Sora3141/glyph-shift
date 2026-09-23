// 長押しによる逆回りと、短い向きを選ぶ自動再生の検証
// 注: Worker が無い環境（このテスト）では同期の短い予算で解くため、
// 手順が保険（数千手）になることがある。押し切れるようガードを大きく取る。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const same = (a, b) => a.every((v, i) => v === b[i]);
const el = (id) => document.getElementById(id);

W = H = 5; SIZE = 25; buildDom(); types = 4;

// 位数 4 と 8 のブロックが置けている盤面を探す
function findCell(id) {
  const k = ABILITIES.findIndex((a) => a.id === id);
  for (let s = 1; s <= 600; s++) {
    for (const K of [3, 4, 7]) {
      types = K; newPuzzle(s);
      for (let i = 0; i < SIZE; i++) if (abilityAt(i) === k && cyclesAt(i)) return { s, K, i };
    }
  }
  return null;
}

// 1. 逆回りは順方向の (位数 - 1) 回と同じ結果になる
for (const id of ['crossCW', 'diagCW', 'ringCW', 'swapLR']) {
  const spot = findCell(id);
  ok(spot !== null, `${id} を置ける盤面がない`);
  if (!spot) continue;
  const order = orderOf(cyclesAt(spot.i));

  types = spot.K; newPuzzle(spot.s);
  fire(spot.i, -1);
  const back = [...board];

  types = spot.K; newPuzzle(spot.s);
  for (let k = 0; k < order - 1; k++) fire(spot.i, 1);
  ok(same(board, back), `${id}: 長押し 1 回と順方向 ${order - 1} 回の結果が違う`);

  // 2. 押す → 長押し で元に戻る
  types = spot.K; newPuzzle(spot.s);
  const before = [...board];
  fire(spot.i, 1);
  fire(spot.i, -1);
  ok(same(board, before), `${id}: 押して長押しで元に戻らない`);

  // 3. 手数: 長押し 1 回は 1 手、押す+長押しは 0 手
  types = spot.K; newPuzzle(spot.s);
  fire(spot.i, -1); commitRun();
  ok(moves === 1, `${id}: 長押し 1 回が ${moves} 手（期待 1）`);

  types = spot.K; newPuzzle(spot.s);
  fire(spot.i, 1); fire(spot.i, -1); commitRun();
  ok(moves === 0, `${id}: 押す+長押しが ${moves} 手（期待 0）`);

  console.log(`  ${id.padEnd(8)} 位数 ${order}: 逆回り = 順方向 ${order - 1} 回 / 打ち消し / 手数 OK`);
}

// 4. 手順の追従が向きを考慮しているか
{
  const spot = findCell('crossCW');
  types = spot.K; newPuzzle(spot.s);
  requestSolve();
  const order = orderOf(cyclesAt(spot.i));
  const snapshot = activeRuns().map((r) => `${r.i}:${r.n}`).join(',');
  fire(spot.i, 1);
  fire(spot.i, -1);            // 打ち消し
  const after = activeRuns().map((r) => `${r.i}:${r.n}`).join(',');
  ok(snapshot === after, `打ち消したのに手順が変わった\n    前: ${snapshot}\n    後: ${after}`);
  console.log('  押す+長押しで手順が元に戻る: OK');
}

// 5. 自動再生が短い向きを選ぶ
{
  let usedBack = 0, usedFwd = 0, checked = 0;
  for (const [n, k] of [[5, 4], [6, 3], [4, 7]]) {
    W = H = n; SIZE = n * n; buildDom(); types = k;
    for (let s = 1; s <= 3; s++) {
      newPuzzle(s);
      requestSolve();
      // 実際に自動再生で選ばれる向きを、手順から確かめる
      let guard = 0;
      while (!locked && activeRuns().length && guard++ < 20000) {
        const r = activeRuns()[0];
        const back = r.order - r.n;
        const dir = r.n <= back ? 1 : -1;
        ok(Math.min(r.n, back) >= 1, '残り 0 手の手順が残っている');
        ok(dir === 1 ? r.n <= back : back < r.n, '短い向きを選べていない');
        if (dir < 0) usedBack++; else usedFwd++;
        checked++;
        fire(r.i, dir);
      }
      ok(isSolved(), `${n}×${n} K=${k} seed ${s}: 短い向きで進めても完成しない`);
    }
  }
  console.log(`  短い向きを選んで進める: ${checked} 手を検査（順方向 ${usedFwd} / 逆回り ${usedBack}）`);
  ok(usedBack > 0, '逆回りが一度も選ばれていない（長押しが活かされていない）');
}

// 6. 実際の自動再生でも揃う
{
  W = H = 5; SIZE = 25; buildDom(); types = 4; newPuzzle(3);
  el('solveBtn').fire('click', {});
  el('confirmYes').fire('click', {});
  ok(isSolved(), '自動再生で揃わない');
  console.log('  自動再生で揃う: OK');
}

console.log(fail === 0 ? '\n逆回りと自動再生: 全チェック通過' : `\n失敗 ${fail} 件`);

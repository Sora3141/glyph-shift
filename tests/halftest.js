// 新しい半回転の 3 種が、宣言どおりの動きになっているかの確認
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const same = (a, b) => a.every((v, i) => v === b[i]);

W = H = 5; SIZE = 25; buildDom();
const idx2 = (id) => ABILITIES.findIndex((a) => a.id === id);
const center = idx(2, 2);

// n 回まわした結果
const spin = (id, times) => {
  const b = Array.from({ length: SIZE }, (_, i) => i);
  const cyc = cyclesOf(idx2(id), 2, 2);
  for (let k = 0; k < times; k++) applyTo(b, cyc, 1);
  return b;
};
const once = (id) => spin(id, 1);

console.log('回転を繰り返したものと一致するか');
for (const [half, base, times] of [['crossHalf', 'crossCW', 2], ['diagHalf', 'diagCW', 2], ['ringHalf', 'ringCW', 4]]) {
  ok(same(once(half), spin(base, times)), `${half} が ${base} ${times} 回と一致しない`);
  console.log(`  ${half.padEnd(10)} = ${base} を ${times} 回`);
}

console.log('\n位数と性質');
for (const id of ['crossHalf', 'diagHalf', 'ringHalf']) {
  const k = idx2(id);
  const cyc = cyclesOf(k, 2, 2);
  const o = orderOfCycles(cyc);
  ok(o === 2, `${id} の位数が ${o}（期待 2）`);
  // 2 回押すと元に戻る
  ok(same(spin(id, 2), Array.from({ length: SIZE }, (_, i) => i)), `${id} を 2 回で元に戻らない`);
  // 長押し（逆向き）は押すのと同じ結果
  const b = Array.from({ length: SIZE }, (_, i) => i);
  applyTo(b, cyc, -1);
  ok(same(b, once(id)), `${id} は長押しでも同じ結果になるはず`);
  // 自分は動かない / 重複なし / 盤内
  const seen = new Set();
  for (const c of cyc) {
    ok(c.length === 2, `${id}: 入れ替えでないサイクル長 ${c.length}`);
    for (const v of c) {
      ok(v !== center, `${id}: 自分が動いている`);
      ok(!seen.has(v), `${id}: マス重複`);
      seen.add(v);
    }
  }
  console.log(`  ${id.padEnd(10)} 位数 ${o} / ${cyc.length} 組の入れ替え / ${seen.size} マスが動く`);
}

// 使える位置は元の回転と同じ（必要とする近傍が同じなので）
console.log('\n使える位置');
for (const [half, base] of [['crossHalf', 'crossCW'], ['diagHalf', 'diagCW'], ['ringHalf', 'ringCW']]) {
  for (const n of [4, 5, 6]) {
    W = H = n; SIZE = n * n;
    const count = (id) => { let c = 0; for (let i = 0; i < SIZE; i++) if (cyclesOf(idx2(id), i % n, Math.floor(i / n))) c++; return c; };
    ok(count(half) === count(base), `${n}×${n} ${half} の使える位置が ${base} と違う`);
  }
  console.log(`  ${half.padEnd(10)} は ${base} と同じ位置で使える`);
}

console.log(fail === 0 ? '\n半回転の 3 種: 全チェック通過' : `\n失敗 ${fail} 件`);

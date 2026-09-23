// 無効化ロジックが実際に機能するかの確認（現在の範囲では発動しないため単体で検査）
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
// マス数に収まる色数はすべて使える（正規の柄が無い組み合わせは予備の並べ方に落ちる）
for (const n of SIZES) for (const k of TYPE_COUNTS) {
  const fits = k <= n * n;
  ok(typeAvailable(n, n, k) === fits,
     `${n}×${n} / ${k} 種の判定が ${typeAvailable(n, n, k)}（マスに${fits ? '収まる' : '収まらない'}）`);
}
// 本当に無理なものは弾く
ok(typeAvailable(4, 4, ABILITIES.length + 1) === false, '能力の総数を超える色数が使える判定になっている');
ok(typeAvailable(2, 2, 5) === false, '2×2 / 5 種（盤より色数が多い）が使える判定になっている');
ok(candidatePatterns(3, 3, 10) .length === 0, 'マス数より多い色数で並べ方が返っている');
ok(candidatePatterns(4, 4, 3).length > 0, '4×4 / 3 種の柄が見つからない');
// 目標の柄の表示幅
for (const n of [4, 6, 8, 10]) {
  W = H = n; SIZE = n * n; buildDom();
  const cell = Math.min(30, Math.floor((228 - 4 * (n - 1)) / n));
  const w = cell * n + 4 * (n - 1);
  ok(w <= 250, `${n}×${n} の目標の柄が ${w}px でサイドバー幅を超える`);
  console.log(`  ${n}×${n} 目標の柄: セル ${cell}px / 全幅 ${w}px`);
}
console.log(fail === 0 ? '無効化ロジックと表示幅: OK' : `失敗 ${fail} 件`);

// 取り込んだ柄の検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

ok(typeof tilePatterns === 'function', 'patterns.js が読み込まれていない');
const imported = tilePatterns().PATTERNS.map((p) => p.id);
ok(PATTERNS.length >= imported.length + 8, `柄が ${PATTERNS.length} 種しかない`);
console.log(`柄の総数: ${PATTERNS.length} 種（元から 8 + 図鑑から ${imported.length}）`);

// 1. どの柄も 0..k-1 の整数だけを返す
console.log('\n出力の健全性（全サイズ × 全色数）');
let checked = 0;
for (const n of SIZES) for (const k of TYPE_COUNTS) {
  if (k > n * n) continue;
  for (const p of PATTERNS) {
    if (!p.ok(n, n, k)) continue;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = p.fn(x, y, n, n, k);
      if (!Number.isInteger(v) || v < 0 || v >= k) {
        ok(false, `${p.id} (${n}×${n}, ${k} 色) の (${x},${y}) が ${v}`);
        y = n; x = n; break;
      }
      checked++;
    }
  }
}
console.log(`  ${checked.toLocaleString()} マスを確認、すべて 0〜k-1 の整数`);

// 2. 各サイズ・色数で実際に使える柄の数（重複を除いたあと）
console.log('\n実際に使える柄の数（同じ配置は 1 つにまとめたあと）');
console.log('       ' + TYPE_COUNTS.map((k) => String(k).padStart(4)).join(''));
for (const n of SIZES) {
  const row = TYPE_COUNTS.map((k) => (k > n * n ? '   -' : String(candidatePatterns(n, n, k).length).padStart(4)));
  console.log(`  ${n}×${n}${n < 10 ? ' ' : ''}  ` + row.join(''));
}

// 3. 以前より増えているか
console.log('\n以前（8 柄だけ）との比較');
const base = ['diag','bands','rows','cols','rings','frame','halves','quads','serial'];
for (const [n, k] of [[4,2],[5,3],[6,4],[8,3],[10,4]]) {
  const all = candidatePatterns(n, n, k);
  const old = all.filter((p) => base.includes(p.id)).length;
  console.log(`  ${n}×${n} ${k} 色: ${old} → ${all.length} 種`);
  ok(all.length >= old, `${n}×${n} ${k} 色で減っている`);
}
console.log(fail === 0 ? '\n取り込んだ柄: 全チェック通過' : `\n失敗 ${fail} 件`);

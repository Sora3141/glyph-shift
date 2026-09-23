// 柄のなかの色の並び順がランダムになっているか
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const hueAt = (i) => Number(bgOf(tileAbility[i]).match(/hsl\((\d+)/)[1]);

// 柄を固定して、そのなかの色の並びが散らばるかを見る
function survey(n, k, patId, cells) {
  const seqs = new Map();
  const firstHue = new Map();
  let hits = 0;
  W = H = n; SIZE = n * n; buildDom(); types = k;
  for (let s = 1; s <= 1500 && hits < 120; s++) {
    newPuzzle(s);
    // その盤面が狙った柄かどうかを、目標配置から判定する
    const p = PATTERNS.find((q) => q.id === patId);
    const want = Array.from({ length: SIZE }, (_, i) => p.fn(xOf(i), yOf(i), n, n, k));
    const map = new Map(); const used = new Set(); let match = true;
    for (let i = 0; i < SIZE && match; i++) {
      const a = tileAbility[i];
      if (map.has(want[i])) { if (map.get(want[i]) !== a) match = false; }
      else if (used.has(a)) match = false;
      else { map.set(want[i], a); used.add(a); }
    }
    if (!match) continue;
    hits++;
    const seq = cells.map(hueAt).join(',');
    seqs.set(seq, (seqs.get(seq) || 0) + 1);
    const h = hueAt(cells[0]);
    firstHue.set(h, (firstHue.get(h) || 0) + 1);
  }
  return { hits, seqs, firstHue };
}

console.log('同じ柄のなかで、色の並びが何通り出るか');
for (const [n, k, pat, cells, label] of [
  [5, 3, 'rows', [idx(0, 0), idx(0, 1), idx(0, 2)], '横じま 3 色（上から 3 行の色）'],
  [5, 4, 'cols', [idx(0, 0), idx(1, 0), idx(2, 0), idx(3, 0)], '縦じま 4 色（左から 4 列の色）'],
  [6, 2, 'diag', [idx(0, 0), idx(1, 0)], '市松 2 色'],
]) {
  const r = survey(n, k, pat, cells);
  ok(r.hits >= 10, `${label}: 標本が ${r.hits} 件しか集まらない`);
  const kinds = r.seqs.size;
  ok(kinds > 1, `${label}: 並びが ${kinds} 通りしかない（固定されている）`);
  // 色はブロックごとに固定なので、毎回どのブロックが選ばれるかで並びが変わる。
  // 先頭に来る色が 1 色に張り付いていないことを見る。
  ok(r.firstHue.size >= 2, `${label}: 先頭がいつも同じ色になっている`);
  console.log(`  ${label}: ${r.hits} 標本 / ${kinds} 通りの並び / 先頭に来た色 ${r.firstHue.size} 種`);
  console.log(`     内訳: ${[...r.firstHue.entries()].sort((a, b) => b[1] - a[1]).map(([h, c]) => `${h}°×${c}`).join(' ')}`);
}


console.log(fail === 0 ? '\n柄のなかの色の並び: 全チェック通過' : `\n失敗 ${fail} 件`);

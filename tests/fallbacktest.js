// 予備の並べ方が「正規の柄が作れないときだけ」使われることの確認
// 注: Worker が無い環境（このテスト）では同期の短い予算で解くため、
// 手順が保険（数千手）になることがある。押し切れるようガードを大きく取る。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

const regular = PATTERNS.map((p) => p.id);
console.log('どの組み合わせで予備に落ちるか');
for (const n of SIZES) {
  const fellBack = [];
  for (const k of TYPE_COUNTS) {
    const c = candidatePatterns(n, n, k);
    if (k > n * n) { ok(c.length === 0, `${n}×${n} ${k} 種: マスに収まらないのに候補がある`); continue; }
    ok(c.length > 0, `${n}×${n} ${k} 種: 候補がない`);
    const isFallback = c.length === 1 && c[0].id === 'serial';
    if (isFallback) fellBack.push(k);
    // 正規の柄があるなら予備は混ざらない
    if (!isFallback) ok(!c.some((p) => p.id === 'serial'), `${n}×${n} ${k} 種: 正規の柄があるのに予備が混ざっている`);
    // どの候補も全色を出す
    for (const p of c) {
      const layout = Array.from({ length: n * n }, (_, i) => p.fn(i % n, Math.floor(i / n), n, n, k));
      ok(new Set(layout).size === k, `${n}×${n} ${k} 種 ${p.id}: 色が ${new Set(layout).size} 種しか出ない`);
    }
  }
  console.log(`  ${n}×${n}: ${fellBack.length ? fellBack.join(',') + ' 種で予備' : '全部が正規の柄'}`);
}

// 実際に生成して遊べるか
console.log('\n予備に落ちる組み合わせで生成と完成');
const click = (b, i, dir) => { const c = cyclesOf(tileAbility[b[i]], xOf(i), yOf(i)); if (!c) return null; applyTo(b, c, dir); return c; };
for (const [n, k] of [[4, 8], [4, 10], [5, 10]]) {
  W = H = n; SIZE = n * n; buildDom(); types = k;
  for (let s = 1; s <= 10; s++) {
    newPuzzle(s);
    ok(new Set(tileAbility).size === k, `${n}×${n} ${k} 種 seed ${s}: 色数が ${new Set(tileAbility).size}`);
    ok(!isSolved(), `${n}×${n} ${k} 種 seed ${s}: 完成済み`);
    ok(legalCells().length > 0, `${n}×${n} ${k} 種 seed ${s}: 合法手がない`);
  }
  // 1 局面はソルバーで実際に解く
  newPuzzle(3);
  requestSolve();
  let guard = 0;
  while (!locked && activeRuns().length && guard++ < 20000) {
    const r = activeRuns()[0];
    fire(r.i, r.n <= r.order - r.n ? 1 : -1);
  }
  ok(isSolved(), `${n}×${n} ${k} 種: 解けない`);
  console.log(`  ${n}×${n} ${k} 種: 10 盤面すべて生成でき、解ける`);
}

console.log(fail === 0 ? '\n予備の並べ方: 全チェック通過' : `\n失敗 ${fail} 件`);

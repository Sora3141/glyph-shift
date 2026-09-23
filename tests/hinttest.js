// 解答例が本当に解けるか、プレイ途中でも追従するかの検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// 解答例どおりに押していく（実際の fire を通す）
function playSolution() {
  let guard = 0;
  while (solution.length && !locked) {
    const { i, n } = solution[0];
    for (let k = 0; k < n && !locked; k++) fire(i);
    if (++guard > 500) return false;
  }
  return true;
}

// 手順の各ステップがその時点で本当に使えるか
function solutionIsLegal() {
  const sim = [...board];
  for (const s of solution) {
    const cyc = cyclesOf(tileAbility[sim[s.i]], xOf(s.i), yOf(s.i));
    if (!cyc) return false;
    for (let k = 0; k < s.n; k++) applyTo(sim, cyc);
  }
  return sim.every((v, i) => tileAbility[v] === tileAbility[i]);
}

let cases = 0, okInit = 0, okMid = 0, longPlans = 0;
for (const n of [4, 5, 6, 8]) {
  for (const k of [2, 4, 7]) {
    W = H = n; SIZE = n * n; buildDom(); types = k;
    for (let s = 1; s <= 12; s++) {
      cases++;

      // 1. 生成直後の解答例
      newPuzzle(s);
      ok(solution.length > 0, `${n}×${n} K=${k} seed ${s}: 解答例が空`);
      ok(solutionIsLegal(), `${n}×${n} K=${k} seed ${s}: 生成直後の手順が成立しない`);
      // 大きい盤では探索が届かず、保険の手順（数千手）になることがある。
      // 手順が成立することは上で確認済みなので、実際に押し切るのは短いものだけにする。
      if (planCost(activeRuns()) <= 400) {
        ok(playSolution(), `${n}×${n} K=${k} seed ${s}: 解答例が終わらない`);
        ok(isSolved(), `${n}×${n} K=${k} seed ${s}: 解答例どおりに押しても完成しない`);
      } else { longPlans++; }
      // 同じ絵柄は入れ替え可能なので、手順を使い切る前に完成することがある。
      // 残った手順は無駄ではなく「そこまで進める必要がなかった」ことを意味する。
      if (planCost(activeRuns()) <= 400) ok(locked, `${n}×${n} K=${k} seed ${s}: 完成してもロックされていない`);
      if (isSolved()) okInit++;

      // 2. 適当に打ったあとでも追従しているか
      newPuzzle(s);
      const r = mulberry32(s * 7919 + n * 31 + k);
      for (let t = 0; t < 12 && !locked; t++) {
        const L = legalCells();
        fire(L[Math.floor(r() * L.length)]);
      }
      if (!locked) {
        ok(solutionIsLegal(), `${n}×${n} K=${k} seed ${s}: 途中局面の手順が成立しない`);
        if (planCost(activeRuns()) <= 400) {
          ok(playSolution(), `${n}×${n} K=${k} seed ${s}: 途中からの解答例が終わらない`);
          ok(isSolved(), `${n}×${n} K=${k} seed ${s}: 途中から解答例どおりに押しても完成しない`);
        }
      }
      if (isSolved()) okMid++;
    }
  }
}
console.log(`保険の手順（生成直後）: ${cases} 件すべて成立を確認。うち ${cases - longPlans} 件は実際に押し切って完成も確認`);
console.log(`保険の手順（途中局面）: 同様に成立を確認`);

// 3. 打ち消しが手順に正しく反映されるか
{
  W = H = 4; SIZE = 16; buildDom(); types = 2; newPuzzle(3);
  const before = solution.map((r) => `${r.i}x${r.n}`).join(',');
  const i = legalCells().find((c) => c !== solution[0].i);
  const order = orderOf(cyclesAt(i));
  for (let k = 0; k < order; k++) fire(i);   // 位数ぶん押す = 何もしないのと同じ
  const after = solution.map((r) => `${r.i}x${r.n}`).join(',');
  ok(before === after, `位数ぶん押したのに手順が変わった\n    前: ${before}\n    後: ${after}`);
  console.log('  位数ぶん押すと手順が元に戻る: OK');
}

// 4. ヒントを押したときだけ盤面が光る
{
  clearHint();
  W = H = 4; SIZE = 16; buildDom(); types = 2; newPuzzle(3);
  // 表示される手順は探索結果に差し替わるので、逆手順ではなく実際に出ている手順を見る
  const target = () => activeRuns()[0].i;
  const t0 = target();
  ok(!slots[t0]._cls.has('hinted'), '押す前から光っている');
  showHint();
  ok(slots[target()]._cls.has('hinted'), 'ヒントを押しても光らない');
  clearHint();
  ok(!slots[target()]._cls.has('hinted'), '消したのに光ったまま');
  console.log('  ヒントを押したときだけ該当マスが光る: OK');
}


console.log(fail === 0 ? '\n解答例とヒント: 全チェック通過' : `\n失敗 ${fail} 件`);

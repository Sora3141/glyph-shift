// ソルバーの計測。Node で実行する。
//   node tools/bench.js <幅>x<高さ> <ブロック数> <盤面数> [予算ms] [最初のSEED]
//   node tools/bench.js <一辺>      <ブロック数> <盤面数> [予算ms] [最初のSEED]
// 例: node tools/bench.js 6    4 10 3000    (6×6)
//     node tools/bench.js 4x8  3 10 3000    (横4×縦8)
//
// script.js を DOM の代わり物で読み込み、newPuzzle で盤面を作ってから
// solver.js の solvePuzzle を直接呼ぶ。手順は別途たどって目標に着くか検算する。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const { solverModule } = require(path.join(root, 'solver.js'));

// DOM を丸ごと吸い込む代わり物
const stub = () => new Proxy(function () {}, {
  get: (t, k) => {
    if (k === 'length') return 0;
    if (k === Symbol.iterator) return function* () {};
    if (k === 'hidden') return true;
    if (k === 'textContent' || k === 'value' || k === 'innerHTML') return '';
    return stub();
  },
  set: () => true, apply: () => stub(), construct: () => stub(),
});

const ctx = {
  console, performance, Math, Number, String, Array, Uint8Array, Int8Array, Map, Set, Symbol, Object,
  setTimeout: () => 0, clearTimeout() {},
  document: stub(), matchMedia: () => ({ matches: true }),
  solverModule, solverWorkerMain() {},
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['sound.js', 'script.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });

vm.runInContext(`
  globalThis.__setup = (w, h, k) => { W = w; H = h; SIZE = w * h; types = k; buildDom(); };
  globalThis.__new = (s) => {
    newPuzzle(s);
    return {
      P: problem,
      start: Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[board[i]]),
      goal: Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[i]),
      fallback: Solver.runsToPlan(solution),
      fallbackCost: planCost(solution),
    };
  };
`, ctx);

const args = process.argv.slice(2);
const dim = String(args[0] || '4');
const mm = dim.match(/^(\d+)[xX\u00d7](\d+)$/);
const bw = mm ? Number(mm[1]) : Number(dim);
const bh = mm ? Number(mm[2]) : Number(dim);
const [k, trials, budgetArg, seedArg] = args.slice(1).map(Number);
const budget = budgetArg || 3000;
const seed0 = seedArg || 1000;
const api = solverModule();

ctx.__setup(bw, bh, k);
const rows = [];
for (let t = 0; t < trials; t++) {
  const p = ctx.__new(seed0 + t);
  const r = api.solvePuzzle(p.P, p.start, p.goal, budget, p.fallback);
  let check = 'none';
  if (r.plan) {
    // 合法性: 押せないマスを押していないか / 終点が目標か
    let ok = true;
    const lay = Uint8Array.from(p.start);
    for (const [i, dir] of r.plan) {
      const cyc = p.P.cyc[lay[i]][i];
      if (!cyc) { ok = false; break; }
      for (const c of cyc) {
        if (dir > 0) { const last = lay[c[c.length - 1]]; for (let q = c.length - 1; q > 0; q--) lay[c[q]] = lay[c[q - 1]]; lay[c[0]] = last; }
        else { const first = lay[c[0]]; for (let q = 0; q < c.length - 1; q++) lay[c[q]] = lay[c[q + 1]]; lay[c[c.length - 1]] = first; }
      }
    }
    check = !ok ? 'ILLEGAL' : api.keyOf(lay) === api.keyOf(p.goal) ? 'ok' : 'WRONG';
  }
  const cost = r.plan ? api.planCost(p.P, r.plan, p.start) : -1;
  const row = { seed: seed0 + t, method: r.method, optimal: r.optimal, cost, fallback: p.fallbackCost, ms: Math.round(r.ms), check, tried: r.tried };
  rows.push(row);
  console.log(JSON.stringify(row));
}
const methods = {};
for (const r of rows) methods[r.method] = (methods[r.method] || 0) + 1;
const costs = rows.map((r) => r.cost);
console.log(`盤=${bw}x${bh} K=${k} budget=${budget} methods=${JSON.stringify(methods)} cost avg=${Math.round(costs.reduce((a, b) => a + b, 0) / costs.length)} max=${Math.max(...costs)} ms avg=${Math.round(rows.reduce((a, r) => a + r.ms, 0) / rows.length)} max=${Math.max(...rows.map((r) => r.ms))} bad=${rows.filter((r) => r.check !== 'ok').length}`);

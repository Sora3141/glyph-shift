// 能力の効果が「平行移動で不変か」を実際の問題から確かめる。Node で実行する。
//   node tools/invariance.js [幅]x[高さ]
//   node tools/invariance.js [一辺]
// 例: node tools/invariance.js 10      (10×10)
//     node tools/invariance.js 4x8     (横4×縦8)
//
// なぜ測るか:
//   効果が平行移動で不変なら、盤の内部で見つけた手順の部品（交換子など）は
//   内部のどこでもそのまま使い回せる。つまり「押す場所の相対配置」と
//   「そこにある能力」だけを鍵にした部品の表を一度作れば、配置のたびに
//   局所探索をやり直す必要がなくなる。
//   不変でないのは縁のまわりだけ（効果が盤の外に出ると使えない）なので、
//   縁からの距離も一緒に出す。
//
// solver.js は問題の記述 P を受け取るだけで盤の形を作らないため、
// P は script.js の buildProblem に作らせる（bench.js と同じ手口）。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

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
  solverModule: require(path.join(root, 'solver.js')).solverModule,
  solverWorkerMain() {},
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['sound.js', 'glyphs.js', 'script.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
  globalThis.__setup = (w, h, k) => { W = w; H = h; SIZE = w * h; types = k; buildDom(); };
  globalThis.__problem = (s) => { newPuzzle(s); return problem; };
`, ctx);

const dim = String(process.argv[2] || '10');
const mm = dim.match(/^(\d+)[xX×](\d+)$/);
const W = mm ? Number(mm[1]) : Number(dim);
const H = mm ? Number(mm[2]) : Number(dim);

ctx.__setup(W, H, 10);            // 10 種そろえて全部の能力を見る
const P = ctx.__problem(1);

const xOf = (i) => i % W;
const yOf = (i) => Math.floor(i / W);

// サイクルを「押した場所からの相対位置」に直して正規化する
const relShape = (cycles, i) => cycles
  .map((c) => c.map((j) => `${xOf(j) - xOf(i)}:${yOf(j) - yOf(i)}`).join('>'))
  .sort().join('|');

console.log(`盤 ${W}×${H}、能力 ${P.cyc.length} 種\n`);

let allInvariant = true;
let usable = 0, unusable = 0;
const byEdge = new Map();          // 縁からの距離（2 で打ち切り）→ 押せた数 / 全体

for (let a = 0; a < P.cyc.length; a++) {
  const shapes = new Set();
  let n = 0;
  for (let i = 0; i < P.SIZE; i++) {
    const cyc = P.cyc[a][i];
    const d = Math.min(2, xOf(i), W - 1 - xOf(i), yOf(i), H - 1 - yOf(i));
    const e = byEdge.get(d) || { ok: 0, all: 0 };
    e.all++;
    if (!cyc) { unusable++; byEdge.set(d, e); continue; }
    usable++; n++; e.ok++; byEdge.set(d, e);
    shapes.add(relShape(cyc, i));
  }
  if (shapes.size > 1) allInvariant = false;
  console.log(`  能力 ${a}: 押せる位置 ${String(n).padStart(3)} / ${P.SIZE}、`
    + `相対的な効果の形 ${shapes.size} 種${shapes.size > 1 ? '  ← 平行移動で不変でない' : ''}`);
}

console.log(`\n押せる組み合わせ ${usable} / ${usable + unusable}`);
console.log('縁からの距離ごとの「押せた割合」（不変性が崩れるのは縁だけという確認）:');
for (const d of [...byEdge.keys()].sort()) {
  const e = byEdge.get(d);
  console.log(`  距離 ${d}${d === 2 ? '以上' : '  '}: ${e.ok} / ${e.all}  (${Math.round(100 * e.ok / e.all)}%)`);
}

console.log(`\n効果は平行移動で不変か: ${allInvariant ? 'YES（全能力が 1 種）' : 'NO'}`);
if (allInvariant) {
  console.log('→ 内部で見つけた部品は内部のどこでも使える。部品の表の鍵は');
  console.log('  「押す場所の相対配置 + そこにある能力 + 縁からの距離の階級」で足りる。');
}

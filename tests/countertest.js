// 「正味の操作量」で数える手数の検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

W = H = 5; SIZE = 25; buildDom();

// 位数ごとに、そのブロックが真ん中で使える盤面を作る
function findCell(abId) {
  const k = ABILITIES.findIndex((a) => a.id === abId);
  for (let s = 1; s <= 400; s++) {
    for (const K of [2, 3, 4]) {
      types = K; newPuzzle(s);
      for (let i = 0; i < SIZE; i++) {
        if (abilityAt(i) === k && cyclesAt(i)) return { seed: s, K, i };
      }
    }
  }
  return null;
}

console.log('位数の確認:');
for (const id of ['swapLR', 'crossCW', 'ringCW']) {
  const k = ABILITIES.findIndex((a) => a.id === id);
  const cyc = cyclesOf(k, 2, 2);
  console.log(`  ${id.padEnd(8)} 位数 ${orderOf(cyc)}`);
}

// 押した回数 → 期待される手数
const CASES = [
  { id: 'swapLR',  order: 2, table: [[1, 1], [2, 0], [3, 1], [4, 0]] },
  { id: 'crossCW', order: 4, table: [[1, 1], [2, 2], [3, 1], [4, 0], [5, 1], [7, 1]] },
  { id: 'ringCW',  order: 8, table: [[1, 1], [2, 2], [4, 4], [5, 3], [7, 1], [8, 0]] },
];

for (const c of CASES) {
  const spot = findCell(c.id);
  ok(spot !== null, `${c.id} を置ける盤面が見つからない`);
  if (!spot) continue;
  const cyc = cyclesOf(ABILITIES.findIndex((a) => a.id === c.id), xOf(spot.i), yOf(spot.i));
  ok(orderOf(cyc) === c.order, `${c.id} の位数が ${orderOf(cyc)}（期待 ${c.order}）`);

  for (const [presses, expect] of c.table) {
    types = spot.K; newPuzzle(spot.seed);
    for (let k = 0; k < presses; k++) fire(spot.i);
    commitRun();
    ok(moves === expect, `${c.id} を ${presses} 回押して ${moves} 手（期待 ${expect}）`);
  }
  console.log(`  ${c.id.padEnd(8)} ${c.table.map(([p, e]) => `${p}回→${e}手`).join('  ')}  OK`);
}

// まとまりの切れ目: 同じマスの連続だけがまとめられる
{
  const spot = findCell('swapLR');
  types = spot.K; newPuzzle(spot.seed);
  fire(spot.i); fire(spot.i);            // 入れ替え 2 回 → 0 手
  commitRun();
  ok(moves === 0, `同じマス 2 回で ${moves} 手（期待 0）`);

  types = spot.K; newPuzzle(spot.seed);
  fire(spot.i);
  // 「別のマス」は 1 手打ったあとに選ぶ。押せるかどうかはそのマスの中身で決まり、
  // 中身は手を打つと動くので、打つ前に選んだマスが押せるとはかぎらない。
  const other = legalCells().find((i) => i !== spot.i);
  ok(other !== undefined, '間に挟める別のマスが無い');
  const before = board.join(',');
  fire(other);
  ok(board.join(',') !== before, '挟んだマスが動いていない（数え方の前提が崩れている）');
  fire(spot.i);
  commitRun();
  ok(moves === 3, `間に別のマスを挟んだら ${moves} 手（期待 3）`);
  console.log('  まとまりの切れ目: 同じマスの連続だけがまとめられる  OK');
}

// 使えないマスを押してもまとまりは壊れないし手数も増えない
{
  const spot = findCell('swapLR');
  types = spot.K; newPuzzle(spot.seed);
  const dead = [];
  for (let i = 0; i < SIZE; i++) if (!cyclesAt(i)) dead.push(i);
  fire(spot.i);
  if (dead.length) fire(dead[0]);
  fire(spot.i);
  commitRun();
  ok(moves === 0, `間に使えないマスを挟んで ${moves} 手（期待 0）`);
  console.log('  使えないマスを挟んでもまとまりは保たれる  OK');
}

// 完成時に確定されて表示される
{
  types = 2; newPuzzle(6);
  const rec = [];
  board = Array.from({ length: SIZE }, (_, i) => i);
  const r = mulberry32(31);
  for (let k = 0; k < 8; k++) {
    const legal = legalCells();
    const i = legal[Math.floor(r() * legal.length)];
    rec.push(i); applyTo(board, cyclesAt(i));
  }
  moves = 0; run = { i: -1, d: 0, order: 1 }; locked = false;
  for (const i of [...rec].reverse()) {
    if (locked) break;
    const target = [...board];
    const probe = [...board]; applyTo(probe, cyclesAt(i));
    let n = 1;
    while (!probe.every((v, k) => v === target[k])) { applyTo(probe, cyclesAt(i)); n++; if (n > 500) break; }
    for (let k = 0; k < n - 1 && !locked; k++) fire(i);
  }
  ok(isSolved(), '完成させられなかった');
  const log = document.getElementById('log');
  ok(log.textContent.includes(`${moves} 手`), `表示「${log.textContent}」と内部の手数 ${moves} が不一致`);
  ok(run.d === 0, '完成時にまとまりが確定されていない');
  console.log(`  完成時の表示: ${moves} 手（逆再生は ${rec.length} まとまり）  OK`);
}

console.log(fail === 0 ? '\n手数の数え方: 全チェック通過' : `\n失敗 ${fail} 件`);

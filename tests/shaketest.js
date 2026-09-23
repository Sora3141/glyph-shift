// 「関係ないブロックが震える」不具合の回帰テスト
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

W = H = 4; SIZE = 16; buildDom(); types = 3;
newPuzzle(7);

// 使えないマスを探して押す
const dead = [];
for (let i = 0; i < SIZE; i++) if (!cyclesAt(i)) dead.push(i);
ok(dead.length > 0, '使えないマスが 1 つもなく検証できない');
const d = dead[0];
const deadTile = tiles[board[d]];
fire(d);

// 1. 揺れの痕跡（クラス）がタイルに残っていないこと
ok(![...deadTile._cls].some((c) => c === 'shake'), `揺れのクラスが残っている: ${[...deadTile._cls]}`);
ok([...deadTile._cls].every((c) => c === 'tile' || c === 'off'), `想定外のクラスが残っている: ${[...deadTile._cls]}`);

// 2. 手を進めても、その手で動かないタイルは append し直されないこと
const legal = legalCells();
const cyc = cyclesAt(legal[0]);
const moved = new Set(cyc.flat());
globalThis.__appendCount = 0;
fire(legal[0]);
ok(globalThis.__appendCount === moved.size,
   `append 回数 ${globalThis.__appendCount}（動いたマスは ${moved.size}）— 動いていないタイルも挿入し直している`);

// 3. 動いていないタイルにアニメーションが付かないこと
const after = tiles.filter((t) => t._anims.length > 0);
ok(after.length <= moved.size, `アニメーションが付いたタイル ${after.length} 件（動いたのは ${moved.size} 件）`);

// 4. 連続で手を打っても、動かないタイルへのアニメーションが増えないこと
for (let k = 0; k < 20; k++) {
  const L = legalCells();
  const i = L[k % L.length];
  const m = new Set(cyclesAt(i).flat());
  globalThis.__appendCount = 0;
  fire(i);
  ok(globalThis.__appendCount === m.size, `${k} 手目: append ${globalThis.__appendCount} / 移動 ${m.size}`);
}

console.log(fail === 0 ? '揺れの回帰テスト: 全チェック通過' : `失敗 ${fail} 件`);

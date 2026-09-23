// 長方形の盤が、どの形・どのブロック数でもきちんと作れるか
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

let made = 0;
for (let w = 3; w <= 8; w++) for (let h = 3; h <= 8; h++) {
  if (w === h) continue;
  for (const k of [2, 3, 5]) {
    if (k > w * h) continue;
    W = w; H = h; SIZE = w * h; buildDom();
    forcedAbilities = null; types = k;
    newPuzzle(w * 100 + h * 10 + k);
    made++;
    ok(board.length === w * h, `${w}×${h} の盤が ${board.length} マス`);
    ok(new Set(tileAbility).size === k, `${w}×${h} / ${k} 種 → ${new Set(tileAbility).size} 種`);
    ok(!isSolved(), `${w}×${h} / ${k} 種: 作った直後に完成している`);
    // 押せば動く（動かせる手が 1 つ以上ある）
    let movable = 0;
    for (let i = 0; i < SIZE; i++) if (cyclesOf(tileAbility[board[i]], xOf(i), yOf(i))) movable++;
    ok(movable > 0, `${w}×${h} / ${k} 種: 打てる手が無い`);
  }
}
console.log(`長方形 ${made} 通りを生成`);

// ブロックの指定つき
console.log('\n使うブロックを指定した長方形');
for (const pick of [[0, 1], [2, 4, 6], [1, 3, 5, 7]]) {
  W = 7; H = 4; SIZE = 28; buildDom();
  forcedAbilities = [...pick]; types = pick.length;
  newPuzzle(pick.length * 11);
  const used = [...new Set(tileAbility)].sort((a, b) => a - b);
  ok(used.length === pick.length && used.every((a, i) => a === pick[i]),
     `指定 ${pick} に対して出たのは ${used}`);
}
forcedAbilities = null;
console.log(fail ? `\n長方形: 失敗 ${fail} 件` : '\n長方形: 全チェック通過');

let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

// 最短と確定できる盤面では「最短」と出る
W = H = 4; SIZE = 16; buildDom(); types = 2; newPuzzle(3);
showHint();
ok(hintPlan && hintPlan.optimal, '4×4 2 色で最短が出ていない');
ok(el('log').textContent.includes('最短'), `表示: ${el('log').textContent}`);
ok(!el('log').textContent.includes('かぎりません'), '最短なのに但し書きが出ている');
console.log(`  最短が確定した場合: 「${el('log').textContent}」`);

// 押すたびに毎回計算し直している
{
  const first = hintPlan;
  fire(activeRuns()[0].i);
  showHint();
  ok(hintPlan !== first, 'ヒントを押しても計算し直していない');
  console.log('  ヒントを押すたびに今の盤面から計算し直す: OK');
}

// 確定できない盤面では但し書きが出る
{
  W = H = 8; SIZE = 64; buildDom(); types = 7; newPuzzle(5);
  showHint();
  ok(hintPlan !== null, '大きい盤で手順が出ない');
  // 出方は 3 通りある。探して見つけた手順なら手数を出し、保険の手順（逆手順）しか
  // 無いときは手数を出さない。1 万手を超える数字は遊ぶ人には意味がないため。
  if (hintPlan && hintPlan.method === 'reverse') {
    ok(!/残り \d+ 手|最短 \d+ 手/.test(el('log').textContent),
       `保険の手順なのに手数を出している: ${el('log').textContent}`);
    console.log(`  保険の手順しか無い場合: 「${el('log').textContent}」`);
  } else if (hintPlan && !hintPlan.optimal) {
    ok(el('log').textContent.includes('かぎりません'), `表示: ${el('log').textContent}`);
    console.log(`  最短と確定できない場合: 「${el('log').textContent}」`);
  } else {
    console.log('  （この盤面はたまたま最短が確定した）');
  }
}
console.log(fail === 0 ? '手順の質の表示: 全チェック通過' : `失敗 ${fail} 件`);

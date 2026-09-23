// リポジトリの場所に依らないよう、根の位置を自分で求める
const __root = require('path').join(__dirname, '..');
// 完成の知らせが盤面を隠さないことの確認
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

ok(el('clearOverlay') !== null ? false : true, '（このチェックは使わない）') ;
fail = 0; // 上はダミー。以下が本体。

// 全画面の完成表示そのものが無いこと
{
  const html = require('fs').readFileSync(__root + '/index.html', 'utf8');
  ok(!html.includes('id="clearOverlay"'), '全画面の完成表示がまだ残っている');
  ok(!html.includes('id="again"'), '次の盤面ボタンがまだ残っている');
  console.log('  全画面の完成表示と次の盤面ボタンは無い: OK');
}

W = H = 4; SIZE = 16; buildDom(); types = 2; newPuzzle(3);
ok(!el('log')._cls.has('done'), 'はじめから完成の体裁になっている');
ok(!gridEl._cls.has('cleared'), 'はじめから完成演出が付いている');

requestSolve();
let guard = 0;
while (!locked && activeRuns().length && guard++ < 400) {
  const r = activeRuns()[0];
  fire(r.i, r.n <= r.order - r.n ? 1 : -1);
}
ok(isSolved(), '揃わなかった');
ok(locked, '揃ってもロックされていない');
ok(el('log')._cls.has('done'), '完成の知らせが出ていない');
ok(el('log').textContent.includes('そろった'), `表示: ${el('log').textContent}`);
ok(gridEl._cls.has('cleared'), '盤面の演出が付いていない');
console.log(`  完成時の表示: 「${el('log').textContent}」`);

// 完成後も盤面の中身はそのまま読める（覆う要素を出していない）
ok(slots.length === SIZE, '盤面のマスが減っている');
ok(slots.every((s) => s.children.length === 1), '盤面のタイルが欠けている');
console.log('  完成後も盤面はそのまま見える: OK');

// 新しい盤面にすると演出も知らせも消える
newPuzzle(4);
ok(!el('log')._cls.has('done'), '新しい盤面でも完成の体裁が残っている');
ok(!gridEl._cls.has('cleared'), '新しい盤面でも演出が残っている');
ok(!locked, '新しい盤面でロックされたまま');
console.log('  新しい盤面で元に戻る: OK');

console.log(fail === 0 ? '\n完成の知らせ: 全チェック通過' : `\n失敗 ${fail} 件`);

// 「押したときだけ一度点滅する」ことの検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const lit = () => slots.map((s, i) => (s._cls.has('hinted') ? i : -1)).filter((i) => i >= 0);
const el = (id) => document.getElementById(id);

W = H = 5; SIZE = 25; buildDom(); types = 3;
newPuzzle(9);
ok(lit().length === 0, '押す前から点滅している');

// 押すと次の一手が点滅する
el('hintBtn').fire('click', {});
ok(lit().length === 1, `点滅しているマスが ${lit().length} 個（期待 1）`);
ok(lit()[0] === activeRuns()[0].i, '次に押すマスと点滅位置が違う');
console.log('  押すと次の一手だけが点滅する: OK');

// しばらくすると自然に消える
flushTimers();
ok(lit().length === 0, '時間が経っても消えない');
console.log('  放っておくと消える: OK');

// もう一度押せばまた出る（オンオフではない）
el('hintBtn').fire('click', {});
ok(lit().length === 1, '2 回目に点滅しない');
el('hintBtn').fire('click', {});
ok(lit().length === 1, '続けて押すと消えてしまう（オンオフになっている）');
console.log('  何度押しても点滅する（オンオフではない）: OK');

// 手を打つと消える
{
  const target = activeRuns()[0].i;
  el('hintBtn').fire('click', {});
  ok(lit().length === 1, '点滅していない');
  fire(target);
  ok(lit().length === 0, '手を打っても点滅が残っている');
  console.log('  手を打つと消える: OK');
}

// 新しい盤面にすると消える
{
  el('hintBtn').fire('click', {});
  ok(lit().length === 1, '点滅していない');
  newPuzzle(10);
  ok(lit().length === 0, '新しい盤面にしても点滅が残っている');
  console.log('  新しい盤面にすると消える: OK');
}

// 完成後は点滅しない
{
  requestSolve();
  // 短い向きを選んで進める（順方向だけだと位数の大きい手で回数がかさむ）
  let guard = 0;
  while (!locked && activeRuns().length && guard++ < 5000) {
    const r = activeRuns()[0];
    fire(r.i, r.n <= r.order - r.n ? 1 : -1);
  }
  ok(isSolved(), '完成させられなかった');
  el('hintBtn').fire('click', {});
  ok(lit().length === 0, '完成後に点滅する');
  console.log('  完成後は点滅しない: OK');
}

console.log(fail === 0 ? '\n点滅の検証: 全チェック通過' : `\n失敗 ${fail} 件`);

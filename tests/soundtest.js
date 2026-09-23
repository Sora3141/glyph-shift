// 効果音の呼ばれ方と、オンオフの検証
// 注: このテストは Worker の無い環境なので同期の短い予算で解く。
// 手順が保険（数千手）になることがあるのでガードを大きく取る。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

// 鳴らす代わりに記録する
const calls = [];
for (const name of ['move', 'blocked', 'hint', 'solved']) {
  Sfx[name] = (...a) => calls.push([name, ...a]);
}
const take = () => { const c = calls.slice(); calls.length = 0; return c; };

W = H = 5; SIZE = 25; buildDom(); types = 4;
// 回転のブロック（位数 3 以上）が打てる盤面を選ぶ。使うブロックは盤面ごとに
// 引き直されるので、種を決め打ちすると回転が 1 つも出ないことがある。
let SEED = 6;
for (; SEED < 200; SEED++) { newPuzzle(SEED); if (legalCells().some((c) => orderOf(cyclesAt(c)) > 2)) break; }
newPuzzle(SEED);
take();

// 押したとき
{
  const i = legalCells().find((c) => orderOf(cyclesAt(c)) > 2);
  const ab = abilityAt(i);
  fire(i, 1);
  const c = take();
  ok(c.length === 1 && c[0][0] === 'move', `押したときの音が ${JSON.stringify(c)}`);
  ok(c[0][1] === ab, '鳴らす音がブロックの種類に対応していない');
  ok(c[0][2] === 1, '順方向として渡っていない');

  fire(i, -1);
  const c2 = take();
  ok(c2[0][2] === -1, '逆回りとして渡っていない');
  console.log('  押す/長押しで種類と向きが音に渡る: OK');
}

// 使えないマス
{
  const dead = [];
  for (let i = 0; i < SIZE; i++) if (!cyclesAt(i)) dead.push(i);
  ok(dead.length > 0, '使えないマスがない');
  fire(dead[0], 1);
  const c = take();
  ok(c.length === 1 && c[0][0] === 'blocked', `使えないマスの音が ${JSON.stringify(c)}`);
  console.log('  使えないマスは専用の音: OK');
}

// ヒント
{
  el('hintBtn').fire('click', {});
  const c = take();
  ok(c.some((x) => x[0] === 'hint'), 'ヒントの音が鳴らない');
  console.log('  ヒントの音: OK');
}

// 完成
{
  newPuzzle(SEED); take();
  requestSolve();
  let guard = 0;
  while (!locked && activeRuns().length && guard++ < 20000) {
    const r = activeRuns()[0];
    fire(r.i, r.n <= r.order - r.n ? 1 : -1);
  }
  const c = take();
  ok(isSolved(), '完成させられなかった');
  ok(c.filter((x) => x[0] === 'solved').length === 1, `完成音が ${c.filter((x) => x[0] === 'solved').length} 回`);
  console.log('  完成音はちょうど 1 回: OK');
}

// オンオフ（設定タブのスイッチから）
{
  ok(Sfx.enabled === true, '初期状態で音が切れている');
  ok(el('soundChk').checked === true, 'スイッチが入になっていない');
  el('soundChk').checked = false;
  el('soundChk').fire('change', {});
  ok(Sfx.enabled === false, '切れていない');
  el('soundChk').checked = true;
  el('soundChk').fire('change', {});
  ok(Sfx.enabled === true, '戻せていない');
  ok(el('soundChk').checked === true, 'スイッチが入に戻っていない');
  console.log('  オンオフの切り替え: OK');
}

console.log(fail === 0 ? '\n効果音: 全チェック通過' : `\n失敗 ${fail} 件`);

// カスタム（長方形の盤 + 使うブロックの指定）の検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

const el = (id) => document.getElementById(id);
const addBtns = (id, vals) => {
  const box = el(id);
  box.replaceChildren();
  const made = {};
  for (const v of vals) {
    const b = document.createElement('button');
    b.dataset.v = String(v);
    box.append(b);
    made[v] = b;
  }
  return made;
};

console.log('長方形の盤');
// カスタムに切り替える
el('customChk').checked = true;
el('customChk').fire('change', {});
ok(el('customSize').hidden === false && el('plainSize').hidden === true, 'カスタムに切り替えても表示が入れ替わらない');

// 辺は 2 つ選ぶだけ。長いほうが横になるので、縦長の盤にはならない。
const aBtns = addBtns('sideA', [3, 4, 5, 6, 7]);
const bBtns = addBtns('sideB', [3, 4, 5, 6, 7]);
el('sideA').fire('click', { target: aBtns[3] });   // わざと短いほうを先に選ぶ
el('sideB').fire('click', { target: bBtns[6] });
ok(el('sizeNote').textContent.includes('横 6') && el('sizeNote').textContent.includes('縦 3'),
   `作る前の案内が合っていない: ${el('sizeNote').textContent}`);

// ブロックを 3 つ選ぶ
const picks = [...el('blockPicker').children].slice(0, 3);
ok(el('createBtn').disabled === true, '1 つも選んでいないのに作成できる');
for (const b of picks) el('blockPicker').fire('click', { target: b });
ok(el('createBtn').disabled === false, '3 つ選んでも作成できない');

el('seedIn').value = '77';
el('createBtn').fire('click', {});

ok(W === 6 && H === 3, `選んだ順に関わらず長いほうが横になっていない: ${W}×${H}`);
ok(W >= H, `盤が縦長になっている: ${W}×${H}`);
ok(SIZE === 18 && board.length === 18, `マス数が ${SIZE} / ${board.length}`);
ok(new Set(tileAbility).size === 3, `ブロックが 3 種になっていない: ${new Set(tileAbility).size}`);
const want = new Set(picks.map((b) => Number(b.dataset.v)));
ok([...new Set(tileAbility)].every((a) => want.has(a)),
   `選んでいないブロックが出た: ${[...new Set(tileAbility)]} / 選んだのは ${[...want]}`);
ok(!isSolved(), '作成直後に完成している');

console.log('  盤:', [...Array(H)].map((_, y) => [...Array(W)].map((_, x) => tileAbility[board[y * W + x]]).join('')).join(' / '));

// 目標の絵柄も 18 マスぶんある
ok(goalEl_ok(), '目標の柄がマス数と合っていない');
function goalEl_ok() { return tileAbility.length === 18; }

console.log('\n長方形でもソルバーが使える');
ok(!el('hintBtn').disabled, '長方形でヒントが押せない');
ok(!el('solveBtn').disabled, '長方形で「揃える」が押せない');
showHint();
ok(slots.some((s) => s._cls.has('hinted')), '長方形でヒントが光らない');
clearHint();

// ヒントの示す手をたどると本当に揃う
{
  let guard = 0;
  while (!locked && activeRuns().length && guard++ < 40000) {
    const r = activeRuns()[0];
    fire(r.i, r.n <= r.order - r.n ? 1 : -1);
  }
  ok(isSolved(), `6×3 がヒントどおりに揃わなかった（${guard} 手）`);
}

// 逆の順で選んでも同じ盤になる
el('setupBtn').fire('click', {});
el('sideA').fire('click', { target: aBtns[6] });
el('sideB').fire('click', { target: bBtns[3] });
el('createBtn').fire('click', {});
ok(W === 6 && H === 3, `選ぶ順で盤が変わった: ${W}×${H}`);

// 同じ数を 2 つ選べば正方形
el('setupBtn').fire('click', {});
el('sideA').fire('click', { target: aBtns[5] });
el('sideB').fire('click', { target: bBtns[5] });
ok(el('sizeNote').textContent.includes('正方形'), '同じ数を選んでも正方形と言わない');
el('createBtn').fire('click', {});
ok(W === 5 && H === 5, `同じ数を選んでも正方形にならない: ${W}×${H}`);

console.log('\n正方形に戻すと元どおり');
el('setupBtn').fire('click', {});          // syncSetup が走る
ok(el('customChk').checked === true, '長方形の盤なのにカスタムが解除されている');
el('customChk').checked = false;
el('customChk').fire('change', {});
const sizeBtns = addBtns('sizeSeg', [3, 4, 5, 6]);
addBtns('typeSeg', [2, 3, 4]);
el('sizeSeg').fire('click', { target: sizeBtns[4] });
el('seedIn').value = '3';
el('createBtn').fire('click', {});
ok(W === 4 && H === 4 && SIZE === 16, `正方形に戻っていない: ${W}×${H}`);
ok(forcedAbilities === null, 'カスタムを外してもブロックの指定が残っている');
ok(!el('hintBtn').disabled && !el('solveBtn').disabled, '正方形なのにソルバーが使えない');
showHint();
ok(slots.some((s) => s._cls.has('hinted')), '正方形でヒントが光らない');


console.log(fail ? `\nカスタム: 失敗 ${fail} 件` : '\nカスタム: 全チェック通過');

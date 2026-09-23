// 作れない組み合わせが正しく伏せられるかの確認
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const btns = (id) => document.getElementById(id).querySelectorAll('button');

W = H = 4; SIZE = 16; buildDom(); types = 2; newPuzzle(1);
setPanel('setup', true);

// 4×4 では 8 種以上の柄が作れない
const sizeB = [...btns('sizeSeg')], typeB = [...btns('typeSeg')];
ok(sizeB.length === SIZES.length, `サイズのボタンが ${sizeB.length} 個`);
ok(typeB.length === TYPE_COUNTS.length, `ブロック数のボタンが ${typeB.length} 個`);

const disabled = () => typeB.filter((b) => b.disabled).map((b) => b.dataset.v).join(',');
// マス数に収まる色数は選べる。収まらないものだけ伏せる（3×3 は 9 マスなので 10 種が入らない）
for (const n of SIZES) {
  document.getElementById('sizeSeg').fire('click', { target: sizeB.find((b) => b.dataset.v === String(n)) });
  const want = TYPE_COUNTS.filter((k) => k > n * n).join(',');
  ok(disabled() === want, `${n}×${n} で伏せているのが「${disabled()}」（期待「${want}」）`);
  const note = document.getElementById('typeNote').textContent;
  ok(want ? note.length > 0 : note === '', `${n}×${n} の案内が想定と違う`);
}
console.log('  マスに収まる色数はすべて選べる（3×3 の 10 種だけ伏せる）');

// いちばん小さい盤で、いちばん多い色数を作れる
document.getElementById('sizeSeg').fire('click', { target: sizeB.find((b) => b.dataset.v === '4') });
document.getElementById('typeSeg').fire('click', { target: typeB.find((b) => b.dataset.v === '10') });
ok(pendTypes === 10, '10 種を選べていない');
document.getElementById('createBtn').fire('click', {});
ok(W === 4 && types === 10, `作成後が ${W}×${W} / ${types} 種`);
ok(new Set(tileAbility).size === 10, `色数が ${new Set(tileAbility).size} 種`);
ok(!isSolved(), '作成直後に完成している');
console.log('  4×4 で 10 種も作れる: OK');

// 10×10 / 10 種
{
  W = H = 10; SIZE = 100; buildDom(); types = 10; newPuzzle(3);
  ok(new Set(tileAbility).size === 10, `10×10 で ${new Set(tileAbility).size} 種`);
  ok(!isSolved(), '10×10 が完成済み');
  ok(legalCells().length > 0, '10×10 に合法手がない');
  console.log(`  10×10 / 10 種: 生成できる（合法手 ${legalCells().length} / 100）`);
}

console.log(fail === 0 ? '\n組み合わせの可否: 全チェック通過' : `\n失敗 ${fail} 件`);

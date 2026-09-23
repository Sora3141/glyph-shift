// 説明パネルの中身を検証する
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const walk = (el, out = []) => { for (const c of el.children || []) { if (typeof c === 'object') { out.push(c); walk(c, out); } } return out; };

for (const size of [4, 5, 6]) {
  W = H = size; SIZE = W * H; buildDom();
  newPuzzle(42);

  const body = document.getElementById('panelBody');
  const all = walk(body);
  const blks = all.filter((e) => e._cls.has('blk'));
  ok(blks.length === ABILITIES.length, `${size}×${size}: ブロック数 ${blks.length}（期待 ${ABILITIES.length}）`);

  const titles = all.filter((e) => e._cls.has('fam-title')).map((e) => e.textContent);
  ok(titles.length === FAMILIES.length, `${size}×${size}: 系統の見出しが ${titles.length} 個（期待 ${FAMILIES.length}）`);

  // 「使用中」バッジの数が、このパズルで使う能力の種類数と一致するか
  const badges = all.filter((e) => e._cls.has('used')).length;
  ok(badges === new Set(tileAbility).size, `${size}×${size}: 使用中バッジ ${badges}（期待 ${new Set(tileAbility).size}）`);
  ok(blks.filter((b) => b._cls.has('dim')).length === ABILITIES.length - badges, `${size}×${size}: 未使用の淡色表示の数が合わない`);

  // 使える位置の数が cyclesOf と一致するか
  const maps = all.filter((e) => e._cls.has('blk-map'));
  ok(maps.length === ABILITIES.length, `${size}×${size}: マップ数 ${maps.length}`);
  ABILITIES.forEach((ab, k) => {
    let exp = 0;
    for (let i = 0; i < SIZE; i++) if (cyclesOf(k, xOf(i), yOf(i))) exp++;
    const got = maps[k].children.filter((c) => c._cls.has('on')).length;
    ok(got === exp, `${size}×${size} ${ab.id}: 点灯 ${got} / 期待 ${exp}`);
  });

  console.log(`${size}×${size}: ブロック ${blks.length} 件、系統 ${titles.join(' / ')}、使用中 ${badges} 件`);
}
console.log(fail === 0 ? '\n説明パネルの中身: 全チェック通過' : `\n失敗 ${fail} 件`);

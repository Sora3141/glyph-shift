// 絵柄の選択の検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

console.log(`描き方 ${Glyphs.STYLES.length} 種: ${Glyphs.STYLES.map((s) => s.name).join(' / ')}`);

// 1. どの描き方でも、10 種すべてが健全な SVG になる
for (const st of Glyphs.STYLES) {
  for (let k = 0; k < ABILITIES.length; k++) {
    const s = Glyphs.draw(st.id, ABILITIES[k].cells(0, 0), bgOf(k));
    ok(s.startsWith('<svg') && s.endsWith('</svg>'), `${st.id} / ${ABILITIES[k].id}: SVG になっていない`);
    ok(!/undefined|NaN/.test(s), `${st.id} / ${ABILITIES[k].id}: 座標に undefined か NaN がある`);
  }
}

// 2. 同じ描き方のなかで、すべてが別の絵になっている（何も起きないマスも含めて）
for (const st of Glyphs.STYLES) {
  const seen = new Map();
  for (let k = 0; k < ABILITIES.length; k++) {
    const s = Glyphs.draw(st.id, ABILITIES[k].cells(0, 0), bgOf(k));
    if (seen.has(s)) ok(false, `${st.id}: ${ABILITIES[k].id} と ${seen.get(s)} が同じ絵になっている`);
    seen.set(s, ABILITIES[k].id);
  }
}

// 3. 描き方が違えば絵も違う（同じ能力で比べる）
//    ただし能力を持たないマスは、どの描き方でも絵柄を持たない（それが合図）
const blanks = ABILITIES.map((a, k) => k).filter((k) => !ABILITIES[k].cells(0, 0).length);
for (let k = 0; k < ABILITIES.length; k++) {
  const all = Glyphs.STYLES.map((st) => Glyphs.draw(st.id, ABILITIES[k].cells(0, 0), bgOf(k)));
  ok(new Set(all).size === all.length, `${ABILITIES[k].id}: 描き方が違うのに同じ絵になっている`);
}

// 4. 何も起きないマスは、その描き方に共通して出るものだけを描く。
//    13 種で変わるのは「動くマス」と「動きの印」だけなので、それが無い能力では
//    共通部分がそのまま残る。独自の形を持ち込んでいないことを見る。
const elems = (svg) => svg.match(/<(?:circle|rect|path|polygon|g)\b[^>]*\/?>/g) || [];
for (const k of blanks) {
  for (const st of Glyphs.STYLES) {
    const mine = elems(Glyphs.draw(st.id, ABILITIES[k].cells(0, 0), bgOf(k)));
    ok(mine.length > 0, `${st.id}: 何も描かれていない`);
    // 動きの印（線・弧・矢じり）は出ない
    ok(!mine.some((e) => /^<(path|polygon)/.test(e)),
       `${st.id}: 能力が無いのに動きの印が描かれている`);

    // 同じ描き方のほかの絵柄に出てくるものだけで組まれているか
    const seenElsewhere = new Set();
    for (let j = 0; j < ABILITIES.length; j++) {
      if (j === k) continue;
      for (const e of elems(Glyphs.draw(st.id, ABILITIES[j].cells(0, 0), bgOf(j)))) seenElsewhere.add(e);
    }
    const novel = mine.filter((e) => !seenElsewhere.has(e));
    // 直線だけは下地も中央の輪も持たない。真ん中の点はこの絵柄だけのもの。
    const allow = st.id === 'line' ? 1 : 0;
    ok(novel.length <= allow,
       `${st.id}: ほかの絵柄に無い形を ${novel.length} 個持ち込んでいる: ${novel.join(' ')}`);
  }
}
console.log(`  能力を持たない ${blanks.length} 種は、共通部分だけで組まれている`);

console.log(fail ? `\n絵柄の選択: 失敗 ${fail} 件` : '\n絵柄の選択: 全チェック通過');

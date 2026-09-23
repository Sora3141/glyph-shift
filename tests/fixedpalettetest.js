// 固定パレットの品質を、知覚的な色差（CIELAB の ΔE）で確かめる
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// hsl -> rgb -> XYZ -> Lab
function hsl2rgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
function rgb2lab([r, g, b]) {
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  [r, g, b] = [lin(r), lin(g), lin(b)];
  const X = (r * .4124 + g * .3576 + b * .1805) / .95047;
  const Y = (r * .2126 + g * .7152 + b * .0722);
  const Z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const labOf = (css) => {
  const [h, s, l] = css.match(/hsl\((\d+) (\d+)% (\d+)%\)/).slice(1).map(Number);
  return rgb2lab(hsl2rgb(h, s, l));
};
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const labs = ABILITIES.map((a) => labOf(a.color));
const hues = ABILITIES.map((a) => Number(a.color.match(/hsl\((\d+)/)[1]));

console.log('10 色の内訳');
ABILITIES.forEach((a, k) => {
  const L = labs[k][0];
  console.log(`  ${a.id.padEnd(10)} ${a.color.padEnd(20)} 明度 L*=${L.toFixed(0)}`);
});

// 彩度（Lab の C*）。色を持たないマスは、色相の遠さではなく「色を持たないこと」で見分ける。
const chroma = (lab) => Math.hypot(lab[1], lab[2]);
const grey = ABILITIES.map((_, k) => k).filter((k) => chroma(labs[k]) < 10);
const tinted = ABILITIES.map((_, k) => k).filter((k) => !grey.includes(k));

// 色を持つものどうしは、知覚的な色差で見分ける
let worst = { d: Infinity };
for (const i of tinted) for (const j of tinted) {
  if (j <= i) continue;
  const d = dE(labs[i], labs[j]);
  if (d < worst.d) worst = { d, i, j };
}
console.log(`\n最も近い 2 色: ${ABILITIES[worst.i].id} と ${ABILITIES[worst.j].id}  ΔE=${worst.d.toFixed(1)}`);
// 大きな色面どうしなら ΔE 25 もあれば十分に見分けられる
ok(worst.d >= 34, `いちばん近い 2 色の差が ΔE=${worst.d.toFixed(1)} しかない`);

// 色を持たないマスは、盤でただひとつ色を持たないこと自体が手がかり。
// 色差だけで測ると淡い色に近く見えるが、彩度の差が大きいので実際には紛れない。
console.log(`\n色を持たないマス ${grey.length} 種 / 色を持つマス ${tinted.length} 種`);
ok(grey.length <= 1, `色を持たないマスが ${grey.length} 種ある（1 種までのつもり）`);
for (const k of grey) {
  const c = chroma(labs[k]);
  const minTint = Math.min(...tinted.map((j) => chroma(labs[j])));
  const lightest = Math.max(...tinted.map((j) => labs[j][0]));
  let m = Infinity;
  for (const j of tinted) m = Math.min(m, dE(labs[k], labs[j]));
  ok(minTint > 15, `色を持つ側の最小彩度が C*=${minTint.toFixed(1)} しかなく、色なしと紛れる`);
  ok(labs[k][0] > lightest, `${ABILITIES[k].id}: 明度 ${labs[k][0].toFixed(0)} が、いちばん明るい色 ${lightest.toFixed(0)} を超えていない`);
  ok(m >= 18, `${ABILITIES[k].id}: 色差が ΔE=${m.toFixed(1)} しかない`);
  console.log(`  ${ABILITIES[k].id}: 彩度 C*=${c.toFixed(1)}（色を持つ側は最小 ${minTint.toFixed(1)}）、`
    + `明度 ${labs[k][0].toFixed(0)}（最も明るい色は ${lightest.toFixed(0)}）、色差は最小 ΔE=${m.toFixed(1)}`);
}

// アクセント（菫色）の帯を使っていない
for (let k = 0; k < hues.length; k++) {
  ok(hues[k] < 248 || hues[k] > 292, `${ABILITIES[k].id} の色相 ${hues[k]}° がアクセントの帯に入っている`);
}
console.log('  アクセントの帯（248〜292°）は使っていない');

// アイコンの黒に対して十分な明るさがあるか
const lum = (css) => { const [h, s, l] = css.match(/hsl\((\d+) (\d+)% (\d+)%\)/).slice(1).map(Number);
  const [r, g, b] = hsl2rgb(h, s, l).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return .2126 * r + .7152 * g + .0722 * b; };
// 絵柄と地のコントラスト。インクは全マス共通。半透明なので、地に重ねた色で見る。
const rgbOf = (css) => {
  const m = css.match(/hsl\((\d+) (\d+)% (\d+)%\)/);
  if (m) return hsl2rgb(Number(m[1]), Number(m[2]), Number(m[3]));
  const [r, g, b, al] = css.match(/[\d.]+/g).map(Number);
  return [r / 255, g / 255, b / 255, al];
};
const relLum = ([r, g, b]) => {
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
};
let minC = 99;
for (let k = 0; k < ABILITIES.length; k++) {
  const bg = rgbOf(ABILITIES[k].color);
  const ink = rgbOf(INK);
  const al = ink[3];
  const mixed = [0, 1, 2].map((j) => ink[j] * al + bg[j] * (1 - al));
  const [a1, a2] = [relLum(mixed) + .05, relLum(bg) + .05];
  const c = Math.max(a1, a2) / Math.min(a1, a2);
  minC = Math.min(minC, c);
  // インクは半透明なので、不透明として概算するより実際のコントラストは低い。
  // 絵柄は小さな文字ではなく大きな図形なので、その基準（3:1）には十分な余裕がある。
  ok(c >= 4.0, `${ABILITIES[k].id}: 絵柄とのコントラストが ${c.toFixed(1)}:1`);
}
console.log(`  絵柄とのコントラストは最低 ${minC.toFixed(1)}:1（半透明のインクを地に重ねて実測）`);

// どのマスも、空きスロット（#17151d）よりはっきり明るいこと
for (let k = 0; k < ABILITIES.length; k++) {
  const d = dE(labs[k], rgb2lab([0x17, 0x15, 0x1d].map((v) => v / 255)));
  ok(d >= 15, `${ABILITIES[k].id}: 空きスロットとの差が ΔE=${d.toFixed(1)} しかない（マスに見えない）`);
}

// 盤面が変わっても色が変わらない
{
  const before = ABILITIES.map((_, k) => bgOf(k));
  W = H = 6; SIZE = 36; buildDom();
  for (const K of [2, 5, 10]) {
    types = K;
    for (let s = 1; s <= 30; s++) {
      newPuzzle(s);
      ABILITIES.forEach((a, k) => ok(bgOf(k) === before[k], `${a.id}: 盤面によって色が変わっている`));
    }
  }
  console.log('  盤面を変えても色は変わらない');
}

console.log(fail === 0 ? '\n固定パレット: 全チェック通過' : `\n失敗 ${fail} 件`);

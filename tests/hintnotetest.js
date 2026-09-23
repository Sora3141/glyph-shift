// ヒントに添える「残り何手か」の出し方の検証。
//
// 残りの手数は、実際に探して見つけた手順のときだけ意味がある。
// 保険の手順（シャッフルをそのまま逆再生するもの）は 1 万手を超えることがあり、
// それを「残り 18317 手」と出しても遊ぶ人には何の情報でもない。
const __root = require('path').join(__dirname, '..');
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const note = () => logEl.textContent;
const bigNumber = (s) => (s.match(/\d+/g) || []).map(Number).find((n) => n >= 1000);

W = H = 5; SIZE = 25; buildDom(); types = 3; newPuzzle(2);
requestSolve();

console.log('探して見つけた手順のとき');
{
  // 最短だと確定できた場合
  hintPlan = { runs: activeRuns(), optimal: true, ms: 1, method: 'bidirectional' };
  hintBusy = false;
  blinkHint();
  ok(note().includes('ここから最短'), `最短と出ない: ${note()}`);
  ok(/最短 \d+ 手/.test(note()), `手数が出ていない: ${note()}`);
  console.log(`  最短が確定: 「${note()}」`);

  // 探したが最短とは確定できない場合
  hintPlan = { runs: activeRuns(), optimal: false, ms: 1, method: 'constructive' };
  blinkHint();
  ok(note().includes('最短とはかぎりません'), `但し書きが出ない: ${note()}`);
  ok(/残り \d+ 手/.test(note()), `手数が出ていない: ${note()}`);
  console.log(`  最短と確定できない: 「${note()}」`);
}

console.log('\n保険の手順しか無いとき（数字を出さない）');
{
  const runs = activeRuns();
  // まだ裏で探している
  hintPlan = { runs, optimal: false, ms: 1, method: 'reverse' };
  hintBusy = true;
  blinkHint();
  ok(!/残り|最短/.test(note()), `意味のない手数を出している: ${note()}`);
  ok(note().includes('探しています'), `探している旨が出ない: ${note()}`);
  ok(note().includes('光っているマス'), `押す場所の案内が消えている: ${note()}`);
  console.log(`  探索中: 「${note()}」`);

  // 探し終えても見つからなかった（Worker が無い環境など）
  hintBusy = false;
  blinkHint();
  ok(!/残り|最短/.test(note()), `意味のない手数を出している: ${note()}`);
  ok(note().includes('見つかっていません'), `見つからない旨が出ない: ${note()}`);
  console.log(`  見つからず: 「${note()}」`);

  // 手順そのものがまだ無いとき
  hintPlan = null;
  blinkHint();
  ok(!/残り|最短/.test(note()), `手順が無いのに手数を出している: ${note()}`);
  console.log(`  手順なし: 「${note()}」`);
}

console.log('\n探し直しで見つかったら、出したままの案内を新しくする');
{
  hintPlan = { runs: activeRuns(), optimal: false, ms: 1, method: 'reverse' };
  hintBusy = true;
  blinkHint();
  const before = note();
  ok(before.includes('探しています'), '前提が崩れている');
  // 裏の探索が短い手順を持って返ってきた場面を作る
  hintPlan = { runs: activeRuns(), optimal: false, ms: 1, method: 'constructive' };
  finishSolve(solveId, null, false);
  ok(note() !== before, '見つかったのに案内が古いまま');
  ok(note().includes('見つかりました'), `知らせが出ない: ${note()}`);
  console.log(`  見つかった後: 「${note()}」`);

  // 光らせる場所は動かさない（押した時点で決めたものを尊重する）
  ok(slots.filter((s) => s._cls.has('hinted')).length <= 1, '点滅が増えている');
}

console.log('\n実際の難しい盤で、1000 を超える数字を出さない');
for (const [w, h, k, s] of [[8, 8, 7, 5], [10, 10, 8, 3], [10, 10, 10, 1]]) {
  W = w; H = h; SIZE = w * h; buildDom(); types = k; newPuzzle(s);
  hintPlan = null;
  showHint();
  const n = bigNumber(note());
  ok(n === undefined, `${w}×${h} ${k} 色: ${n} という数字を出している → ${note()}`);
  console.log(`  ${w}×${h} ${k} 色: 「${note()}」`);
}

console.log(fail === 0 ? '\nヒントの案内: 全チェック通過' : `\n失敗 ${fail} 件`);

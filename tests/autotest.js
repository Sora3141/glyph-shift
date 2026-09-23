// ヒント点滅と「揃える」の検証
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const lit = () => slots.map((s, i) => (s._cls.has('hinted') ? i : -1)).filter((i) => i >= 0);
const el = (id) => document.getElementById(id);

// setTimeout は即実行なので、自動再生は 1 回の呼び出しで最後まで進む
W = H = 5; SIZE = 25; buildDom(); types = 3;

// --- 揃えるボタン ---
newPuzzle(9);
ok(el('confirmOverlay').hidden, 'はじめから確認が出ている');
el('solveBtn').fire('click', {});
ok(!el('confirmOverlay').hidden, '確認が出ない');
ok(!isSolved(), '確認だけで盤面が変わった');
console.log('  揃えるを押すと確認が出る（盤面はまだ動かない）: OK');

// やめる
el('confirmNo').fire('click', {});
ok(el('confirmOverlay').hidden, 'やめるで確認が消えない');
ok(!isSolved(), 'やめたのに揃ってしまった');
console.log('  やめるで何も起きない: OK');

// 承諾すると揃う
const boardBefore = [...board];
el('solveBtn').fire('click', {});
el('confirmYes').fire('click', {});
ok(el('confirmOverlay').hidden, '確認が閉じていない');
ok(isSolved(), '承諾しても揃わない');
ok(locked, '揃ったのにロックされていない');
ok(el('log')._cls.has('done'), '完成の知らせが出ていない');
ok(el('log').textContent.includes('自動で揃えました'), `表示: ${el('log').textContent}`);
ok(gridEl._cls.has('cleared'), '盤面の完成演出が付いていない');
// 揃っても操作バーは残す（戻って見直せるようにするため）。閉じるのは「やめる」。
ok(autoSolving && !el('autoBar').hidden, '揃った途端に操作バーが消えている');
ok(el('autoBack').disabled === false, '揃ったあとに「戻す」が押せない');
el('autoStop').fire('click', {});
ok(!autoSolving && el('autoBar').hidden, '「やめる」で閉じない');
ok(board.some((v, i) => v !== boardBefore[i]), '盤面が動いていない');
console.log('  承諾すると順に動いて揃い、自動で揃えたと表示される: OK');

// 自分で解いたときは手数が出る
newPuzzle(9);
requestSolve();
let guard = 0;
while (!locked && activeRuns().length && guard++ < 400) fire(activeRuns()[0].i);
ok(isSolved(), '自力で揃えられない');
ok(el('log').textContent.includes('そろった'), `表示: ${el('log').textContent}`);
ok(el('log').textContent.includes(`${moves} 手`), `手数が出ていない: ${el('log').textContent}`);
ok(!el('log').textContent.includes('自動'), '自力なのに自動と出ている');
console.log(`  自力クリアでは手数が出る: 「${el('log').textContent}」`);

// 自動再生中は手動入力を受け付けない
{
  newPuzzle(4);
  autoSolving = true;
  const snap = [...board];
  gridEl.fire('click', { target: slots[legalCells()[0]] });
  ok(board.every((v, i) => v === snap[i]), '自動再生中に手動で動かせてしまう');
  autoSolving = false;
  console.log('  自動再生中は手動入力を受け付けない: OK');
}

// 新しい盤面にすると自動再生も確認も止まる
{
  newPuzzle(5);
  el('solveBtn').fire('click', {});
  newPuzzle(6);
  ok(el('confirmOverlay').hidden, '新しい盤面にしても確認が残っている');
  ok(!autoSolving && el('autoBar').hidden, '新しい盤面にしても再生中のまま');
  ok(autoSolvedFlag === false, '自動で揃えた印が残っている');
  console.log('  新しい盤面で状態がリセットされる: OK');
}

console.log(fail === 0 ? '\nヒント点滅と自動で揃える: 全チェック通過' : `\n失敗 ${fail} 件`);

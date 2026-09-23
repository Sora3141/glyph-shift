// 逆手順しか出せなかった盤で、裏でもっと長く探し直すことの検証。
// ふつうの盤（ちゃんとした手順が出た盤）では探し直さないことも見る。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

W = H = 5; SIZE = 25; buildDom(); types = 3;

// Worker の代わり物。依頼を溜めておいて、こちらから好きな返事を返す。
// newPuzzle は計算中の Worker を捨てて作り直すので、盤を出したあとに差し替える。
const sent = [];
const arm = (seed) => {
  newPuzzle(seed);
  worker = { postMessage: (m) => sent.push(m), terminate: () => {} };
  workerBroken = false;
  hintBusy = false;      // 盤を出したときの先読みは、この検証では見ない
  solveDones = [];
  sent.length = 0;
};

console.log('逆手順しか出せなかったとき');
{
  arm(1);
  requestSolve(null, false);
  ok(sent.length === 1, `最初の依頼が出ていない（${sent.length} 件）`);
  const first = sent[0];
  ok(first.budget === hintBudgetWorker(), `最初の予算が ${first.budget}（期待 ${hintBudgetWorker()}）`);

  const res = { plan: Solver.runsToPlan(solution), optimal: false, method: 'reverse', ms: 10 };
  finishSolve(first.id, res, false);
  ok(sent.length === 2, `裏での探し直しが始まっていない（${sent.length} 件）`);
  ok(sent[1].budget === HINT_BUDGET_LONG, `探し直しの予算が ${sent[1] && sent[1].budget}（期待 ${HINT_BUDGET_LONG}）`);
  ok(sent[1].budget > first.budget, '探し直しのほうが短い時間になっている');
  console.log(`  ${first.budget}ms で逆手順 → ${sent[1].budget}ms で探し直し  OK`);

  // 2 回目の逆手順では、もう探し直さない（1 盤につき 1 回だけ）
  finishSolve(sent[1].id, res, false);
  ok(sent.length === 2, `2 度目の探し直しが始まっている（${sent.length} 件）`);
  console.log('  2 度目は探し直さない  OK');
}

console.log('ちゃんとした手順が出たとき');
{
  arm(2);
  requestSolve(null, false);
  const first = sent[0];
  const res = { plan: Solver.runsToPlan(solution).slice(0, 3), optimal: false, method: 'constructive', ms: 10 };
  finishSolve(first.id, res, false);
  ok(sent.length === 1, `逆手順でないのに探し直している（${sent.length} 件）`);
  console.log('  探し直さない  OK');
}

console.log('新しい盤にすると、また 1 回だけ探し直せる');
{
  arm(3);
  requestSolve(null, false);
  const first = sent[0];
  finishSolve(first.id, { plan: Solver.runsToPlan(solution), optimal: false, method: 'reverse', ms: 10 }, false);
  ok(sent.length === 2, `盤を変えたのに探し直していない（${sent.length} 件）`);
  console.log('  盤ごとに 1 回  OK');
}

console.log('保険のタイマーは、そのとき渡した予算に合わせる');
{
  // 決め打ちだと、長く探し直している最中に打ち切って Worker を壊れた扱いにしてしまう。
  const delays = [];
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => { delays.push(ms); return realSetTimeout(fn, ms); };
  arm(4);
  requestSolve(null, false);
  const shortDelays = delays.filter((d) => d >= 1000);
  ok(shortDelays.some((d) => d === hintBudgetWorker() + 2000),
    `ふつうの依頼の見張りが ${shortDelays}（期待 ${hintBudgetWorker() + 2000}）`);

  delays.length = 0;
  finishSolve(sent[0].id, { plan: Solver.runsToPlan(solution), optimal: false, method: 'reverse', ms: 10 }, false);
  const longDelays = delays.filter((d) => d >= 1000);
  ok(longDelays.some((d) => d === HINT_BUDGET_LONG + 2000),
    `探し直しの見張りが ${longDelays}（期待 ${HINT_BUDGET_LONG + 2000}）`);
  ok(!longDelays.some((d) => d < HINT_BUDGET_LONG),
    `探し直しより短い見張りがある: ${longDelays}`);
  globalThis.setTimeout = realSetTimeout;
  console.log(`  ふつう ${hintBudgetWorker() + 2000}ms / 探し直し ${HINT_BUDGET_LONG + 2000}ms  OK`);
}

console.log(fail === 0 ? '\n裏での探し直し: 全チェック通過' : `\n失敗 ${fail} 件`);

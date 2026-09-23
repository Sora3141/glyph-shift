// Worker が落ちたとき / 黙り込んだときでも、ヒントと「揃える」が反応するか
// スタブの setTimeout は 1000ms 未満を即実行、それ以上を保留する。
// 見張りタイマー（5 秒）は flushTimers() で明示的に発火させる。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

// 1) Worker が無い環境（同期で解く）
{
  W = H = 5; SIZE = 25; buildDom(); types = 3; newPuzzle(4);
  ok(!worker, 'この環境では Worker は作られないはず');
  let called = false;
  requestSolve(() => { called = true; });
  ok(called, '同期のとき、待ち手が呼ばれていない');
  ok(hintPlan !== null, '同期のとき、手順が入っていない');
  console.log('  Worker が無い環境: 同期で解いて応答する');
}

globalThis.Blob = function () {};
globalThis.URL = { createObjectURL: () => 'blob:x' };

// 2) Worker を作れるが、solve を投げた直後にエラーになる
{
  let posted = 0;
  globalThis.Worker = function () {
    const self = this;
    this.postMessage = (m) => { if (m.type === 'solve') { posted++; self.onerror(new Error('boom')); } };
    this.terminate = () => {};
  };
  // newPuzzle の末尾に先読みの解決が入っているので、生成した時点で
  // Worker に投げられ、そこで落ちる。落ちたあとの状態を見る。
  W = H = 5; SIZE = 25; buildDom(); types = 3; newPuzzle(5);
  ok(posted >= 1, `Worker へ投げた回数 ${posted}`);
  ok(!worker, '壊れた Worker を持ったまま');
  ok(!hintBusy, '計算中のまま止まっている');
  let called = false;
  requestSolve(() => { called = true; });
  ok(called, 'Worker が落ちたあとの依頼に応答していない');
  ok(hintPlan !== null, '同期へ切り替えた結果が入っていない');
  console.log('  Worker が落ちた場合: 同期に切り替えて応答する');
}

// 3) Worker が黙り込む（返事もエラーも来ない）
{
  let terminated = false;
  workerBroken = false;                            // 前の節で「使えない」と覚えた状態を戻す
  globalThis.Worker = function () {
    this.postMessage = () => {};
    this.terminate = () => { terminated = true; };
  };
  W = H = 5; SIZE = 25; buildDom(); types = 3; newPuzzle(6);
  ok(!!worker, 'Worker が作られていない');
  let called = false;
  requestSolve(() => { called = true; });          // 先読み中なので待ち手として積まれる
  ok(!called, '返事が来ていないのに応答してしまっている');
  ok(hintBusy, '投げた直後なのに計算中でない');
  flushTimers();                                  // 見張りタイマーを発火
  ok(terminated, '黙り込んだ Worker を打ち切っていない');
  ok(called, '黙り込んだのに待ち手が呼ばれていない');
  ok(!hintBusy, '計算中のまま止まっている');
  ok(hintPlan !== null, '同期へ切り替えた結果が入っていない');
  console.log('  Worker が黙り込んだ場合: 打ち切って同期に切り替える');
}

// 4) その状態でヒントと「揃える」が実際に動くか
{
  workerBroken = false;
  W = H = 4; SIZE = 16; buildDom(); types = 3; newPuzzle(7);
  flushTimers();                                  // 先読みぶんの見張りを片付ける
  el('hintBtn').fire('click', {});
  const lit = slots.filter((s) => s._cls.has('hinted')).length;
  ok(lit === 1, `ヒントで光ったマスが ${lit} 個`);
  el('solveBtn').fire('click', {});
  el('confirmYes').fire('click', {});
  ok(isSolved(), '「揃える」で揃わない');
  console.log('  Worker が黙り込んでもヒントと「揃える」が動く');
}

// 5) Worker が無い環境では、先読みで画面を止めない
{
  delete globalThis.Worker;
  workerBroken = false;
  W = H = 8; SIZE = 64; buildDom(); types = 4;
  const t0 = process.hrtime.bigint();
  newPuzzle(11);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  ok(!hintBusy, '先読みが走ってしまっている');
  ok(hintPlan === null, '先読みの結果が入っている（＝同期で解いている）');
  ok(ms < 300, `盤面生成に ${ms.toFixed(0)}ms かかった（先読みで固まっている疑い）`);
  console.log(`  Worker 無しの盤面生成: ${ms.toFixed(0)}ms（先読みは見送る）`);

  // ヒントを押したときだけ解く
  let called = false;
  requestSolve(() => { called = true; });
  ok(called, '押したときの依頼に応答していない');
  ok(hintPlan !== null, '押したときに解けていない');
  console.log('  押したときは同期で解いて応答する');
}
console.log(fail === 0 ? '\nWorker が使えないときの動き: 全チェック通過' : `\n失敗 ${fail} 件`);

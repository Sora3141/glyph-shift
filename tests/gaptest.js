// 自動再生で「タイルの下のマスが見えっぱなし」にならないこと
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);

console.log('盤       色   手順       1回の手数  刻み   見せ方');
for (const [n, k, s] of [[4,3,3],[6,3,3],[8,4,2],[10,10,1]]) {
  W = H = n; SIZE = n*n; buildDom(); types = k; newPuzzle(s);
  requestSolve();
  const cost = planCost(activeRuns());

  globalThis.__animOpts = [];
  let ticks = 0;
  const realSet = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => {
    if (ms >= 60 && ms <= 340) { ticks++; if (ticks > 3) { return 0; } fn(); return 0; }
    return realSet(fn, ms);
  };
  el('solveBtn').fire('click', {});
  el('confirmYes').fire('click', {});
  globalThis.setTimeout = realSet;

  // ペースはゲームが自分で決める。始めるときに手順を計算し直すので、
  // テスト側で数えた手数とは食い違うことがある。実際に使われた値を読む。
  const pace = autoStep || autoPace(cost);
  const { interval, chunk } = pace;

  // タイルを滑らせたアニメーションの長さ（入場演出は delay 付きなので除く）
  const slides = (globalThis.__animOpts || []).filter((o) => o && o.duration && !o.delay && o.easing && o.easing.startsWith('cubic'));
  const dur = slides.length ? Math.max(...slides.map((o) => o.duration)) : 0;
  if (chunk <= 3) {
    ok(dur > 0, `${n}×${n}: 1 手ずつなのに滑っていない`);
    ok(dur <= interval, `${n}×${n}: 滑る時間 ${dur}ms が刻み ${interval}ms より長い`);
  } else {
    ok(dur === 0, `${n}×${n}: まとめ動かしなのに ${dur}ms 滑っている（隙間が出る）`);
  }
  console.log(`${n}×${n}${n<10?' ':''}   ${String(k).padStart(2)}   ${String(cost).padStart(7)} 手  ${String(chunk).padStart(4)} 手  ${String(interval).padStart(3)}ms   ${dur ? String(dur) + 'ms' : '滑らせない'}`);
  stopAutoSolve();
}

// 手で押したときは今までどおりの長さ
{
  W = H = 5; SIZE = 25; buildDom(); types = 3; newPuzzle(2);
  globalThis.__animOpts = [];
  fire(legalCells()[0]);
  const slides = globalThis.__animOpts.filter((o) => o && o.duration && !o.delay && o.easing && o.easing.startsWith('cubic'));
  ok(slides.length > 0 && slides[0].duration === 300, `手押しの滑る時間が ${slides[0] && slides[0].duration}ms`);
  console.log('  手で押したときは 300ms のまま');
}
console.log(fail === 0 ? '\n滑る時間と刻みの関係: 全チェック通過' : `\n失敗 ${fail} 件`);

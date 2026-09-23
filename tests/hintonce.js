// 「ヒントを 1 回押したら、光るのは 1 か所きり」の検証
// 以前は、まず保険の手順（シャッフルの逆再生。数千手ある遠回り）の 1 手目を光らせ、
// そのあと探索が終わってから本当の 1 手目に飛んでいた。
let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };
const el = (id) => document.getElementById(id);
const lit = () => slots.map((s, i) => (s._cls.has('hinted') ? i : -1)).filter((i) => i >= 0);

// 「光った」瞬間を全部ひろう
let log = [];
function watch() {
  log = [];
  slots.forEach((s, i) => {
    const add = s.classList.add;
    s.classList.add = (c) => { if (c === 'hinted') log.push(i); return add(c); };
  });
}

const press = () => { log = []; el('hintBtn').fire('click', {}); return [...new Set(log)]; };

console.log('まだ解けていない盤面で押したとき');
W = H = 5; SIZE = 25; buildDom(); types = 3; newPuzzle(9);
watch();
ok(hintPlan === null, '前提が崩れている（もう手順を持っている）');
const first = press();
ok(first.length === 1, `光った場所が ${first.length} か所（期待 1）: ${first}`);
ok(lit().length === 1, `点滅しているマスが ${lit().length} 個`);
ok(lit()[0] === activeRuns()[0].i, '点滅位置が、次に押すべきマスと違う');
console.log(`  光った場所: ${first} → ${first.length === 1 ? 'OK' : 'NG'}`);

console.log('\n手順を持っている盤面で押したとき');
flushTimers();
ok(hintPlan !== null, '探索のあとも手順を持っていない');
const again = press();
ok(again.length === 1, `光った場所が ${again.length} か所（期待 1）: ${again}`);
ok(lit()[0] === activeRuns()[0].i, '点滅位置が、次に押すべきマスと違う');
console.log(`  光った場所: ${again} → ${again.length === 1 ? 'OK' : 'NG'}`);

console.log('\n手を打った後に押したとき');
flushTimers();
{
  const r = activeRuns()[0];
  fire(r.i, r.n <= r.order - r.n ? 1 : -1);
  const after = press();
  ok(after.length === 1, `光った場所が ${after.length} か所（期待 1）: ${after}`);
  ok(lit()[0] === activeRuns()[0].i, '点滅位置が、次に押すべきマスと違う');
  console.log(`  光った場所: ${after} → ${after.length === 1 ? 'OK' : 'NG'}`);
}

console.log('\n案内の文字');
flushTimers();
ok(!logEl.textContent.includes('探し'), `探索中の文字が残っている: ${logEl.textContent}`);
ok(logEl.textContent.includes('光っているマス'), `案内が出ていない: ${logEl.textContent}`);

console.log(fail === 0 ? '\nヒントの点滅: 全チェック通過' : `\n失敗 ${fail} 件`);

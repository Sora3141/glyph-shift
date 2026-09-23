// テストの実行台。
//   node tools/runtests.js               すべて走らせる
//   node tools/runtests.js counter glyph  名前に含むものだけ走らせる
//
// テストは「ゲームを読み込んだ後の世界」を前提に書かれている（W / SIZE / buildDom /
// newPuzzle / ABILITIES などをそのまま使う）。ここでは tests/_env.js で DOM とタイマーの
// 代わり物を用意し、index.html と同じ順でゲームを読み、tests/_shim.js で古い名前を
// 橋渡ししてから本体を評価する。
//
// テストは失敗を数えて最後に「失敗 N 件」か「通過」を出す決まりなので、その出力で判定する。
// 1 本ごとに新しい場所を作るので、テストどうしが状態を汚さない。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const testDir = path.join(root, 'tests');
const GAME = ['sound.js', 'patterns.js', 'glyphs.js', 'solver.js', 'script.js']; // index.html と同じ順

// AudioContext と Worker はわざと置かない。
// sound.js は AudioContext が無ければ鳴らさずに進み、workertest は Worker が
// 無い環境で同期の道を通ることを確かめる。置くと、その検証がすり抜ける。
function makeContext() {
  const ctx = {
    console, Math, Number, String, Array, Object, Boolean, Symbol, JSON, Date, Error, RegExp,
    Set, Map, WeakMap, WeakSet, Promise, Proxy, Reflect, isNaN, parseInt, parseFloat, performance,
    Uint8Array, Int8Array, Uint16Array, Int16Array, Int32Array, Uint32Array, Float64Array,
    // index.html や style.css を自分で読んで確かめるテストがあるので通す。
    // __dirname は tests/ を指す（テストはそこから根をたどる）。
    require, process, __dirname: testDir,
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const run = (file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  run('tests/_env.js');
  for (const f of GAME) run(f);
  run('tests/_shim.js');
  return ctx;
}

const pick = process.argv.slice(2);
const files = fs.readdirSync(testDir)
  .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
  .filter((f) => !pick.length || pick.some((p) => f.includes(p)))
  .sort();

let passed = 0;
const bad = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(testDir, f), 'utf8');
  let out = '';
  let err = null;
  const ctx = makeContext();
  ctx.console = Object.assign(Object.create(console), { log: (...a) => { out += a.join(' ') + '\n'; } });
  try { vm.runInContext(src, ctx, { filename: f }); } catch (e) { err = e; }
  // どのテストも最後に「失敗 N 件」か合格の知らせ（「全チェック通過」「… OK」など
  // 言い回しは揃っていない）を出す。そこで、失敗と見なすのは
  //   例外が飛んだ / 「失敗 N 件」が出た / 何も出さずに終わった
  // の 3 つだけにする。途中の FAIL 行だけを数えると、打ち消してある下書き
  //（cleartest.js の冒頭のダミー）まで拾ってしまう。
  const failLine = /失敗\s*(\d+)\s*件/.exec(out);
  if (!err && !failLine && out.trim()) { passed++; console.log(`  通過  ${f}`); continue; }
  bad.push(f);
  const why = err ? String(err).split('\n')[0] : failLine ? failLine[0] : '何も出力せずに終わった';
  console.log(`★ 失敗  ${f}  ${why}`);
  if (process.env.TRACE && err) console.log(err.stack);
  for (const l of out.split('\n').filter((l) => /FAIL/.test(l)).slice(0, 4)) console.log('        ' + l.trim());
}
// Service Worker のテストだけは、キャッシュの振る舞いを見るために自分で場所を作る。
// ここの DOM の代わり物とは前提が違うので、別のプロセスとして走らせる。
let swRan = false;
if (!pick.length || pick.some((p) => 'swunit'.includes(p))) {
  swRan = true;
  const r = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'swunit.js')], { encoding: 'utf8' });
  const swOk = r.status === 0 && !/失敗\s*\d+\s*件/.test(r.stdout || '');
  console.log(`${swOk ? '  通過' : '★ 失敗'}  swunit.js`);
  if (!swOk) { bad.push('swunit.js'); console.log((r.stdout || '').split('\n').filter((l) => /FAIL|失敗/.test(l)).slice(0, 4).map((l) => '        ' + l.trim()).join('\n')); }
  else passed++;
}

const total = files.length + (swRan ? 1 : 0);
console.log(`\n${total} 本中 通過 ${passed} / 失敗 ${bad.length}`);
if (bad.length) { console.log('失敗: ' + bad.join(' ')); process.exit(1); }

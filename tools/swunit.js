// sw.js の検証。ブラウザを立てず、Service Worker の周りだけを作って直接動かす。
// （ヘッドレスの仮想時間では install が進まないため、ここで筋を確かめる）
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');   // リポジトリの場所に依らないようにする
const ORIGIN = 'https://example.test/glyph-shift/';

let fail = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL:', m); fail++; } };

// ---- 周りの作り物 ----
class Res {
  constructor(body, { ok = true, type = 'basic', url = '' } = {}) {
    this.body = body; this.ok = ok; this.type = type; this.url = url;
  }
  clone() { return new Res(this.body, { ok: this.ok, type: this.type, url: this.url }); }
}
class Req {
  constructor(url, { method = 'GET', mode = 'no-cors' } = {}) {
    this.url = new URL(url, ORIGIN).href; this.method = method; this.mode = mode;
  }
}

class Cache {
  constructor() { this.map = new Map(); }
  key(r) { const u = new URL(typeof r === 'string' ? r : r.url, ORIGIN); u.search = ''; return u.href; }
  async put(r, res) { this.map.set(this.key(r), res); }
  async match(r) { return this.map.get(this.key(r)) || undefined; }
  async addAll(list) {
    for (const f of list) {
      const res = await net(new Req(f));
      if (!res.ok) throw new Error('addAll 失敗: ' + f);
      await this.put(new Req(f), res);
    }
  }
}

const store = new Map();
const caches = {
  async open(name) { if (!store.has(name)) store.set(name, new Cache()); return store.get(name); },
  async keys() { return [...store.keys()]; },
  async delete(name) { return store.delete(name); },
  async match(r) { for (const c of store.values()) { const hit = await c.match(r); if (hit) return hit; } return undefined; },
};

// 通信。online を false にすると落ちる。外の生地は「別オリジン」として返す。
let online = true;
let hits = 0;
async function net(req) {
  hits++;
  if (!online) throw new Error('offline');
  const u = new URL(req.url, ORIGIN);
  if (u.origin !== new URL(ORIGIN).origin) return new Res('外の中身', { type: 'cors', url: req.url });
  let rel = u.pathname.replace(new URL(ORIGIN).pathname, '');
  if (rel === '' || rel === '/') rel = 'index.html';
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Res(null, { ok: false, url: req.url });
  return new Res(fs.readFileSync(file), { url: req.url });
}

const listeners = {};
let claimed = false, skipped = false;
const self_ = {
  location: { origin: new URL(ORIGIN).origin, href: ORIGIN + 'sw.js' },
  addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  clients: { claim: async () => { claimed = true; } },
  skipWaiting: async () => { skipped = true; },
  caches, fetch: net, URL, Promise, Error,
};
const ctx = vm.createContext({ ...self_, self: self_, console });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), ctx, { filename: 'sw.js' });

// イベントを起こして、waitUntil / respondWith に渡されたものを待つ
const fire = async (type, extra = {}) => {
  let waited = null, answered = null;
  const e = { ...extra, waitUntil: (p) => { waited = p; }, respondWith: (p) => { answered = p; } };
  for (const f of listeners[type] || []) await f(e);
  if (waited) await waited;
  return answered ? answered.then((r) => r, (err) => ({ error: err })) : null;
};

(async () => {
  console.log('入れるとき（install）');
  // 古い版の箱があるところから始める
  (await caches.open('glyph-shift-shell-v0')).put(new Req('index.html'), new Res('ふるい'));
  // 同じ生地（sora3141.github.io）にいる他のアプリの箱
  (await caches.open('gear-align-v1')).put(new Req('index.html'), new Res('よそ'));
  await fire('install');
  const shells = (await caches.keys()).filter((k) => k.startsWith('glyph-shift-shell'));
  ok(shells.length === 2, `入れた直後の箱: ${shells.join(', ')}`);
  const now = shells.find((k) => k !== 'glyph-shift-shell-v0');
  const c = await caches.open(now);
  const files = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')
    .match(/const FILES = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  for (const f of files) ok(await c.match(new Req(f)), `一式に入っていない: ${f}`);
  console.log(`  ${files.length} 件を ${now} に入れた`);
  ok(skipped, '入れ終えてもすぐ交代しない（全部のタブを閉じるまで古い版が居座る）');

  // index.html が指すファイルが、ひとつ残らず一式に入っているか
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
    .filter((u) => !/^https?:/.test(u) && u !== 'sw.js' && u !== '/'); // '/' はポータルへのリンク（このアプリの外）
  for (const r of refs) ok(files.includes(r), `index.html が指す ${r} が一式に入っていない`);
  console.log(`  index.html が指す ${refs.length} 件はすべて一式にある`);

  console.log('\n切り替えるとき（activate）');
  await fire('activate');
  const left = await caches.keys();
  ok(!left.includes('glyph-shift-shell-v0'), `古い箱が残っている: ${left.join(', ')}`);
  ok(left.includes(now), '今の箱まで捨てている');
  ok(left.includes('gear-align-v1'), `他のアプリの箱まで捨てている: ${left.join(', ')}`);
  ok(claimed, '今開いている画面を受け持っていない');

  console.log('\n通信が無いとき');
  online = false;
  for (const f of ['style.css', 'script.js', 'glyphs.js', 'icons/icon-192.png']) {
    const r = await fire('fetch', { request: new Req(f) });
    ok(r && !r.error, `通信なしで ${f} が返らない`);
  }
  const nav = await fire('fetch', { request: new Req('./', { mode: 'navigate' }) });
  ok(nav && !nav.error, '通信なしで画面が開けない');
  // 置いていないものは、素直に諦める（握りつぶさない）
  const miss = await fire('fetch', { request: new Req('nothing-here.js') });
  ok(miss && miss.error, '置いていないものまで何か返している');

  console.log('\n通信があるとき');
  // まず通信を見る。配り直したぶんが、版を上げなくても届くこと。
  online = true;
  hits = 0;
  await fire('fetch', { request: new Req('script.js') });
  ok(hits === 1, `箱にあるものを通信で取り直していない（${hits} 回）`);
  // 取れた中身は箱にも入れ直す（次に通信が切れたとき新しいほうが返る）
  hits = 0;
  const extra = await fire('fetch', { request: new Req('README.md') });
  ok(extra && !extra.error && hits === 1, '一式に無いものを取りに行っていない');
  online = false;
  const kept = await fire('fetch', { request: new Req('README.md') });
  ok(kept && !kept.error, '取ったものを箱に入れていない（通信が切れたら返せない）');
  online = true;

  console.log('\n外の生地（Google Fonts）');
  hits = 0;
  const font = await fire('fetch', { request: new Req('https://fonts.gstatic.com/s/a.woff2') });
  ok(font && !font.error, '書体が取れない');
  hits = 0;
  await fire('fetch', { request: new Req('https://fonts.gstatic.com/s/a.woff2') });
  ok(hits === 0, '書体を覚えていない');
  ok((await caches.keys()).includes('glyph-shift-fonts'), '書体の箱が無い');
  // 関係ない外の生地には手を出さない
  const other = await fire('fetch', { request: new Req('https://example.com/x.js') });
  ok(other === null, '関係ない外の生地にまで手を出している');

  console.log('\nその他');
  const post = await fire('fetch', { request: new Req('script.js', { method: 'POST' }) });
  ok(post === null, 'GET 以外にまで手を出している');

  console.log(fail ? `\nService Worker: 失敗 ${fail} 件` : '\nService Worker: 全チェック通過');
  process.exit(fail ? 1 : 0);
})();

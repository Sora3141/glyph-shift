// ---- Service Worker ----
// アプリとしてインストールできるようにするためと、通信が無くても遊べるようにするため。
// このゲームはサーバに何も問い合わせないので、一式を持っておけばそれで完結する。
//
// 中身を書き換えたら VERSION を上げること。上げると新しい箱に一式を入れ直し、
// 古い箱は activate で捨てる。版は丸ごと入れ替わるので、
// 「新しい HTML と古い script.js」のような食い違いは起きない。
//
// skipWaiting は呼ばない。開いている画面は最後まで同じ版のまま動き、
// 新しい版は次に開き直したときに効く。遊んでいる最中に中身が入れ替わらないように。
const VERSION = 'v1';
const SHELL = `glyph-shift-shell-${VERSION}`;
const FONTS = 'glyph-shift-fonts';

// 画面を出すのに要るもの。すべて同じ生地（同一オリジン）。
const FILES = [
  './',
  'index.html',
  'style.css',
  'sound.js',
  'patterns.js',
  'glyphs.js',
  'solver.js',
  'script.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // 取りこぼしを黙って見逃さないため addAll を使う（1 つでも落ちれば install ごと失敗し、
  // 古い版が生き残る。中途半端な箱ができるよりそのほうがいい）
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k === SHELL || k === FONTS ? null : caches.delete(k)))))
      .then(() => self.clients.claim())   // 初回、今開いている画面もすぐ受け持つ
  );
});

// 取れたら箱にも入れておく
const fetchAndKeep = (cacheName, req) =>
  fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(cacheName).then((c) => c.put(req, copy));
    }
    return res;
  });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // 同じ生地は箱を先に見る。版ごと入れ替える方針なので、
    // 1 回の表示のなかで新旧が混ざることはない。
    e.respondWith(
      caches.match(req, { ignoreSearch: true })
        .then((hit) => hit
          || fetchAndKeep(SHELL, req)
            // 通信も箱も駄目なとき、画面への求めには置いてある画面を返す
            .catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Promise.reject(new Error('offline')))))
    );
    return;
  }

  // 外の生地は Google Fonts だけ。取れたら覚えておき、次からは箱で済ませる。
  // どちらも無ければ何もしない（指定してある代わりの書体で表示される）。
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(FONTS).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});

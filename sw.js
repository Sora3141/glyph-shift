// ---- Service Worker ----
// アプリとしてインストールできるようにするためと、通信が無くても遊べるようにするため。
// このゲームはサーバに何も問い合わせないので、一式を持っておけばそれで完結する。
//
// 取り方は「まず通信、駄目なら箱」。配信し直したぶんは次に開いたときに必ず反映され、
// 通信が無いときは箱の中身で遊べる。
//
// 以前は「まず箱」にしていたが、新しい版を配るのに VERSION の手上げが要り、
// 上げ忘れると古い一式が配られ続けた（実際に 3 回続けて上げ忘れた）。
// 更新の合図を人の手に委ねない形にしてある。VERSION は箱の名前を変えて
// 作り直すためだけのもので、上げ忘れても新しい中身は届く。
const VERSION = 'v4';
// 箱の名前は必ずこの接頭辞で始める。t-of.github.io の他のアプリと同じ生地（オリジン）で
// CacheStorage を分け合っているので、片付けるときは自分の接頭辞のものにしか手を出さない。
const PREFIX = 'glyph-shift-';
const SHELL = `${PREFIX}shell-${VERSION}`;
const FONTS = `${PREFIX}fonts`;

// 画面を出すのに要るもの。すべて同じ生地（同一オリジン）。
const FILES = [
  './',
  './index.html',
  './style.css',
  './sound.js',
  './patterns.js',
  './glyphs.js',
  './solver.js',
  './script.js',
  './webapp-kit/webapp-kit.css',
  './webapp-kit/webapp-kit.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // 取りこぼしを黙って見逃さないため addAll を使う（1 つでも落ちれば install ごと失敗し、
  // 古い版が生き残る。中途半端な箱ができるよりそのほうがいい）
  // 入れ終えたらすぐ交代する。待たせると、全部のタブを閉じるまで古い版が居座る。
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // 消すのは自分の古い箱だけ。他のアプリの箱は同じ生地にあっても残す
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith(PREFIX) && k !== SHELL && k !== FONTS)
        .map((k) => caches.delete(k))))
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
    // 同じ生地はまず通信を見て、取れたら箱も更新する。
    // 取れないとき（機内モードなど）だけ箱から返す。
    e.respondWith(
      fetchAndKeep(SHELL, req).catch(() => caches.match(req, { ignoreSearch: true })
        // 箱にも無いとき、画面への求めには置いてある画面を返す
        .then((hit) => hit
          || (req.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(new Error('offline')))))
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

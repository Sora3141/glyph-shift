// ---- 柄の生成器 ----
//
// ~/dev/tilezukan（対称タイル図鑑）から、柄を作る部分だけを持ち込んだもの。
// どの柄も f(i, j, n, m, seed) -> 0..m-1 の純粋関数で、i が行・j が列。
// このゲームの盤は x が列・y が行なので、取り込むときに入れ替える。
//
// 元の資料にあった対称性の実測（symmetryOf など）は図鑑の表示用なので省いた。
// PATTERNS という名前がゲーム側と衝突するので、ソルバーと同じく関数に包む。
function tilePatterns() {
  'use strict';

  /* 正方形タイルの対称柄ジェネレータ
     すべて f(i, j, n, m, seed) -> 0..m-1 */

  function mod(a, b) { return ((a % b) + b) % b; }
  function popcount(x) { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; }

  /* --- 中心からの座標（2倍スケールで整数に保つ） --- */
  function U(i, n) { return 2 * i - (n - 1); }

  /* --- D4 不変な基本場（すべて整数を返す） --- */
  function fMasu(i, j, n) { return Math.min(i, j, n - 1 - i, n - 1 - j); }            // 枡：縁からの距離
  function fHishi(i, j, n) { return (Math.abs(U(i, n)) + Math.abs(U(j, n))) / 2; }     // 菱：市街距離
  function fEn(i, j, n) { return Math.round(Math.hypot(U(i, n), U(j, n)) / 2); }       // 円：ユークリッド距離
  function fSuji(i, j, n) { return Math.abs(Math.abs(U(i, n)) - Math.abs(U(j, n))) / 2; } // 斜め十字
  function fSoukyoku(i, j, n) { return Math.round(Math.abs(U(i, n) * U(j, n)) / 4); }  // 双曲：積

  /* --- 対称化：軌道の代表元を返す --- */
  function rot(p, n) { return [p[1], n - 1 - p[0]]; }
  function lessThan(a, b) { return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]); }
  function canon(i, j, n, group) {
    let pts;
    if (group === 'C4' || group === 'D4') {
      pts = []; let p = [i, j];
      for (let k = 0; k < 4; k++) { pts.push(p); p = rot(p, n); }
      if (group === 'D4') { let q = [i, n - 1 - j]; for (let k = 0; k < 4; k++) { pts.push(q); q = rot(q, n); } }
    } else if (group === 'C2') {          // 180°回転だけ
      pts = [[i, j], [n - 1 - i, n - 1 - j]];
    } else if (group === 'M') {            // 左右の鏡だけ
      pts = [[i, j], [i, n - 1 - j]];
    } else {                               // D2: 縦横の鏡
      pts = [[i, j], [n - 1 - i, j], [i, n - 1 - j], [n - 1 - i, n - 1 - j]];
    }
    let best = pts[0];
    for (const p of pts) if (lessThan(p, best)) best = p;
    return best;
  }


  /* --- 輪ごとの位置：外側からの輪番号 r と、4分の1周内の位置 q --- */
  function ringPos(i, j, n) {
    const r = Math.min(i, j, n - 1 - i, n - 1 - j);
    const s = n - 2 * r;                 // この輪の一辺
    if (s <= 1) return { r, q: 0, s, t: 0, L: 1 };
    const a = r, b = n - 1 - r, L = s - 1;
    let t;
    if (i === a) t = j - a;
    else if (j === b) t = L + (i - a);
    else if (i === b) t = 2 * L + (b - j);
    else t = 3 * L + (b - i);
    return { r, q: t % L, s, t: t, L: L };
  }

  /* --- 種つき乱数（座標ハッシュ） --- */
  function hash(a, b, s) {
    let x = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(s + 1, 83492791);
    x = Math.imul(x ^ (x >>> 15), 2246822519); x ^= x >>> 13;
    x = Math.imul(x, 3266489917); x ^= x >>> 16;
    return x >>> 0;
  }

  /* --- 象限：90°回転で 0→1→2→3 と進む（奇数 n の中心だけ -1） --- */
  function quad(i, j, n) {
    const u = U(i, n), v = U(j, n);
    if (u === 0 && v === 0) return -1;
    if (u < 0 && v <= 0) return 0;
    if (v > 0 && u <= 0) return 1;
    if (u > 0 && v >= 0) return 2;
    return 3;
  }
  /* --- 色の巡回 σ：4乗すると元に戻る置換。色4以降は動かない --- */
  function rotStep(c, m) { return m >= 4 ? (c < 4 ? (c + 1) % 4 : c) : (c < 2 ? 1 - c : c); }
  function permTimes(m, c, t) { for (let k = 0; k < ((t % 4) + 4) % 4; k++) c = rotStep(c, m); return c; }
  function fixedColors(m) {            // σ が動かさない色
    if (m >= 5) { const a = []; for (let c = 4; c < m; c++) a.push(c); return a; }
    if (m === 3) return [2];
    return [];
  }
  function atCenter(m, base) { const fx = fixedColors(m); return fx.length ? fx[0] : base; }
  /* 帯 v を「巡る色」と「固定色」に振り分け、象限 q だけ色を送る */
  function shapeSpin(v, q, m) {
    const fx = fixedColors(m);
    const base = (v % 2 === 1 && fx.length) ? fx[Math.floor(v / 2) % fx.length] : 0;
    return q < 0 ? atCenter(m, base) : permTimes(m, base, q);
  }

  /* --- 種つき柄の色割り当て：基本領域に m 色を必ず行き渡らせる --- */
  var _mapCache = new Map();
  function seedMap(n, m, s, group) {
    const key = group + '|' + n + '|' + m + '|' + s;
    let mp = _mapCache.get(key);
    if (mp) return mp;
    const seen = new Set(), cells = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const [a, b] = canon(i, j, n, group), k = a * n + b;
      if (!seen.has(k)) { seen.add(k); cells.push(k); }
    }
    cells.sort((x, y) => hash(x, 0, s) - hash(y, 0, s));   // 種で並べ替え
    mp = new Map();
    cells.forEach((k, idx) => mp.set(k, idx < m ? idx : hash(k, 1, s) % m));
    if (_mapCache.size > 400) _mapCache.clear();
    _mapCache.set(key, mp);
    return mp;
  }

  /* --- 石畳のブロック幅：n を割り切る最小の幅（2以上） --- */
  function blockOf(n) {
    for (let d = 2; d < n; d++) if (n % d === 0) return d;
    return 1; // n が素数なら1マス＝市松
  }

  const PATTERNS = [
    /* ===== 全対称（D4）系 ===== */
    {
      id: 'masu', name: '枡繋ぎ', kana: 'ますつなぎ',
      note: '縁からの距離で塗る。入れ子の正方形。',
      formula: (n, m) => `c = min(i, j, ${n - 1}-i, ${n - 1}-j) mod ${m}`,
      f: (i, j, n, m) => mod(fMasu(i, j, n), m),
    },
    {
      id: 'hishi', name: '鱗菱', kana: 'うろこびし',
      note: '中心からの市街距離。敷き詰めると菱形格子になる。',
      formula: (n, m) => `c = (|u|+|v|) mod ${m}`,
      f: (i, j, n, m) => mod(fHishi(i, j, n), m),
    },
    {
      id: 'en', name: '年輪', kana: 'ねんりん',
      note: '中心からの直線距離を丸める。同心円。',
      formula: (n, m) => `c = round(√(u²+v²)) mod ${m}`,
      f: (i, j, n, m) => mod(fEn(i, j, n), m),
    },
    {
      id: 'suji', name: '斜め十字', kana: 'ななめじゅうじ',
      note: '2本の対角線からの距離。X 字が浮かぶ。',
      formula: (n, m) => `c = ||u|-|v|| mod ${m}`,
      f: (i, j, n, m) => mod(fSuji(i, j, n), m),
    },
    {
      id: 'soukyoku', name: '双曲', kana: 'そうきょく',
      note: '中心線からの距離の積。四隅ほど色が速く変わる。',
      formula: (n, m) => `c = round(|u·v|) mod ${m}`,
      f: (i, j, n, m) => mod(fSoukyoku(i, j, n), m),
    },
    {
      id: 'masuhishi', name: '枡重ね', kana: 'ますがさね',
      note: '枡と菱を足し合わせた合成。対称性は保たれる。',
      formula: (n, m) => `c = (枡 + 菱) mod ${m}`,
      f: (i, j, n, m) => mod(fMasu(i, j, n) + fHishi(i, j, n), m),
    },
    {
      id: 'enhishi', name: '干渉', kana: 'かんしょう',
      note: '円と双曲の合成。モアレ状のうねりが出る。',
      formula: (n, m) => `c = (年輪 + 双曲) mod ${m}`,
      f: (i, j, n, m) => mod(fEn(i, j, n) + fSoukyoku(i, j, n), m),
    },
    {
      id: 'mon', name: '紋', kana: 'もん', seeded: true,
      note: '八分の一の領域に乱数を置き、8方向に折り返す。家紋や雪の結晶に似る。',
      formula: () => `1/8 領域を種から生成 → 8方向に鏡映`,
      f: (i, j, n, m, s) => { const [a, b] = canon(i, j, n, 'D4'); return seedMap(n, m, s, 'D4').get(a * n + b); },
    },

    /* ===== 回転のみ（C4）系 ===== */
    {
      id: 'kazaguruma', name: '風車', kana: 'かざぐるま',
      note: '各輪を4等分し、同じ塗りを回して並べる。90°回転でぴたりと重なる。',
      formula: (n, m) => `c = ⌊q·${m}/(輪の1/4)⌋（q は4分の1周内の位置）`,
      f: (i, j, n, m) => { const { q, s } = ringPos(i, j, n); const L = Math.max(1, s - 1); return mod(Math.floor(q * m / L), m); },
    },
    {
      id: 'uzu', name: '渦', kana: 'うず',
      note: '4分の1周ごとの位置に、輪の番号だけ色をずらして足す。巻き込む流れが出る。',
      formula: (n, m) => `c = (q + r) mod ${m}（r は外側からの輪番号）`,
      f: (i, j, n, m) => { const { q, r } = ringPos(i, j, n); return mod(q + r, m); },
    },
    {
      id: 'manji', name: '風車種', kana: 'かざぐるまだね', seeded: true,
      note: '四分の一の領域に乱数を置き、回転だけで写す。',
      formula: () => `1/4 領域を種から生成 → 90°回転で複製`,
      f: (i, j, n, m, s) => { const [a, b] = canon(i, j, n, 'C4'); return seedMap(n, m, s, 'C4').get(a * n + b); },
    },

    /* ===== 縦横対称（D2）系 ===== */
    {
      id: 'koushi', name: '格子縞', kana: 'こうしじま',
      note: '縦と横で重みを変える。縦横の軸だけが対称になる。',
      formula: (n, m) => `c = (2·min(i,${n - 1}-i) + min(j,${n - 1}-j)) mod ${m}`,
      f: (i, j, n, m) => mod(2 * Math.min(i, n - 1 - i) + Math.min(j, n - 1 - j), m),
    },
    {
      id: 'oribane', name: '折り種', kana: 'おりだね', seeded: true,
      note: '四分の一に乱数を置き、上下左右に折り返す。切り紙細工の作り方。',
      formula: () => `1/4 領域を種から生成 → 上下左右に鏡映`,
      f: (i, j, n, m, s) => { const [a, b] = canon(i, j, n, 'D2'); return seedMap(n, m, s, 'D2').get(a * n + b); },
    },

    /* ===== 対角線対称・点対称系 ===== */
    {
      id: 'ichimatsu', name: '市松・石畳', kana: 'いちまつ・いしだたみ',
      note: 'ブロック単位の市松。m=2 なら市松、m≥3 なら斜めの階段。',
      formula: (n, m) => `c = (⌊i/${blockOf(n)}⌋ + ⌊j/${blockOf(n)}⌋) mod ${m}`,
      f: (i, j, n, m) => { const k = blockOf(n); return mod(Math.floor(i / k) + Math.floor(j / k), m); },
    },
    {
      id: 'shima', name: '斜め縞', kana: 'ななめじま',
      note: '最も素直な柄。m が n を割り切ると継ぎ目が消える。',
      formula: (n, m) => `c = (i+j) mod ${m}`,
      f: (i, j, n, m) => mod(i + j, m),
    },
    {
      id: 'sujikai', name: '筋交い', kana: 'すじかい',
      note: '対角線からの距離。点対称と2本の対角軸を持つ。',
      formula: (n, m) => `c = |i-j| mod ${m}`,
      f: (i, j, n, m) => mod(Math.abs(i - j), m),
    },
    {
      id: 'xor', name: '排他', kana: 'はいた',
      note: 'i と j のビット排他的論理和。n が2の冪のとき入れ子の市松になる。',
      formula: (n, m) => `c = (i XOR j) mod ${m}`,
      f: (i, j, n, m) => mod(i ^ j, m),
    },
    {
      id: 'kuku', name: '九九', kana: 'くく',
      note: '掛け算表の余り。m と n の関係で見え方が激変する。',
      formula: (n, m) => `c = (i·j) mod ${m}`,
      f: (i, j, n, m) => mod(i * j, m),
    },
    /* ===== 片側だけの対称 ===== */
    {
      id: 'futatsu', name: '二つ巴', kana: 'ふたつどもえ',
      note: '各輪を半周ずつ折り返す。180°回してぴたりと重なるが、鏡には映らない。',
      formula: (n, m) => `c = ((t mod 2L) + r) mod ${m}　t は輪の一周位置、L は1/4周`,
      f: (i, j, n, m) => { const { r, t, L } = ringPos(i, j, n); return mod((t % (2 * L)) + r, m); },
    },
    {
      id: 'hanadane', name: '点対称種', kana: 'てんたいしょうだね', seeded: true,
      note: 'タイルの半分を種から塗り、180°回して写す。線対称は一本も持たない。',
      formula: () => `1/2 領域を種から生成 → 180°回転で複製`,
      f: (i, j, n, m, s) => { const [a, b] = canon(i, j, n, 'C2'); return seedMap(n, m, s, 'C2').get(a * n + b); },
    },
    {
      id: 'yamagata', name: '山形', kana: 'やまがた',
      note: '横は折り返し、縦は流す。左右の軸だけが対称で、180°回すと合わない。',
      formula: (n, m) => `c = (i + min(j, ` + (n-1) + `-j)) mod ` + m,
      f: (i, j, n, m) => mod(i + Math.min(j, n - 1 - j), m),
    },
    {
      id: 'kataori', name: '片折り種', kana: 'かたおりだね', seeded: true,
      note: '左半分を種から塗り、右に鏡で写すだけ。線対称は一本、点対称はない。',
      formula: () => `左半分を種から生成 → 左右に鏡映`,
      f: (i, j, n, m, s) => { const [a, b] = canon(i, j, n, 'M'); return seedMap(n, m, s, 'M').get(a * n + b); },
    },

    /* ===== 形だけが対称（回転すると色が入れ替わる） ===== */
    {
      id: 'yonhen', name: '四片', kana: 'よんぺん', shapeOnly: true,
      note: '中心の正方形と、それを囲む4つの合同な片。回転すると片の色が順に入れ替わる。分割の形だけ見れば全対称。',
      formula: () => `c = σ^象限(枡の輪)　偶数の輪は巡り、奇数の輪は固定`,
      f: (i, j, n, m) => shapeSpin(fMasu(i, j, n), quad(i, j, n), m),
    },
    {
      id: 'kazairo', name: '風車色', kana: 'かざいろ', shapeOnly: true,
      note: '菱形の場に、象限ごとの色送りをかける。菱の形は残したまま色だけが回る。',
      formula: () => `c = σ^象限(菱の帯)　σ は4乗で戻る色の巡回`,
      f: (i, j, n, m) => shapeSpin(fHishi(i, j, n), quad(i, j, n), m),
    },
    {
      id: 'tomoe', name: '四つ巴', kana: 'よつどもえ', shapeOnly: true,
      note: '同心円の場に色送りをかける。輪は繋がったまま、四方で色が入れ替わる。',
      formula: () => `c = σ^象限(年輪の帯)　σ は4乗で戻る色の巡回`,
      f: (i, j, n, m) => shapeSpin(fEn(i, j, n), quad(i, j, n), m),
    },
    {
      id: 'sierpinski', name: '入れ子三角', kana: 'いれこさんかく',
      note: 'i と j の共通ビット数。シェルピンスキー三角形の親戚。',
      formula: (n, m) => `c = popcount(i AND j) mod ${m}`,
      f: (i, j, n, m) => mod(popcount(i & j), m),
    },
  ];

  return { PATTERNS, blockOf };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { tilePatterns };

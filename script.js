// Glyph Shift
// 各タイルには「能力」が絵柄として描かれている。押すとその能力が発動する。
// 能力は座標ではなくタイルに属するので、タイルが動けば能力も一緒に動く。
//
// 盤の端はつながっていない。効果の及ぶマスが盤の外に出てしまう位置では、
// そのタイルは能力を使えない（＝押しても何も起きない）。
//
// 解けることの保証:
//   (1) すべての能力は「自分自身は動かさない（周りを動かす）」。
//   (2) 使えるかどうかは 能力 と 位置 だけで決まる。
//   発動しても自分は同じマスに残るので、一度使えた手は発動後も必ず使える。
//   よって同じマスを押し続ければ必ず元の盤面に戻せる = どの手も取り消せる。
//   完成状態から合法手だけで崩して初期盤面を作るので、完成へ戻る手順が必ず存在する。
//   同時に「直前に打った手がそのまま残る」ので、手詰まり（合法手ゼロ）にもならない。

// 盤は長方形にできる。W が横、H が縦のマス数。正方形はその特別な場合。
let W = 4;
let H = 4;
let SIZE = W * H;

const idx = (x, y) => y * W + x;
const xOf = (i) => i % W;
const yOf = (i) => Math.floor(i / W);
const inB = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 能力定義 ----
// cells: 効果を受けるマスを絶対座標 [x, y] のサイクルで返す。
//        [a, b, c] は a の中身 → b、b → c、c → a という移動（2 個なら入れ替え）。
//        1 マスでも盤の外に出るか、自分のマスを含む場合は「使えない」と判定される。
const ABILITIES = [
  { id: 'swapLR', color: 'hsl(352 38% 74%)', name: '左右の隣どうしを入れ替え',
    cells: (x, y) => [[[x - 1, y], [x + 1, y]]] },

  { id: 'swapUD', color: 'hsl(22 64% 50%)', name: '上下の隣どうしを入れ替え',
    cells: (x, y) => [[[x, y - 1], [x, y + 1]]] },

  { id: 'swapD1', color: 'hsl(42 38% 51%)', name: '左上と右下を入れ替え',
    cells: (x, y) => [[[x - 1, y - 1], [x + 1, y + 1]]] },

  { id: 'swapD2', color: 'hsl(62 56% 50%)', name: '右上と左下を入れ替え',
    cells: (x, y) => [[[x + 1, y - 1], [x - 1, y + 1]]] },

  { id: 'crossCW', color: 'hsl(92 59% 76%)', name: '上下左右の 4 マスを時計回り',
    cells: (x, y) => [[[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]] },

  { id: 'diagCW', color: 'hsl(135 54% 50%)', name: '斜め 4 マスを時計回り',
    cells: (x, y) => [[[x - 1, y - 1], [x + 1, y - 1], [x + 1, y + 1], [x - 1, y + 1]]] },

  { id: 'ringCW', color: 'hsl(168 68% 50%)', name: '周囲 8 マスを時計回り',
    cells: (x, y) => [[[x - 1, y - 1], [x, y - 1], [x + 1, y - 1], [x + 1, y],
                       [x + 1, y + 1], [x, y + 1], [x - 1, y + 1], [x - 1, y]]] },

  // 以下は回転の半分ぶん。向かい合うマスどうしが同時に入れ替わる。
  // それぞれ crossCW を 2 回、diagCW を 2 回、ringCW を 4 回使ったのと同じ動き。
  { id: 'crossHalf', color: 'hsl(192 46% 73%)', name: '上下と左右を同時に入れ替え',
    cells: (x, y) => [[[x, y - 1], [x, y + 1]], [[x + 1, y], [x - 1, y]]] },

  { id: 'diagHalf', color: 'hsl(215 43% 55%)', name: '斜めの対角どうしを同時に入れ替え',
    cells: (x, y) => [[[x - 1, y - 1], [x + 1, y + 1]], [[x + 1, y - 1], [x - 1, y + 1]]] },

  // 斜め 4 マス（四角の 4 すみ）の、上下どうし・左右どうし。
  // 「斜めの対角どうし」と合わせて、4 すみの入れ替え 3 通りが揃う。
  { id: 'sqUD', color: 'hsl(354 68% 64%)', name: '四角のすみを上下で入れ替え',
    cells: (x, y) => [[[x - 1, y - 1], [x - 1, y + 1]], [[x + 1, y - 1], [x + 1, y + 1]]] },

  { id: 'sqLR', color: 'hsl(300 68% 58%)', name: '四角のすみを左右で入れ替え',
    cells: (x, y) => [[[x - 1, y - 1], [x + 1, y - 1]], [[x - 1, y + 1], [x + 1, y + 1]]] },

  { id: 'ringHalf', color: 'hsl(315 40% 57%)', name: '周囲 8 マスを向かいどうしで入れ替え',
    cells: (x, y) => [[[x - 1, y - 1], [x + 1, y + 1]], [[x, y - 1], [x, y + 1]],
                      [[x + 1, y - 1], [x - 1, y + 1]], [[x + 1, y], [x - 1, y]]] },

  // 何も起きないマス。押しても動かないが、まわりのマスからは動かされる。
  // 色だけは持つので、目標の柄の一色として数えられる。
  // 見分けの手がかりは色相の遠さではなく「盤でただひとつの無彩色」であること
  // （彩度 C*=2.0、既存 12 色は最小でも 17.8）と、いちばん明るいこと。
  { id: 'none', color: 'hsl(48 8% 88%)', name: '何も起きない',
    cells: () => [] },

];

// 説明パネル用。系統と、効果および使える条件のくわしい説明。
const FAMILIES = [
  { key: 'swap', label: '入れ替え' },
  { key: 'rot',  label: '回転' },
  { key: 'half', label: '半回転' },
  { key: 'none', label: '能力なし' },
];

const INFO = {
  swapLR: { fam: 'swap', text: '自分の左隣と右隣を入れ替える。自分は真ん中に残る。左右どちらかの隣が盤の外になる左端・右端の列では使えない。' },
  swapUD: { fam: 'swap', text: '自分の上と下を入れ替える。自分は真ん中に残る。上下どちらかが盤の外になる最上段・最下段では使えない。' },
  swapD1: { fam: 'swap', text: '自分の左上と右下を入れ替える。左端・右端の列と、最上段・最下段では使えない。' },
  swapD2: { fam: 'swap', text: '自分の右上と左下を入れ替える。左端・右端の列と、最上段・最下段では使えない。' },
  crossCW: { fam: 'rot', text: '上・右・下・左の 4 マスを、その順に 1 つずつ送る。上の中身が右へ、右が下へ、下が左へ、左が上へ。4 方向すべてが盤内である必要がある。' },
  diagCW: { fam: 'rot', text: '左上・右上・右下・左下の 4 マスを、その順に 1 つずつ送る。斜め 4 方向すべてが盤内である必要がある。' },
  ringCW: { fam: 'rot', text: '自分を囲む 8 マス全部を時計回りに 1 つずつ送る。一度に動く数が最も多い。盤の内側でしか使えない。' },
  crossHalf: { fam: 'half', text: '上と下、右と左を同時に入れ替える。上下左右を時計回りに 2 回送ったのと同じ動き。4 方向すべてが盤内である必要がある。' },
  diagHalf: { fam: 'half', text: '左上と右下、右上と左下を同時に入れ替える。斜め 4 マスを時計回りに 2 回送ったのと同じ動き。斜め 4 方向すべてが盤内である必要がある。' },
  sqUD: { fam: 'half', text: '斜め 4 マス（四角の 4 すみ）を、上下どうしで入れ替える。左上と左下、右上と右下。斜め 4 方向すべてが盤内である必要がある。' },
  sqLR: { fam: 'half', text: '斜め 4 マス（四角の 4 すみ）を、左右どうしで入れ替える。左上と右上、左下と右下。斜め 4 方向すべてが盤内である必要がある。' },
  none: { fam: 'none', text: '押しても何も起きない。まわりのマスから動かされるだけ。盤のどこにあっても使えない。' },
  ringHalf: { fam: 'half', text: '自分を囲む 8 マスを、向かい合うものどうしで一斉に入れ替える。周囲 8 マスを時計回りに 4 回送ったのと同じ動き。盤の内側でしか使えない。' },
};

// 能力が使えるなら影響するマスのサイクルを、使えないなら null を返す。
// 動かすマスが 1 つも無い能力（何も起きないマス）も、押せないものとして null を返す。
function cyclesOf(abIndex, x, y) {
  const self = idx(x, y);
  const out = [];
  for (const cyc of ABILITIES[abIndex].cells(x, y)) {
    const mapped = [];
    for (const [cx, cy] of cyc) {
      if (!inB(cx, cy)) return null;       // 盤の外 → 使えない
      const c = idx(cx, cy);
      if (c === self) return null;         // 自分が動いてしまう → 使えない
      mapped.push(c);
    }
    out.push(mapped);
  }
  return out.length ? out : null;
}

// ---- アイコン描画 ----
// 描き方そのものは glyphs.js が持つ。ここは「今どれを使うか」だけを覚える。
const Glyphs = glyphStyles();
const GLYPH_KEY = 'glyphshift.glyph';

let glyphStyle = Glyphs.DEFAULT;
try {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(GLYPH_KEY) : null;
  if (saved && Glyphs.has(saved)) glyphStyle = saved;
} catch (e) { /* localStorage が使えない環境では既定のまま */ }

// 能力そのものから描く。cells(0, 0) が「中身をどう送るか」を relative に返す。
const iconSvg = (abIndex) => Glyphs.draw(glyphStyle, ABILITIES[abIndex].cells(0, 0), bgOf(abIndex));

// 色は能力に固定せず、盤面ごとに割り当てる。
// 能力が 12 種あるので固定の色相だと近い色が同居しうるが、柄合わせでは
// 色の見分けやすさが最優先なので、使う分だけ等間隔に配る。
// UI のアクセント（菫色）と紛れないよう、その帯は飛ばす。
// 色は能力ごとに固定する。長く遊ぶと色でブロックを覚えられるようにするため。
// 12 種あるので色相だけでは詰まる。色相は保ったまま彩度と明度を探索で調整し、
// いちばん近い 2 色の知覚的な差（CIELAB の ΔE）を 35 まで広げてある。
// 「四角のすみ」2 種を足すときは、色で覚えている人のために既存 10 色を動かさず、
// 残りの空きから 2 色だけを探した。
// 彩度は 72% までに抑えて、画面が毒々しくならないようにしている。
// UI のアクセントと紛れる菫色の帯（248〜292°）は使っていない。
const bgOf = (abIndex) => ABILITIES[abIndex].color;
const INK = 'rgba(10, 12, 20, .82)';

// ---- 柄（目標の並び） ----
// 盤の横 W・縦 H と使うブロック数 K から作れる柄。fn は各マスの色番号（0〜K-1）を返す。
// 先に柄を決めてから、その柄が必要とする個数ぶんだけブロックを用意するので、
// 目標はつねに実際に作れる配置になる。
const PATTERNS = [
  { id: 'diag',   ok: () => true,
    label: (k) => (k === 2 ? '市松模様' : '斜めじま'),
    fn: (x, y, w, h, k) => (x + y) % k },

  { id: 'bands',  ok: (w, h, k) => Math.min(w, h) >= k * 2,
    label: () => '太い斜めじま',
    fn: (x, y, w, h, k) => Math.floor((x + y) / 2) % k },

  { id: 'rows',   ok: () => true,
    label: () => '横じま',
    fn: (x, y, w, h, k) => y % k },

  { id: 'cols',   ok: () => true,
    label: () => '縦じま',
    fn: (x, y, w, h, k) => x % k },

  { id: 'rings',  ok: (w, h, k) => Math.ceil(Math.min(w, h) / 2) >= k,
    label: () => '同心の枠',
    fn: (x, y, w, h, k) => Math.min(x, y, w - 1 - x, h - 1 - y) % k },

  { id: 'frame',  ok: (w, h, k) => k === 2 && Math.min(w, h) >= 3,
    label: () => '額縁',
    fn: (x, y, w, h) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 0 : 1) },

  { id: 'halves', ok: (w, h, k) => k === 2,
    label: () => '上下二分割',
    fn: (x, y, w, h) => (y >= Math.floor(h / 2) ? 1 : 0) },

  { id: 'quads',  ok: (w, h, k) => k === 4,
    label: () => '四分割',
    fn: (x, y, w, h) => (y >= Math.floor(h / 2) ? 2 : 0) + (x >= Math.floor(w / 2) ? 1 : 0) },
];

// ---- 図鑑の柄を取り込む ----
// patterns.js（~/dev/tilezukan から持ち込んだもの）の 26 柄を足す。
// 向こうは f(i, j, ...) で i が行・j が列、こちらは fn(x, y, ...) で x が列・y が行。
// 取り込むときに入れ替える。
//
// 使えるかどうかは ok では判定しない。柄によって出せる色数の上限が違い
// （枡繋ぎは輪が ⌈n/2⌉ 本しかない等）、実際に並べてみないと分からないため、
// candidatePatterns の「k 色すべてが出るか」に任せる。
let patternSeed = 0;   // 種つきの柄に渡す。盤面ごとに変える。
let forcedAbilities = null;   // カスタムで指定されたブロック。null なら毎回ランダムに選ぶ。

if (typeof tilePatterns === 'function') {
  for (const p of tilePatterns().PATTERNS) {
    PATTERNS.push({
      id: p.id,
      ok: () => true,
      label: () => p.name,
      // 図鑑の柄は正方形が前提（回転対称など）。長方形では大きい方を一辺とする
      // 正方形の柄を作り、その左上を切り出して使う。
      fn: (x, y, w, h, k) => p.f(y, x, Math.max(w, h), k, patternSeed),
    });
  }
}

// 予備の並べ方。左上から順に色を送っていくだけで柄とは呼べないが、
// マス数さえ足りれば必ず全色が出る。正規の柄が 1 つも作れないときだけ使う。
const FALLBACK = {
  id: 'serial',
  ok: (w, h, k) => k <= w * h,
  label: () => '順送り',
  fn: (x, y, w, h, k) => (y * w + x) % k,
};

// このサイズとブロック数で実際に作れる柄を洗い出す。
// ・全色が出ない柄は除外（盤に対して色数が多いと色が余る）
// ・配置が完全に一致する柄は 1 つにまとめる
//   （例: 4×4 では「額縁」と「同心の枠」が同じ配置になり、
//     両方残すとその柄だけ 2 倍の確率で出てしまう）
function candidatePatterns(w, h, k) {
  const out = [];
  const seen = new Set();
  for (const p of PATTERNS) {
    if (!p.ok(w, h, k)) continue;
    const layout = Array.from({ length: w * h }, (_, i) => p.fn(i % w, Math.floor(i / w), w, h, k));
    if (new Set(layout).size !== k) continue;
    const sig = layout.join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(p);
  }
  // 小さい盤に色数が多いと、どの柄も全色を出せないことがある。
  // その場合だけ予備の並べ方に落として、組み合わせ自体は選べるようにする。
  if (!out.length && FALLBACK.ok(w, h, k)) out.push(FALLBACK);
  return out;
}

// 選べる盤のサイズとブロック数
const SIZES = [3, 4, 5, 6, 7, 8, 9, 10];
const TYPE_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// そのサイズで、そのブロック数の柄が作れるか
const typeAvailable = (w, h, k) => k <= ABILITIES.length && k <= w * h && candidatePatterns(w, h, k).length > 0;

// ---- 状態 ----
// 完成状態から混ぜる手数。
// 一様分布に十分近づくまで混ぜる。厳密に測った混合時間の最大はマス数あたり 82 手
// （4×4 3 色、到達状態 36,450）だったので、2 倍以上の余裕を見て 200 倍とする。
// 1 手は配列の置換だけなので、10×10 の 20,000 手でも数ミリ秒で終わる。
const scrambleSteps = () => 200 * SIZE;

let types = 2;          // 使うブロック数
let seed = 0;
let tileAbility = [];  // tileAbility[v] = タイル v の能力インデックス
let board = [];        // board[i] = マス i にあるタイルの値
// 手数は「押した回数」ではなく「正味の操作量」で数える。
// 同じマスを連続で押している間は 1 つのまとまり（run）として扱い、
// 位数 k の能力を j 回押したぶんのコストを min(j mod k, k - j mod k) とする。
// 例: 時計回り 4 マス回転（位数 4）を 3 回 → 反時計回り 1 回ぶんなので 1 手。
//     入れ替え（位数 2）を 2 回 → 元に戻るので 0 手。
let moves = 0;   // 確定済みの手数（完成時にだけ表示する）
let run = { i: -1, d: 0, order: 1 };

// 解答例。{ i: マス, n: 押す回数, order: 位数 } の並びで、
// 先頭から順に押していけば必ず目標の柄になる。
// プレイヤーが手を打つたびに追従させるので、途中からでも有効。
let solution = [];
let locked = false;

const slots = [];
const tiles = [];

const gridEl = document.getElementById('grid');
const goalGridEl = document.getElementById('goalGrid');
const legendEl = document.getElementById('legend');
const seedOutEl = document.getElementById('seedOut');
const logEl = document.getElementById('log');

const abilityAt = (i) => tileAbility[board[i]];
const cyclesAt = (i) => cyclesOf(abilityAt(i), xOf(i), yOf(i));

// 目標は「タイル v がマス v にある」状態。ただし同じ能力のタイルは互換なので、
// 並びが目標と同じ絵柄になっていればクリアとする。
const isSolved = () => board.every((_, i) => abilityAt(i) === tileAbility[i]);

const legalCells = () => {
  const out = [];
  for (let i = 0; i < SIZE; i++) if (cyclesAt(i)) out.push(i);
  return out;
};

// ---- DOM ----
function buildDom() {
  // --nx / --ny / --cell はルートに置く。盤面エリアの幅計算（style.css）からも参照するため。
  const root = document.documentElement.style;
  root.setProperty('--nx', W);
  root.setProperty('--ny', H);
  const long = Math.max(W, H);
  const cell = long >= 9 ? 46 : long >= 7 ? 54 : long === 6 ? 64 : 72;
  root.setProperty('--cell', `${cell}px`);
  // 目標の柄はサイドバー（250px）に収める
  root.setProperty('--mini-cell', `${Math.min(30, Math.floor((228 - 4 * (W - 1)) / W))}px`);
  gridEl.replaceChildren();
  slots.length = 0;
  tiles.length = 0;

  for (let i = 0; i < SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.i = String(i);
    gridEl.append(slot);
    slots[i] = slot;
  }
  for (let v = 0; v < SIZE; v++) {
    const t = document.createElement('div');
    t.className = 'tile';
    tiles[v] = t;
  }

  // 行・列の目盛り。ヒントが「3 列目・4 行目」と言うので、位置を数えずに済む。
  for (const [el, n] of [[document.getElementById('rulerX'), W], [document.getElementById('rulerY'), H]]) {
    el.replaceChildren();
    for (let k = 1; k <= n; k++) {
      const s = document.createElement('span');
      s.textContent = String(k);
      el.append(s);
    }
  }
}

function paintTiles() {
  for (let v = 0; v < SIZE; v++) {
    const ab = tileAbility[v];
    tiles[v].style.background = bgOf(ab);
    tiles[v].style.color = INK;
    tiles[v].innerHTML = iconSvg(ab);
  }
}

function placeTiles() {
  // 同じスロットにいるタイルは触らない。ノードを挿入し直すと
  // そのタイルの CSS アニメーションが再生されてしまうため。
  for (let i = 0; i < SIZE; i++) {
    const t = tiles[board[i]];
    if (t.parentNode !== slots[i]) slots[i].append(t);
  }
}

// 端に寄っていて能力を使えないタイルを暗くする
// もともと能力を持たないマスか（置き場所によらず、いつでも押せない）
const isBlank = (ab) => !ABILITIES[ab].cells(0, 0).length;

function markUsable() {
  let usable = 0;
  for (let i = 0; i < SIZE; i++) {
    const t = tiles[board[i]];
    const ab = abilityAt(i);
    if (cyclesAt(i)) { t.classList.remove('off', 'blank'); t.title = ABILITIES[ab].name; usable++; }
    else if (isBlank(ab)) {
      // 能力そのものが無いマス。位置のせいではないので、暗くする印は付けない
      t.classList.remove('off');
      t.classList.add('blank');
      t.title = ABILITIES[ab].name;
    } else {
      t.classList.remove('blank');
      t.classList.add('off');
      t.title = `${ABILITIES[ab].name}（この位置では盤の外に出るので使えない）`;
    }
  }
  return usable;
}

function renderGoal() {
  goalGridEl.replaceChildren();
  for (let i = 0; i < SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const t = document.createElement('div');
    t.className = 'tile';
    t.style.background = bgOf(tileAbility[i]);
    t.style.color = INK;
    t.innerHTML = iconSvg(tileAbility[i]);
    slot.append(t);
    goalGridEl.append(slot);
  }
}

function renderLegend() {
  legendEl.replaceChildren();
  for (const ab of [...new Set(tileAbility)].sort((a, b) => a - b)) {
    const li = document.createElement('li');
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.background = bgOf(ab);
    chip.style.color = INK;
    chip.innerHTML = iconSvg(ab);
    const txt = document.createElement('span');
    txt.textContent = ABILITIES[ab].name;
    li.append(chip, txt);
    legendEl.append(li);
  }
}

// ---- ヒント ----
// 押したときに一度だけ、次に押すべきマスを点滅させる。状態は持たない。
const HINT_BLINK_MS = 2600;
let hintTimer = null;

function clearHint() {
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  for (const slot of slots) slot.classList.remove('hinted');
}

function blinkHint() {
  clearHint();
  if (locked || isSolved() || autoSolving) return;
  const plan = activeRuns();
  if (!plan.length) return;
  const r = plan[0];
  slots[r.i].classList.add('hinted');
  const back = r.order - r.n;
  const how = r.n <= back
    ? `光っているマスを ${r.n} 回押す`
    : `光っているマスを ${back} 回長押し（逆回り）`;
  // 最短だと確定できたかどうかも伝える
  const left = planCost(plan);
  const quality = !hintPlan ? ''
    : hintPlan.optimal ? ` / ここから最短 ${left} 手`
    : ` / 残り ${left} 手（最短とはかぎりません）`;
  logEl.textContent = how + quality;
  hintTimer = setTimeout(clearHint, HINT_BLINK_MS);
}

// 1 回押したら光るのは 1 か所きり。あとから別のマスへ飛ばさない。
const HINT_SEARCHING = '手を探しています…';

function hintAfterSolve() {
  blinkHint();
  // 探し終わっても光らせるものが無かったとき（その間に完成した等）、案内を戻す
  if (logEl.textContent === HINT_SEARCHING) logEl.textContent = 'タイルをクリック';
}

function showHint() {
  if (autoSolving || locked || isSolved()) return;
  Sfx.hint();
  if (hintPlan) {
    // もう解けた手順がある。それをそのまま見せる。
    // 計算し直しはこれまでどおり毎回やるが、受け取っても点滅は動かさない
    // （光らせる場所は押した時点で決める。あとから別のマスへ飛ばさない）。
    blinkHint();
    requestSolve(null);
    return;
  }
  // まだ手順が無い。ここで保険の手順（シャッフルの逆再生）を見せると
  // 数千手の遠回りの 1 手目を指すことになり、探索が終わった途端に
  // 別のマスへ飛ぶ。見せずに、探し終わってから一度だけ光らせる。
  clearHint();
  logEl.textContent = HINT_SEARCHING;
  requestSolve(hintAfterSolve);
}

// ---- 説明パネル ----
function renderPanel() {
  document.getElementById('blockTotal').textContent = `全 ${ABILITIES.length} 種`;
  const body = document.getElementById('panelBody');
  const used = new Set(tileAbility);
  body.replaceChildren();

  for (const fam of FAMILIES) {
    const ids = ABILITIES.map((ab, k) => [ab, k]).filter(([ab]) => INFO[ab.id].fam === fam.key);
    const sec = document.createElement('section');
    const h = document.createElement('p');
    h.className = 'fam-title';
    h.textContent = `${fam.label}（${ids.length} 種）`;
    const list = document.createElement('div');
    list.className = 'fam-list';

    for (const [ab, k] of ids) {
      const row = document.createElement('div');
      row.className = used.has(k) ? 'blk' : 'blk dim';

      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.background = bgOf(k);
      chip.style.color = INK;
      chip.innerHTML = iconSvg(k);

      const main = document.createElement('div');
      main.className = 'blk-main';

      const name = document.createElement('div');
      name.className = 'blk-name';
      name.append(ab.name);
      if (used.has(k)) {
        const tag = document.createElement('span');
        tag.className = 'used';
        tag.textContent = 'このパズルで使用中';
        name.append(tag);
      }

      const detail = document.createElement('p');
      detail.className = 'blk-detail';
      detail.textContent = INFO[ab.id].text;

      // このサイズの盤で使える位置
      const where = document.createElement('div');
      where.className = 'blk-where';
      const map = document.createElement('div');
      map.className = 'blk-map';
      map.style.gridTemplateColumns = `repeat(${W}, 8px)`;
      let on = 0;
      for (let i = 0; i < SIZE; i++) {
        const cell = document.createElement('i');
        if (cyclesOf(k, xOf(i), yOf(i))) { cell.className = 'on'; on++; }
        map.append(cell);
      }
      const note = document.createElement('span');
      note.textContent = `使える位置 ${on} / ${SIZE}`;
      map.setAttribute('role', 'img');
      map.setAttribute('aria-label', `${W}×${H} の盤で使える位置は ${on} マス`);
      where.append(map, note);

      main.append(name, detail, where);
      row.append(chip, main);
      list.append(row);
    }
    sec.append(h, list);
    body.append(sec);
  }
}

// ---- 置換の適用（FLIP アニメーション付き） ----
function applyTo(b, cycles, dir = 1) {
  for (const cyc of cycles) {
    if (dir > 0) {
      const last = b[cyc[cyc.length - 1]];
      for (let k = cyc.length - 1; k > 0; k--) b[cyc[k]] = b[cyc[k - 1]];
      b[cyc[0]] = last;
    } else {
      const first = b[cyc[0]];
      for (let k = 0; k < cyc.length - 1; k++) b[cyc[k]] = b[cyc[k + 1]];
      b[cyc[cyc.length - 1]] = first;
    }
  }
}

// 盤面を書き換えて、動いたタイルだけを滑らせる。
//
// 滑る時間は呼び出し側から指定する。ms に 0 を渡すと滑らせずに置き換える。
// 置換をスライドで見せる以上、途中はタイルが敷き詰まらず下のマスが覗く。
// 1 手ずつなら動く数も距離も小さいので気にならないが、自動再生で何十手も
// まとめて動かすと画面じゅうに隙間が出る。そこは滑らせない方が静かで速い。
function animatePlacement(mutate, ms = 300) {
  // 前の手のアニメーションが残っていると変形後の座標を測ってしまい、
  // 動いていないタイルにも差分が出て震える。測る前に必ず打ち切る。
  for (const t of tiles) for (const a of t.getAnimations()) a.cancel();

  if (!ms) {                      // 滑らせずに置き換える
    mutate();
    placeTiles();
    markUsable();
    return;
  }

  const before = new Map();
  for (const t of tiles) before.set(t, t.getBoundingClientRect());

  mutate();
  placeTiles();
  markUsable();

  for (const t of tiles) {
    const a = before.get(t);
    const b = t.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (!dx && !dy) continue;
    t.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration: ms, easing: 'cubic-bezier(.2,.75,.3,1)' }
    );
  }
}

const applyAnimated = (cycles, dir = 1) => animatePlacement(() => applyTo(board, cycles, dir));

// 発動したマスを光らせる。スロットは動かないのでクラスで問題ない。
function flashSlot(i, dir = 1) {
  slots[i].classList.remove('fired', 'back');
  void slots[i].offsetWidth; // アニメーション再生のための reflow
  slots[i].classList.add('fired');
  if (dir < 0) slots[i].classList.add('back');
}

// 使えないマスを揺らす。クラスを付けっぱなしにすると、あとでタイルが
// 動くたびにノード再挿入でアニメーションが再生されてしまうため、
// クラスではなくアニメーション API を使って痕跡を残さない。
function shakeTile(i) {
  const t = tiles[board[i]];
  for (const a of t.getAnimations()) a.cancel();
  t.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' },
     { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
    { duration: 300, easing: 'ease' }
  );
}

// ---- 手数 ----
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a / gcd(a, b)) * b;

// 置換の位数（何回繰り返すと元に戻るか）= 各サイクル長の最小公倍数
const orderOf = (cycles) => cycles.reduce((a, c) => lcm(a, c.length), 1);

// 連続押しのまとまりを確定して手数に加える。
// d は向きこみの累計（押すたび +1、長押しは -1）。位数で丸めて、近い側を手数とする。
function commitRun() {
  if (run.d !== 0) {
    const r = ((run.d % run.order) + run.order) % run.order;
    moves += Math.min(r, run.order - r);
  }
  run = { i: -1, d: 0, order: 1 };
}

// ---- 解答例 ----
// プレイヤーが 1 手打ったぶんを手順に反映する。
// 手順の先頭と同じマスなら 1 回ぶん消化、違うマスなら打ち消す手順を先頭に足す。
// これで「先頭から順に押せば解ける」という性質が常に保たれる。
// runs[k].n は「そのマスをあと何回“順方向に”進めればよいか」。
// 長押し（dir = -1）は逆向きに 1 つ進めたことになるので、残りは 1 増える。
function advanceRuns(runs, i, dir, order) {
  const wrap = (v) => ((v % order) + order) % order;
  const first = runs[0];
  if (first && first.i === i) {
    first.n = wrap(first.n - dir);
    if (first.n === 0) runs.shift();
  } else {
    runs.unshift({ i, n: wrap(-dir), order });
  }
}

// ---- 探索による手順（solver.js） ----
// 解法は solver.js の純粋な関数。通常は Web Worker の中で動かし、画面を止めない。
// Worker が作れない環境では同じ関数をメインスレッドで短い予算で呼ぶ。
// 見つかれば最短、無理なら短くした一例。使えないときは逆手順のまま。
const Solver = solverModule();

// 盤面ごとの「問題の記述」。能力 × マスのサイクルと位数を先に引いておく。
function buildProblem() {
  const cyc = [], ord = [];
  for (let a = 0; a < ABILITIES.length; a++) {
    const per = Array.from({ length: SIZE }, (_, i) => cyclesOf(a, xOf(i), yOf(i)));
    cyc.push(per);
    ord.push(per.map((c) => (c ? orderOf(c) : 0)));
  }
  return { W, H, N: W, SIZE, cyc, ord };
}

let problem = null;
let hintPlan = null;    // { runs, optimal, ms, method }
let hintBusy = false;
let solveId = 0;        // 進行中の依頼の番号。盤面が変わったら古い返事を捨てる
let solveDones = [];    // 返事が来たら呼ぶもの
let movesWhileSolving = []; // 計算中に打った手。返ってきた手順に追いつかせる
let solveStart = null;      // 依頼したときの並び。返ってきた手順はここから始まる
let longSolveTried = false; // 逆手順に落ちた盤で、裏での長い探し直しをもう試したか

// Worker の中で長めに探索する。同期で動かすときは画面が固まるので短くする。
// 大きい盤や色数の多い盤は難しいので、Worker では時間を足す（最大 7 秒）。
const HINT_BUDGET_SYNC = 1200;
const hintBudgetWorker = () => 3000 + (SIZE >= 49 ? 2500 : 0) + (types >= 6 ? 1500 : 0);
// 逆手順しか出せなかった盤だけ、裏でこの時間まで探し直す。
// 難しい盤は、終盤で確定マスを崩して直す手順にたどり着くまでに時間が要る。
// 実測では、行き詰まっていた 4 盤が 45 秒で 2 盤、60 秒で 4 盤とも解けた
// （1 万手超の逆手順が 275〜450 手になる）。ふつうの盤はここまで来ないので、
// この時間を使うのは行き詰まった盤だけ。途中経過は届くので、よりよい手順が
// 見つかった時点で差し替わる。
const HINT_BUDGET_LONG = 60000;

let worker = null;
let workerBroken = false;   // この環境では Worker が使えないと分かったら、もう試さない

function makeWorker() {
  if (worker) { worker.terminate(); worker = null; }
  if (workerBroken) return;
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return;
  try {
    const src = `${solverModule.toString()}\n${solverWorkerMain.toString()}\nsolverWorkerMain();`;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = (e) => finishSolve(e.data.id, e.data.res, !!e.data.partial);
    worker.onerror = () => { worker = null; workerBroken = true; fallbackToSync(); };
  } catch (e) {
    worker = null;
    workerBroken = true;
  }
}

// Worker が使えなくなったときに、待っている依頼を同期で片付ける。
// そのままだと待ち手が誰にも応えられず、ヒントも「揃える」も無反応になる。
function fallbackToSync() {
  if (!hintBusy) return;
  hintBusy = false;
  const pending = solveDones;
  solveDones = [];
  if (!pending.length) return;
  const first = pending.shift();
  solveDones = pending;
  requestSolve(first.f, first.final);
}

function solveSnapshot() {
  return {
    start: Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[board[i]]),
    goal: Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[i]),
    fallback: Solver.runsToPlan(solution),
  };
}

// 返事を受け取る。途中経過（partial）なら手順だけ差し替えて、計算は続いているものとして扱う。
// 手順が本当に目標へ着くかを確かめる。
// ソルバーは盤の形を正方形として見積もる部分があり、長方形では
// 見当違いの手順を返しうる。着かないものは黙って捨てて保険に任せる。
function planReachesGoal(plan, startLay) {
  const lay = Uint8Array.from(startLay);
  for (const [i, dir] of plan) {
    const cyc = problem.cyc[lay[i]][i];
    if (!cyc) return false;
    applyTo(lay, cyc, dir);
  }
  for (let i = 0; i < SIZE; i++) if (lay[i] !== tileAbility[i]) return false;
  return true;
}

function finishSolve(id, res, partial = false) {
  if (id !== solveId) return; // 盤面が変わった後の返事
  if (res && res.plan && !planReachesGoal(res.plan, solveStart)) res = null;
  if (res && res.plan) {
    const plan = { runs: Solver.planToRuns(problem, res.plan, solveStart), optimal: res.optimal, ms: Math.round(res.ms), method: res.method };
    // 計算しているあいだに打った手ぶんだけ手順を進める
    for (const [i, dir, order] of movesWhileSolving) followPlan(plan, i, dir, order);
    if (!hintPlan || planCost(plan.runs) <= planCost(hintPlan.runs) || !partial) hintPlan = plan;
  }
  if (!partial) {
    hintBusy = false;
    movesWhileSolving = [];
    // 逆手順しか出せなかった盤は、そのままだと 1 万手を超える使えないヒントになる。
    // いま出ている手順でも遊べるので、裏でもっと長く探し直す。途中でよりよい手順が
    // 見つかれば差し替わる（見つからなければ、いまの手順のまま）。1 盤につき 1 回だけ。
    if (res && res.method === 'reverse' && !longSolveTried && worker) {
      longSolveTried = true;
      requestSolve(null, false, true, HINT_BUDGET_LONG);
    }
  }
  // 待っている人には最初の返事で応える（ヒントの点滅には十分）。最終結果を待つものは残す。
  const dones = solveDones;
  solveDones = partial ? dones.filter((d) => d.final) : [];
  for (const d of dones) if (!partial || !d.final) d.f();
}

// done は最初の返事（途中経過でもよい）で呼ぶ。final を付けると最終結果まで待つ。
function requestSolve(done, final = false, background = false, budget = 0) {
  if (done) solveDones.push({ f: done, final });
  if (hintBusy) return;
  // Worker が無い環境では同期で解くことになる。先読みのためだけに
  // 盤面を出すたび画面を止めるのは割に合わないので、そのときは見送る。
  if (background && !worker) return;
  hintBusy = true;
  const id = ++solveId;
  movesWhileSolving = [];
  const snap = solveSnapshot();
  solveStart = snap.start;
  if (worker) {
    worker.postMessage({ type: 'solve', id, start: snap.start, goal: snap.goal, budget: budget || hintBudgetWorker(), fallback: snap.fallback });
    // 返事が来ないまま黙り込む環境（file:// で Blob の Worker が止められる等）への保険
    setTimeout(() => {
      if (!hintBusy || solveId !== id) return;
      if (worker) { worker.terminate(); worker = null; }
      workerBroken = true;
      fallbackToSync();
    }, hintBudgetWorker() + 2000);
  } else {
    // 同期処理なので、呼び出し側が先に画面を描けるよう一拍ずらす
    setTimeout(() => finishSolve(id, Solver.solvePuzzle(problem, snap.start, snap.goal, HINT_BUDGET_SYNC, snap.fallback)), 16);
  }
}

// 手順の持ち主（hintPlan）に 1 手を反映する。手順どおりでなければ「最短」の看板を下ろす。
function followPlan(plan, i, dir, order) {
  const before = planCost(plan.runs);
  advanceRuns(plan.runs, i, dir, order);
  if (planCost(plan.runs) >= before) plan.optimal = false;
}

const activeRuns = () => (hintPlan ? hintPlan.runs : solution);

// 手順の長さは「まとまりの数」ではなく手数で数える。
// 1 つのまとまりは押す向きを選べるので、少ない側の回数がその手数になる。
const planCost = (runs) => runs.reduce((a, r) => a + Math.min(r.n, r.order - r.n), 0);

// ---- 操作 ----
// dir: +1 = 押す（順方向） / -1 = 長押し（逆方向）
// 1 手ぶんの状態更新だけを行う。描画と音は呼び出し側でまとめる。
// 自動再生では何手かをひとまとめに動かすので、ここを分けておく。
function applyMoveState(i, dir) {
  const cycles = cyclesAt(i);
  if (!cycles) return false;
  // 押したマスが変わったら、それまでの連続押しを確定する
  if (i !== run.i) {
    commitRun();
    run = { i, d: 0, order: orderOf(cycles) };
  }
  run.d += dir;

  advanceRuns(solution, i, dir, run.order);
  if (hintPlan) followPlan(hintPlan, i, dir, run.order);
  if (hintBusy) movesWhileSolving.push([i, dir, run.order]);

  applyTo(board, cycles, dir);
  return true;
}

function fire(i, dir = 1) {
  if (locked) return;
  if (!cyclesAt(i)) {
    shakeTile(i);
    Sfx.blocked();
    logEl.textContent = isBlank(abilityAt(i))
      ? 'このマスには能力がない。まわりのマスから動かすしかない'
      : '盤の外に出てしまうので、この位置では使えない';
    return;
  }
  const ab = abilityAt(i);   // 使ったタイルは動かないので、前後で変わらない
  animatePlacement(() => applyMoveState(i, dir));
  flashSlot(i, dir);
  Sfx.move(ab, dir);
  logEl.textContent = ABILITIES[ab].name + (dir < 0 ? '（逆回り）' : '');
  clearHint(); // 示した手はもう古いので消す
  if (isSolved()) showClear();
}


// 完成の知らせ。盤面を隠さないよう、全画面では出さない。
function showClear() {
  commitRun();
  Sfx.solved();
  locked = true;
  stopAutoSolve();
  clearHint();

  gridEl.classList.remove('cleared');
  void gridEl.offsetWidth; // アニメーション再生のための reflow
  gridEl.classList.add('cleared');

  logEl.classList.add('done');
  logEl.textContent = autoSolvedFlag
    ? 'そろった！（自動で揃えました） — 設定から次の盤面を作れます'
    : `そろった！ ${moves} 手 — 設定から次の盤面を作れます`;
}

// ---- 解説（自動で揃える） ----
// 手順どおりに 1 手ずつ押していく。1 手ごとに手順を読み直すので、
// 途中で解き直しが入っても破綻しない。
// 勝手に進むだけでなく、止めて 1 手ずつ進める・戻すこともできる。
let autoSolving = false;   // 解説を開いているか
let autoPlaying = false;   // そのうち、勝手に進んでいるか
let autoStep = null;        // 始めるときに決めた進め方 { interval, chunk }
let autoSolvedFlag = false;
let autoTimer = null;
const autoHist = [];        // 解説のあいだに進めた手。戻すときに逆から取り出す
let autoMoves0 = 0;         // 解説を開いたときの手数。全部戻したらここへ返す

// 1 手ずつ見せられる上限。これを超える手順は一気に揃える。
// 混ぜ切った大きい盤では、保険の手順が数千〜数万手になることがあるため。
// どの盤面でも順に揃える。ただし保険の手順は 1 万手を超えることがあるので、
// 1 手ずつ止まっていると終わらない。飛ばさずに、長いほど 1 回で多く進めて速くする。
// 目安としてだいたいこの時間で終わる。
const AUTO_TOTAL_MS = 18000;

// ペースは始めるときに一度だけ決める。毎回の残りから決め直すと、
// 終盤が 1 手ずつの遅い進みになって全体が何倍にも延びる。
function autoPace(total) {
  const interval = total <= 60 ? 340 : 120;
  const ticks = Math.max(1, Math.round(AUTO_TOTAL_MS / interval));
  return { interval, chunk: Math.max(1, Math.ceil(total / ticks)) };
}

const confirmEl = document.getElementById('confirmOverlay');
const confirmTitleEl = document.getElementById('confirmTitle');
const confirmTextEl = document.getElementById('confirmText');
const confirmYesEl = document.getElementById('confirmYes');
let confirmAction = null;   // 「はい」を押したときにすること

// 確認画面はひとつを使い回す。見出し・本文・決定ボタンの文言を差し替える。
function askConfirm(title, text, yesLabel, action) {
  confirmTitleEl.textContent = title;
  confirmTextEl.innerHTML = text;
  confirmYesEl.textContent = yesLabel;
  confirmAction = action;
  confirmEl.hidden = false;
  document.getElementById('confirmNo').focus();
}

function closeConfirm() {
  confirmEl.hidden = true;
  confirmAction = null;
}
const autoBarEl = document.getElementById('autoBar');
const autoTextEl = document.getElementById('autoText');
const autoBackEl = document.getElementById('autoBack');
const autoPlayEl = document.getElementById('autoPlay');
const autoNextEl = document.getElementById('autoNext');

function askAutoSolve() {
  if (autoSolving || locked) return;
  askConfirm('解説を見る',
    '目標の柄まで盤面が動きます。止めて <strong>1 手ずつ進める・戻す</strong> こともできます。'
    + '<br>この盤面は自分で解けなくなります。',
    '見る', startAutoSolve);
}

// 盤面を作り直す。サイズとブロック数の設定は据え置きで、
// 使うブロックの組み合わせも目標の柄も引き直す。
// 揃えたあとに次へ進む手段でもあるので、完成していても押せる。
function askRegenerate() {
  if (autoSolving) return;
  askConfirm('新しい盤面を作る',
    'サイズとブロック数はそのままで、'
    + '<strong>使うブロックも目標の柄も</strong>選び直します。<br>今の盤面は元に戻せません。',
    '作る', () => { closeConfirm(); newPuzzle(); });
}

function startAutoSolve() {
  closeConfirm();
  if (autoSolving || locked) return;
  // 手順の計算が終わるまで入力を受けないよう、先に解説モードに入る
  autoSolving = true;
  autoPlaying = false;
  autoHist.length = 0;
  autoMoves0 = moves;
  autoBarEl.hidden = false;
  autoBarEl.classList.add('paused');
  autoBackEl.disabled = true;
  autoNextEl.disabled = true;
  autoPlayEl.disabled = true;
  autoTextEl.textContent = '手順を計算しています…';
  requestSolve(() => {
    if (!autoSolving) return;              // 計算中に「やめる」を押した
    if (locked || isSolved()) { stopAutoSolve(); return; }
    // 手順がまったく無いときだけは、そのまま完成形へ動かす
    if (!activeRuns().length) { stopAutoSolve(); autoSolvedFlag = true; snapToGoal(); return; }
    autoStep = autoPace(planCost(activeRuns()));
    autoPlayEl.disabled = false;
    playAuto();
  }, true);
}

// 手順どおりに count 手すすめる。戻せるように、進めた手は控えておく。
function advanceAuto(count, slide) {
  let last = null;
  animatePlacement(() => {
    for (let c = 0; c < count; c++) {
      const runs = activeRuns();
      if (!runs.length) break;
      const r = runs[0];
      // 順方向に n 回進めるか、逆方向に (位数 - n) 回進めるか、少ない側を選ぶ
      const dir = r.n <= r.order - r.n ? 1 : -1;
      const ab = abilityAt(r.i);
      if (!applyMoveState(r.i, dir)) break;
      autoHist.push([r.i, dir]);
      last = { i: r.i, dir, ab };
    }
  }, slide);
  if (last) {
    flashSlot(last.i, last.dir);
    Sfx.move(last.ab, last.dir);      // 音は 1 回ぶんだけ
    autoSolvedFlag = true;
  }
  return last;
}

// 解説のあいだに進めた手を 1 つ取り消す。押した手はいつでも逆に打てるので、
// 逆向きに打ち直すだけでよい（手数も差し引きで元に戻る）。
function undoAuto() {
  if (!autoSolving || !autoHist.length) return;
  pauseAuto();
  const [i, dir] = autoHist.pop();
  const ab = abilityAt(i);            // 押したマスは動かないので前後で変わらない
  animatePlacement(() => applyMoveState(i, -dir), 300);
  flashSlot(i, -dir);
  Sfx.move(ab, -dir);
  if (!autoHist.length) {
    // 解説を開く前と同じ盤面に戻った。手数もそこへ返す。
    // （手数は「同じマスを続けて押したぶん」を差し引いて数えるので、
    //   進めて戻すと往復ぶんが残ってしまう。解説の操作は player の手数ではない。）
    autoSolvedFlag = false;
    commitRun();
    moves = autoMoves0;
    run = { i: -1, d: 0, order: 1 };
  }
  markAuto();
}

// 1 手だけ進める
function nextAuto() {
  if (!autoSolving || locked || isSolved()) return;
  pauseAuto();
  advanceAuto(1, 300);
  if (isSolved()) { showClear(); return; }
  markAuto();
}

function playAuto() {
  if (!autoSolving || locked || isSolved()) return;
  autoPlaying = true;
  markAuto();
  stepAuto();
}

function pauseAuto() {
  autoPlaying = false;
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  markAuto();
}

const toggleAuto = () => (autoPlaying ? pauseAuto() : playAuto());

// ボタンの出方と案内の文字を、今の状態に合わせる
function markAuto() {
  if (!autoSolving) return;
  autoBarEl.classList.toggle('paused', !autoPlaying);
  autoPlayEl.setAttribute('aria-label', autoPlaying ? '一時停止' : '再生');
  autoPlayEl.title = autoPlaying ? '一時停止' : '再生';
  autoBackEl.disabled = !autoHist.length;
  autoNextEl.disabled = locked || isSolved() || !activeRuns().length;
  const left = planCost(activeRuns());
  autoTextEl.textContent = autoPlaying
    ? `揃えています… 残り ${left} 手`
    : `止まっています — 残り ${left} 手`;
}

function stepAuto() {
  autoTimer = null;
  if (!autoSolving || !autoPlaying) return;
  if (locked || isSolved() || !activeRuns().length) { stopAutoSolve(); return; }

  if (!autoStep) autoStep = autoPace(planCost(activeRuns()));
  const { interval, chunk } = autoStep;

  // まとめて進めるぶんも 1 回の滑らかな移動として見せる。
  // 手順の順番どおりに進むので、揃っていく過程はそのまま見える。
  // 追える大きさのときだけ滑らせる。次の刻みが来る前に必ず到着させる。
  // まとめて動かすときは滑らせない（途中の隙間が目立つうえ、追えもしない）。
  advanceAuto(chunk, chunk <= 3 ? Math.min(300, Math.round(interval * 0.75)) : 0);
  if (isSolved()) { showClear(); return; }
  markAuto();
  autoTimer = setTimeout(stepAuto, interval);
}

// 完成形へ直接動かす。タイルが元の位置に戻る配置は必ず目標の柄になる。
function snapToGoal() {
  animatePlacement(() => { board = Array.from({ length: SIZE }, (_, i) => i); });
  showClear();
}

function stopAutoSolve() {
  autoSolving = false;
  autoPlaying = false;
  autoStep = null;
  autoHist.length = 0;
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  autoBarEl.hidden = true;
}

// 新しい盤面が出るときの入り。transform を使うが、手を打てば
// applyAnimated が既存のアニメーションを打ち切るので FLIP とは衝突しない。
function dealIn() {
  const still = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) return;
  for (let i = 0; i < SIZE; i++) {
    tiles[board[i]].animate(
      [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }],
      { duration: 300, delay: (xOf(i) + yOf(i)) * 20, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }
    );
  }
}

// ---- 混ぜ方 ----
// 盤面ごとに (能力, マス) の手を先に引いておく。混ぜるときに何度も使う。
function buildMoveTable() {
  const cyc = [];
  const cnt = [];
  for (let a = 0; a < ABILITIES.length; a++) {
    const per = Array.from({ length: SIZE }, (_, i) => cyclesOf(a, xOf(i), yOf(i)));
    cyc.push(per);
    // 位数 2 の手は順逆が同じ結果になるので 1 通りと数える
    cnt.push(per.map((c) => (c ? (orderOf(c) === 2 ? 1 : 2) : 0)));
  }
  return { cyc, cnt };
}

// その盤面で打てる手の総数（向きこみ）
function degreeOf(b, tbl) {
  let d = 0;
  for (let i = 0; i < SIZE; i++) d += tbl.cnt[tileAbility[b[i]]][i];
  return d;
}

// 打てる手を通し番号で取り出す
function nthMove(b, tbl, d) {
  for (let i = 0; i < SIZE; i++) {
    const c = tbl.cnt[tileAbility[b[i]]][i];
    if (d < c) return [i, c === 1 || d === 0 ? 1 : -1];
    d -= c;
  }
  return null;
}

// 完成状態から混ぜる。
//
// 「打てる手から等確率で 1 つ」だけだと、打てる手が多い盤面ほど居座りやすくなり、
// いくら混ぜても一様分布にならない（厳密に計算すると全変動距離 0.06〜0.07 の偏りが残る）。
// そこで Metropolis 補正を入れる。次数の比で採択すれば詳細釣り合いが成り立ち、
// 定常分布はちょうど一様＝エントロピー最大になる。
function mixBoard(b, tbl, steps, rng, rec) {
  let deg = degreeOf(b, tbl);
  // どのマスも押せない組み合わせ（能力なしが多い盤など）。混ざらないので何もしない。
  // 呼び出し側は「混ぜたのに完成のまま」を見て引き直す。
  if (!deg) return;
  for (let t = 0; t < steps; t++) {
    const [i, dir] = nthMove(b, tbl, Math.floor(rng() * deg));
    const cyc = tbl.cyc[tileAbility[b[i]]][i];
    applyTo(b, cyc, dir);
    const next = degreeOf(b, tbl);
    if (rng() < Math.min(1, deg / next)) { deg = next; rec.push([i, dir]); }
    else applyTo(b, cyc, -dir);   // 棄却したので戻す
  }
}

// 1 手ずつの並びを「このマスを n 回押す」という形にまとめる。
// 位数はその時点の盤面で決まるので、順に進めながら求める。
function movesToRuns(mvs, startBoard, tbl) {
  const b = Uint8Array.from(startBoard);
  const runs = [];
  for (const [i, dir] of mvs) {
    const cyc = tbl.cyc[tileAbility[b[i]]][i];
    const order = orderOf(cyc);
    const last = runs[runs.length - 1];
    if (last && last.i === i) {
      last.n = (((last.n + (dir > 0 ? 1 : order - 1)) % order) + order) % order;
      if (last.n === 0) runs.pop();
    } else {
      runs.push({ i, n: dir > 0 ? 1 : order - 1, order });
    }
    applyTo(b, cyc, dir);
  }
  return runs;
}

// 混ぜた道筋から、同じ盤面に戻った区間を取り除く。
// 混ぜた手数そのままだと保険の手順が長すぎるため。
// 切り詰めたときは捨てた区間の記録も消す。残すと、あとでその盤面に戻ったときに
// 配列を穴あきのまま伸ばしてしまう。
function removeLoops(path, tbl) {
  const lay = Uint8Array.from({ length: SIZE }, (_, i) => tileAbility[i]);
  const layKey = () => String.fromCharCode.apply(null, lay);
  const keyAt = [layKey()];
  const seen = new Map([[keyAt[0], 0]]);
  const out = [];
  for (const mv of path) {
    applyTo(lay, tbl.cyc[lay[mv[0]]][mv[0]], mv[1]);
    out.push(mv);
    const k = layKey();
    const prev = seen.get(k);
    if (prev !== undefined) {
      for (let j = prev + 1; j < out.length; j++) seen.delete(keyAt[j]);
      out.length = prev;
      keyAt.length = prev + 1;
    } else {
      seen.set(k, out.length);
      keyAt[out.length] = k;
    }
  }
  return out;
}

// ---- 生成 ----
function newPuzzle(useSeed) {
  seed = Number.isFinite(useSeed) ? useSeed : Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seed);
  const K = Math.min(forcedAbilities ? forcedAbilities.length : types, SIZE, ABILITIES.length);
  let steps = scrambleSteps();

  patternSeed = Math.floor(rng() * 1e9);   // 種つきの柄を盤面ごとに変える
  const cands = candidatePatterns(W, H, K);

  for (let attempt = 0; ; attempt++) {
    const pat = cands[Math.floor(rng() * cands.length)];

    // 使うブロックを K 種類選ぶ。カスタムで指定があればそれを使う。
    // ただし指定した組ではどの柄も崩せないことがありうるので、
    // 一定回数を超えたらランダム選びに戻して必ず終わらせる。
    let picked;
    if (forcedAbilities && attempt < 200) {
      picked = [...forcedAbilities];
      for (let k = picked.length - 1; k > 0; k--) {
        const j = Math.floor(rng() * (k + 1));
        [picked[k], picked[j]] = [picked[j], picked[k]];
      }
    } else {
      // 「何も起きない」は柄の一色ぶん、つまり盤の 1/K を占める。色数が少ないと
      // 盤の半分近くが動かないマスになり、打てる手が数えるほどしか残らない。
      // ランダムに選ぶときは色数が 4 以上のときだけ混ぜる（カスタムでの指定は尊重する）。
      const pool = ABILITIES.map((_, k) => k)
        .filter((k) => K >= 4 || !isBlank(k));
      for (let k = pool.length - 1; k > 0; k--) {
        const j = Math.floor(rng() * (k + 1));
        [pool[k], pool[j]] = [pool[j], pool[k]];
      }
      picked = pool.slice(0, K);
    }

    // 柄を目標配置にする。タイル v の能力 = 完成時にマス v に来る色。
    tileAbility = Array.from({ length: SIZE }, (_, i) => picked[pat.fn(xOf(i), yOf(i), W, H, K)]);

    // 完成状態から混ぜる → 必ず解ける。Metropolis 補正なので定常分布は一様。
    const tbl = buildMoveTable();
    board = Array.from({ length: SIZE }, (_, i) => i);
    const path = [];
    mixBoard(board, tbl, steps, rng, path);

    // 混ぜた結果がたまたま完成形なら引き直す
    // （到達できる状態が極端に少ない組み合わせでは起こりうる）
    if (!isSolved()) {
      // 保険の手順は、混ぜた道筋を逆にたどったもの
      const trimmed = removeLoops(path, tbl);
      const back = [];
      for (let k = trimmed.length - 1; k >= 0; k--) back.push([trimmed[k][0], -trimmed[k][1]]);
      solution = movesToRuns(back, board, tbl);
      break;
    }
    if (attempt > 40) steps += SIZE; // まず起きないが、念のため深くして抜ける
  }

  stopAutoSolve();
  autoSolvedFlag = false;
  closeConfirm();
  gridEl.classList.remove('cleared');
  logEl.classList.remove('done');
  moves = 0;
  run = { i: -1, d: 0, order: 1 };
  hintPlan = null;
  longSolveTried = false;
  locked = false;

  // 解法の準備。計算中の Worker は捨てて作り直す（古い盤面の計算を待たないため）
  problem = buildProblem();
  solveId++;
  hintBusy = false;
  solveDones = [];
  movesWhileSolving = [];
  makeWorker();
  if (worker) worker.postMessage({ type: 'init', problem });

  paintTiles();
  renderGoal();
  renderLegend();
  renderPanel();
  placeTiles();
  markUsable();
  clearHint();
  dealIn();
  seedOutEl.textContent = String(seed);
  document.getElementById('seedIn').value = String(seed);
  logEl.textContent = 'タイルをクリック';

  // 先に裏で解いておく。ヒントを押したときに待たせないため。
  requestSolve(null, false, true);
}


// ---- 配線 ----
// 押す = 順方向、長押し（または右クリック）= 逆方向。
// 位数 2 の入れ替えは順逆が同じ結果になるので、実質は回転のブロック向け。
//
// 注意: タッチ端末では、自前の長押しタイマーとは別にブラウザ自身も長押しで
// contextmenu を出す。どちらが先に来ても 1 回しか発動しないよう、
// 「この押下ではもう発動した」という印を 1 つだけ持って両方で見る。
const LONG_PRESS_MS = 400;
let pressCell = -1;
let pressTimer = null;
let pressHandled = true;

function endPress() {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
}

// この押下でまだ発動していなければ 1 回だけ発動する
function firePress(i, dir) {
  if (pressHandled || i < 0) return;
  pressHandled = true;
  endPress();
  fire(i, dir);
}

gridEl.addEventListener('pointerdown', (e) => {
  if (autoSolving) return;
  const slot = e.target.closest('.slot');
  if (!slot) return;
  endPress();
  pressCell = Number(slot.dataset.i);
  pressHandled = false;              // ここから 1 回だけ発動できる
  if (e.button !== 0) return;        // 右クリックは contextmenu 側で扱う
  pressTimer = setTimeout(() => {
    pressTimer = null;
    firePress(pressCell, -1);        // 長押し = 逆方向
  }, LONG_PRESS_MS);
});

gridEl.addEventListener('pointerup', () => {
  if (autoSolving) return;
  endPress();
  firePress(pressCell, 1);           // 短く離した = 順方向
});

// 指やカーソルが外れたら、この押下では何も発動させない
const abortPress = () => { endPress(); pressHandled = true; };
gridEl.addEventListener('pointercancel', abortPress);
gridEl.addEventListener('pointerleave', abortPress);

gridEl.addEventListener('contextmenu', (e) => {
  const slot = e.target.closest('.slot');
  if (!slot) return;
  e.preventDefault();                // 長押しのメニューは常に抑止する
  if (autoSolving) return;
  // 右クリックでも長押しでも、contextmenu の前に必ず pointerdown が来る。
  // ここで押下の有無に関わらず発動できるようにすると、
  // 「押したまま外へ出たら発動しない」という保証が壊れるので、印に従うだけにする。
  firePress(pressCell, -1);
});

document.getElementById('hintBtn').addEventListener('click', showHint);

// ---- パネルのタブ ----
// ブロックの一覧が長いので、ルール・ブロック・設定は積まずに切り替える。
const panelTabsEl = document.getElementById('panelTabs');
const TABS = [
  { key: 'rule', label: 'ルール', sec: 'secRule' },
  { key: 'block', label: 'ブロック', sec: 'secBlock' },
  { key: 'config', label: '設定', sec: 'secConfig' },
];
let panelTab = TABS[0].key;

for (const t of TABS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = `tab${t.key[0].toUpperCase()}${t.key.slice(1)}`;
  b.dataset.v = t.key;
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-controls', t.sec);
  b.textContent = t.label;
  panelTabsEl.append(b);
}

function setPanelTab(key, focus = false) {
  if (!TABS.some((t) => t.key === key)) return;
  panelTab = key;
  for (const b of panelTabsEl.querySelectorAll('button')) {
    const on = b.dataset.v === key;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  }
  for (const t of TABS) document.getElementById(t.sec).hidden = t.key !== key;
  document.getElementById('panel').scrollTop = 0;   // 前のタブの読みかけ位置を持ち越さない
}

setPanelTab(panelTab);

panelTabsEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) setPanelTab(b.dataset.v);
});
// タブは左右キーで移れるのが決まりごと
panelTabsEl.addEventListener('keydown', (e) => {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const at = TABS.findIndex((t) => t.key === panelTab);
  setPanelTab(TABS[(at + step + TABS.length) % TABS.length].key, true);
});

// ---- 絵柄の選び ----
// 盤のサイズやブロック数と違い、これは見た目だけの設定なので
// 「作成」を待たずにその場で切り替える。選んだものは次回も覚えている。
const glyphSegEl = document.getElementById('glyphSeg');
// 見本には回転を使う。描き方ごとの差がいちばん大きく出る。
const GLYPH_SAMPLE = ABILITIES.findIndex((ab) => ab.id === 'crossCW');

function fillGlyphSeg() {
  glyphSegEl.replaceChildren();
  for (const st of Glyphs.STYLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = st.id;
    b.title = st.note;
    const box = document.createElement('span');
    box.className = 'sample';
    box.style.background = bgOf(GLYPH_SAMPLE);
    box.style.color = INK;
    box.innerHTML = Glyphs.draw(st.id, ABILITIES[GLYPH_SAMPLE].cells(0, 0), bgOf(GLYPH_SAMPLE));
    const name = document.createElement('span');
    name.textContent = st.name;
    b.append(box, name);
    glyphSegEl.append(b);
  }
}

// 「絵柄の読み方」は描き方ごとに変わる。選んでいるものの説明に差し替える。
function renderGlyphLegend() {
  const ul = document.getElementById('glyphLegend');
  ul.replaceChildren();
  for (const line of Glyphs.byId(glyphStyle).legend) {
    const li = document.createElement('li');
    li.innerHTML = line;
    ul.append(li);
  }
}

function markGlyphSeg() {
  for (const b of glyphSegEl.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.v === glyphStyle));
  }
}

// 絵柄が出てくるところを全部描き直す。盤面そのものは触らない。
function setGlyphStyle(id) {
  if (!Glyphs.has(id) || id === glyphStyle) return;
  glyphStyle = id;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(GLYPH_KEY, id); }
  catch (e) { /* 覚えられない環境でも、その場では切り替わる */ }
  paintTiles();
  renderGoal();
  renderLegend();
  renderPanel();
  fillPicker();
  refreshPicker();
  renderGlyphLegend();
  markGlyphSeg();
}

glyphSegEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) setGlyphStyle(b.dataset.v);
});

fillGlyphSeg();
markGlyphSeg();
renderGlyphLegend();

// ---- 効果音 ----
// 入切は説明パネルの設定にある。
const soundChk = document.getElementById('soundChk');

function markSound() { soundChk.checked = Sfx.enabled; }
soundChk.addEventListener('change', () => { Sfx.set(soundChk.checked); markSound(); });
markSound();


document.getElementById('solveBtn').addEventListener('click', askAutoSolve);
document.getElementById('newBtn').addEventListener('click', askRegenerate);
confirmYesEl.addEventListener('click', () => { const a = confirmAction; if (a) a(); });
document.getElementById('confirmNo').addEventListener('click', closeConfirm);
document.getElementById('autoStop').addEventListener('click', stopAutoSolve);
autoBackEl.addEventListener('click', undoAuto);
autoPlayEl.addEventListener('click', toggleAuto);
autoNextEl.addEventListener('click', nextAuto);

// ---- パネルの開閉 ----
// 設定パネルとブロック説明パネルを同じ仕組みで扱う。片方を開くともう片方は閉じる。
const backdropEl = document.getElementById('panelBackdrop');

const PANELS = {
  setup: {
    el: document.getElementById('setup'),
    btn: document.getElementById('setupBtn'),
    close: document.getElementById('setupClose'),
    label: '盤面の設定',
    onOpen: syncSetup,
  },
  panel: {
    el: document.getElementById('panel'),
    btn: document.getElementById('menuBtn'),
    close: document.getElementById('panelClose'),
    label: '遊び方と設定',
  },
};

const isOpen = (key) => PANELS[key].el.classList.contains('open');

function setPanel(key, open) {
  for (const [k, p] of Object.entries(PANELS)) {
    const on = open && k === key;
    p.el.classList.toggle('open', on);
    p.el.setAttribute('aria-hidden', String(!on));
    p.btn.setAttribute('aria-expanded', String(on));
    p.btn.setAttribute('aria-label', `${p.label}を${on ? '閉じる' : '開く'}`);
  }
  backdropEl.hidden = !open;
  document.body.classList.toggle('no-scroll', open); // 背景のスクロールを止める
  if (open) {
    PANELS[key].onOpen?.();
    PANELS[key].close.focus();
  } else {
    PANELS[key].btn.focus();
  }
}

for (const [key, p] of Object.entries(PANELS)) {
  p.btn.addEventListener('click', () => setPanel(key, !isOpen(key)));
  p.close.addEventListener('click', () => setPanel(key, false));
}
backdropEl.addEventListener('click', () => {
  for (const key of Object.keys(PANELS)) if (isOpen(key)) setPanel(key, false);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!confirmEl.hidden) { closeConfirm(); return; }
  if (autoSolving) { stopAutoSolve(); return; }
  for (const key of Object.keys(PANELS)) if (isOpen(key)) setPanel(key, false);
});

// ---- 盤面の設定 ----
// 選んだ内容はいったん保留し、「作成」を押したときだけ盤面に反映する。
// 辺は 2 つ選ぶだけ。長いほうを横にするので、盤が縦長になることはない。
// 縦長だとスマホの画面に収まらないため。
let pendA = W;
let pendB = H;
let pendW = W;
let pendH = H;
let pendTypes = types;
let pendCustom = false;
let pendPicked = new Set();   // カスタムで選んだブロック

const seedInEl = document.getElementById('seedIn');
const sizeSegEl = document.getElementById('sizeSeg');
const typeSegEl = document.getElementById('typeSeg');
const typeNoteEl = document.getElementById('typeNote');
const createBtnEl = document.getElementById('createBtn');
const customChk = document.getElementById('customChk');
const sideAEl = document.getElementById('sideA');
const sideBEl = document.getElementById('sideB');
const sizeNoteEl = document.getElementById('sizeNote');
const pickerEl = document.getElementById('blockPicker');
const pickNoteEl = document.getElementById('pickNote');

function markSeg(el, value) {
  for (const b of el.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(Number(b.dataset.v) === value));
  }
}

function fillSeg(el, values, label) {
  el.replaceChildren();
  for (const v of values) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = String(v);
    b.textContent = label(v);
    b.setAttribute('aria-pressed', 'false');
    el.append(b);
  }
}

// 選んだサイズで作れないブロック数は押せなくする
function refreshTypeSeg() {
  let unavailable = 0;
  for (const b of typeSegEl.querySelectorAll('button')) {
    const k = Number(b.dataset.v);
    const okK = typeAvailable(pendW, pendH, k);
    b.disabled = !okK;
    if (!okK) unavailable++;
  }
  // 選択中の数が使えなくなったら、使える範囲でいちばん近い数に寄せる
  if (!typeAvailable(pendW, pendH, pendTypes)) {
    const usable = TYPE_COUNTS.filter((k) => typeAvailable(pendW, pendH, k));
    pendTypes = usable.reduce((best, k) =>
      Math.abs(k - pendTypes) < Math.abs(best - pendTypes) ? k : best, usable[0]);
  }
  markSeg(typeSegEl, pendTypes);
  typeNoteEl.textContent = unavailable
    ? `${pendW}×${pendH} では、この色数で作れる柄がないものを伏せています。`
    : '';
}

// カスタムのブロック選び
function fillPicker() {
  pickerEl.replaceChildren();
  ABILITIES.forEach((ab, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = String(k);
    b.title = ab.name;
    b.setAttribute('aria-label', ab.name);
    b.style.background = bgOf(k);
    b.style.color = INK;
    b.innerHTML = iconSvg(k);
    pickerEl.append(b);
  });
}

function refreshPicker() {
  for (const b of pickerEl.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(pendPicked.has(Number(b.dataset.v))));
  }
  const n = pendPicked.size;
  const max = Math.min(ABILITIES.length, pendW * pendH);
  pickNoteEl.textContent = n < 2
    ? '2 種類以上えらんでください。'
    : n > max
      ? `${pendW}×${pendH} には ${max} 種類までしか置けません。`
      : `${n} 種類をえらんでいます。`;
}

// カスタムの表示を切り替える
function refreshCustom() {
  document.getElementById('plainSize').hidden = pendCustom;
  document.getElementById('plainTypes').hidden = pendCustom;
  document.getElementById('customSize').hidden = !pendCustom;
  document.getElementById('customBlocks').hidden = !pendCustom;
  customChk.checked = pendCustom;
  if (pendCustom) { applySides(); refreshPicker(); }
  else { markSeg(sizeSegEl, pendW); refreshTypeSeg(); }
  createBtnEl.disabled = pendCustom && !customReady();
}

const customReady = () => pendPicked.size >= 2 && pendPicked.size <= Math.min(ABILITIES.length, pendW * pendH);

// 選んだ 2 辺から盤の形を決める。長いほうが横。
function applySides() {
  pendW = Math.max(pendA, pendB);
  pendH = Math.min(pendA, pendB);
  markSeg(sideAEl, pendA);
  markSeg(sideBEl, pendB);
  sizeNoteEl.textContent = pendW === pendH
    ? `${pendW}×${pendW} の正方形になります。`
    : `長いほうが横になります。→ 横 ${pendW} × 縦 ${pendH}`;
}

// パネルを開くたびに、今の盤面の設定に合わせ直す
function syncSetup() {
  pendA = W;
  pendB = H;
  pendW = W;
  pendH = H;
  pendTypes = types;
  pendCustom = W !== H || forcedAbilities !== null;
  pendPicked = new Set(forcedAbilities || [...new Set(tileAbility)]);
  seedInEl.value = '';
  refreshCustom();
}

fillSeg(sizeSegEl, SIZES, (v) => `${v}×${v}`);
fillSeg(typeSegEl, TYPE_COUNTS, (v) => `${v} 種`);
fillSeg(sideAEl, SIZES, (v) => String(v));
fillSeg(sideBEl, SIZES, (v) => String(v));
fillPicker();

sizeSegEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  pendA = pendB = pendW = pendH = Number(b.dataset.v);
  markSeg(sizeSegEl, pendW);
  refreshTypeSeg();
});
typeSegEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  pendTypes = Number(b.dataset.v);
  markSeg(typeSegEl, pendTypes);
});
for (const [el, set] of [[sideAEl, (v) => { pendA = v; }], [sideBEl, (v) => { pendB = v; }]]) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    set(Number(b.dataset.v));
    refreshCustom();
  });
}
pickerEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const k = Number(b.dataset.v);
  if (pendPicked.has(k)) pendPicked.delete(k); else pendPicked.add(k);
  refreshPicker();
  createBtnEl.disabled = !customReady();
});
customChk.addEventListener('change', () => { pendCustom = customChk.checked; refreshCustom(); });

createBtnEl.addEventListener('click', () => {
  if (pendCustom && !customReady()) return;
  if (pendW !== W || pendH !== H) {
    W = pendW;
    H = pendH;
    SIZE = W * H;
    buildDom();
  }
  if (pendCustom) {
    forcedAbilities = [...pendPicked].sort((a, b) => a - b);
    types = forcedAbilities.length;
  } else {
    forcedAbilities = null;
    types = pendTypes;
  }
  const v = parseInt(seedInEl.value, 10);
  newPuzzle(Number.isFinite(v) ? v : undefined);
  setPanel('setup', false);
});

buildDom();
newPuzzle();

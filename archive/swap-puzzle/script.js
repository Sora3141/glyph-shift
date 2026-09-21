// 行・列の入れ替えだけで目標の並びを作るパズル。
// 盤面は「行の並び順 rowOrder」と「列の並び順 colOrder」の 2 つの置換で表す。
// 表示セル (r, c) の中身は目標盤の (rowOrder[r], colOrder[c])。
// したがって rowOrder と colOrder がどちらも恒等置換ならクリア。

const boardEl = document.getElementById('board');
const goalEl = document.getElementById('goal');
const colHandlesEl = document.getElementById('colHandles');
const rowHandlesEl = document.getElementById('rowHandles');
const movesEl = document.getElementById('moves');
const hintEl = document.getElementById('hint');
const overlayEl = document.getElementById('clearOverlay');
const clearMovesEl = document.getElementById('clearMoves');

let n = 3;
let rowOrder = [];
let colOrder = [];
let startRowOrder = [];
let startColOrder = [];
let moves = 0;
let selected = null; // { axis: 'row' | 'col', index: number }
let locked = false;

const identity = (len) => Array.from({ length: len }, (_, i) => i);

// 目標盤の (r, c) に置かれるタイルの値（0 始まりの通し番号）
const goalValue = (r, c) => r * n + c;

function tileColor(value) {
  const hue = Math.round((value / (n * n)) * 320);
  return `hsl(${hue} 72% 66%)`;
}

function makeCell(value, small) {
  const el = document.createElement('div');
  el.className = 'cell';
  el.style.background = tileColor(value);
  el.textContent = value + 1;
  if (small) el.dataset.small = 'true';
  return el;
}

function renderGoal() {
  goalEl.style.setProperty('--n', n);
  goalEl.replaceChildren();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) goalEl.append(makeCell(goalValue(r, c), true));
  }
}

function renderBoard() {
  boardEl.style.setProperty('--n', n);
  boardEl.replaceChildren();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = makeCell(goalValue(rowOrder[r], colOrder[c]));
      if (selected && selected.axis === 'row' && selected.index === r) cell.classList.add('armed');
      if (selected && selected.axis === 'col' && selected.index === c) cell.classList.add('armed');
      boardEl.append(cell);
    }
  }
}

function renderHandles() {
  for (const [el, axis, label] of [[colHandlesEl, 'col', 'ABCDEFGH'], [rowHandlesEl, 'row', '12345678']]) {
    el.style.setProperty('--n', n);
    el.replaceChildren();
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.className = 'handle';
      b.textContent = label[i];
      b.dataset.axis = axis;
      b.dataset.index = String(i);
      if (selected && selected.axis === axis && selected.index === i) b.classList.add('selected');
      el.append(b);
    }
  }
}

function render() {
  renderBoard();
  renderHandles();
  movesEl.textContent = String(moves);
  hintEl.textContent = selected
    ? `${selected.axis === 'row' ? '行' : '列'}を選択中 — 入れ替える相手をクリック`
    : '端のハンドルをクリックして 2 本選択';
}

function isSolved() {
  return rowOrder.every((v, i) => v === i) && colOrder.every((v, i) => v === i);
}

function swap(axis, a, b) {
  const order = axis === 'row' ? rowOrder : colOrder;
  [order[a], order[b]] = [order[b], order[a]];
}

function onHandleClick(e) {
  if (locked) return;
  const btn = e.target.closest('.handle');
  if (!btn) return;

  const axis = btn.dataset.axis;
  const index = Number(btn.dataset.index);

  if (!selected) {
    selected = { axis, index };
  } else if (selected.axis === axis && selected.index === index) {
    selected = null; // 同じものを再クリックで解除
  } else if (selected.axis !== axis) {
    selected = { axis, index }; // 向きが違えば選択し直し
  } else {
    swap(axis, selected.index, index);
    selected = null;
    moves++;
  }

  render();
  if (isSolved() && moves > 0) showClear();
}

function showClear() {
  locked = true;
  clearMovesEl.textContent = String(moves);
  overlayEl.hidden = false;
}

function shuffle() {
  overlayEl.hidden = true;
  locked = false;
  selected = null;
  moves = 0;

  // ランダムな行/列スワップだけで崩すので、必ず解ける盤面になる
  do {
    rowOrder = identity(n);
    colOrder = identity(n);
    for (let i = 0; i < n * 8; i++) {
      const axis = Math.random() < 0.5 ? 'row' : 'col';
      const a = Math.floor(Math.random() * n);
      let b = Math.floor(Math.random() * n);
      while (b === a) b = Math.floor(Math.random() * n);
      swap(axis, a, b);
    }
  } while (isSolved());

  startRowOrder = [...rowOrder];
  startColOrder = [...colOrder];
  render();
}

function resetToStart() {
  overlayEl.hidden = true;
  locked = false;
  selected = null;
  moves = 0;
  rowOrder = [...startRowOrder];
  colOrder = [...startColOrder];
  render();
}

colHandlesEl.addEventListener('click', onHandleClick);
rowHandlesEl.addEventListener('click', onHandleClick);
document.getElementById('shuffle').addEventListener('click', shuffle);
document.getElementById('again').addEventListener('click', shuffle);
document.getElementById('reset').addEventListener('click', resetToStart);
document.getElementById('size').addEventListener('change', (e) => {
  n = Number(e.target.value);
  renderGoal();
  shuffle();
});

renderGoal();
shuffle();

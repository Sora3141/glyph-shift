// テストが動く場所（DOM・タイマー・保存の代わり物）。
// 実ブラウザと違うところで検証がすり抜けないよう、クラスの出し入れ・親子・
// イベントの発火だけは本物に合わせてある。
function mk(tag) {
  const e = {
    tagName: tag, children: [], _cls: new Set(), _attr: {}, dataset: {},
    style: { setProperty(){} }, textContent: '', innerHTML: '', title: '', value: '', hidden: false,
    append(...c){
      // タイルの配置だけを数える（スロットへの挿入のみ）。
      // ヒント表示など他の DOM 生成まで数えると検証がぼやけるため。
      if (e._cls.has('slot')) globalThis.__appendCount = (globalThis.__appendCount || 0) + c.length;
      for(const x of c){ if(x&&x.__p) x.__p.children=x.__p.children.filter(y=>y!==x); if(x&&typeof x==='object') x.__p=this; this.children.push(x);} },
    replaceChildren(...c){ this.children=[]; this.append(...c); },
    _on: {},
    addEventListener(type, fn){ (e._on[type] ||= []).push(fn); },
    // イベントを実際に発火できるようにする（設定の保留動作を検証するため）
    fire(type, ev){ for (const fn of (e._on[type] || [])) fn(ev); },
    // closest はタグ名とクラス名だけ見る簡易版
    closest(sel){
      let n = e;
      while (n) {
        if (sel.startsWith('.') ? n._cls.has(sel.slice(1)) : n.tagName === sel) return n;
        n = n.__p;
      }
      return null;
    },
    focus(){},
    get parentNode(){ return e.__p || null; },
    getAnimations(){ return e._anims; }, _anims: [],
    setAttribute(k,v){ e._attr[k]=v; }, getAttribute(k){ return e._attr[k]; },
    querySelectorAll(sel){
      const out = [];
      const walk = (p) => { for (const c of p.children) { if (typeof c !== 'object') continue;
        if (sel.startsWith('.') ? c._cls.has(sel.slice(1)) : c.tagName === sel) out.push(c); walk(c); } };
      walk(e); return out;
    },
    querySelector(sel){ return e.querySelectorAll(sel)[0] || null; },
    getBoundingClientRect(){ const i = this.__p ? Number(this.__p.dataset.i) : -1; return { left: i, top: i }; },
    animate(_k, opts){ const a = { cancel(){ e._anims = e._anims.filter(x => x !== a); }, opts }; e._anims.push(a); globalThis.__animCount = (globalThis.__animCount || 0) + 1; (globalThis.__animOpts = globalThis.__animOpts || []).push(opts); return a; },
    get offsetWidth(){ return 1; },
  };
  e.classList = {
    add: (c) => e._cls.add(c), remove: (c) => e._cls.delete(c),
    contains: (c) => e._cls.has(c),
    toggle: (c, on) => { const v = on === undefined ? !e._cls.has(c) : on; v ? e._cls.add(c) : e._cls.delete(c); return v; },
  };
  // className 代入も classList に反映する（実ブラウザと同じ挙動にしないと検証がすり抜ける）
  Object.defineProperty(e, 'className', {
    get: () => [...e._cls].join(' '),
    set: (v) => { e._cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  return e;
}
const cache = {};
globalThis.document = {
  createElement: (t) => mk(t),
  createTextNode: (t) => ({ textContent: t, nodeType: 3 }),
  getElementById: (id) => (cache[id] ||= mk('div')),
  documentElement: mk('html'),
  body: mk('body'),
  addEventListener(){},
};

// setTimeout の扱い:
//   短い遅延（探索の一拍ずらし、自動再生の 1 手ごと）は即実行して同期的に確かめる。
//   長い遅延（ヒントの消灯タイマーなど）は保留し、flushTimers() で明示的に進める。
globalThis.__timers = [];
globalThis.setTimeout = (fn, ms = 0) => {
  if (ms < 1000) { fn(); return 0; }
  globalThis.__timers.push(fn);
  return globalThis.__timers.length;
};
globalThis.clearTimeout = (id) => { if (id) globalThis.__timers[id - 1] = null; };
globalThis.flushTimers = () => {
  const q = globalThis.__timers;
  globalThis.__timers = [];
  for (const fn of q) if (fn) fn();
};

globalThis.matchMedia = () => ({ matches: false });

// localStorage の代わり物。効果音の入切と絵柄の選択が保存されるので、
// テストからも読み書きできるようにしておく。
{
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

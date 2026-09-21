// ---- 効果音 ----
// 音源ファイルは持たず、Web Audio API で都度合成する。
// file:// から開いても鳴り、読み込み待ちもない。
//
// AudioContext はユーザー操作より前には作らない（ブラウザの自動再生制限のため）。
// AudioContext が無い環境（テストなど）では、すべて何もしない。
const Sfx = (() => {
  const KEY = 'glyphshift.sound';
  let ctx = null;
  let on = true;

  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'off') on = false;
  } catch (e) { /* localStorage が使えない環境では既定のまま */ }

  const Ctor = typeof AudioContext !== 'undefined' ? AudioContext
    : typeof webkitAudioContext !== 'undefined' ? webkitAudioContext
    : null;

  function ready() {
    if (!on || !Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 短い音をひとつ鳴らす。bend は終わりの周波数の倍率。
  function blip(freq, { dur = 0.1, type = 'triangle', gain = 0.11, bend = 1, delay = 0 } = {}) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * bend), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  // ブロックごとに違う音程にする。重なっても濁らないようペンタトニックから選ぶ。
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];

  return {
    get enabled() { return on; },

    set(v) {
      on = !!v;
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, on ? 'on' : 'off'); }
      catch (e) { /* 保存できなくても動作は変えない */ }
      if (on) blip(NOTES[3], { dur: 0.08, gain: 0.08 });
    },

    // 発動音。順方向は少し上がり、逆回りは下がる。
    move(ability, dir) {
      const f = NOTES[ability % NOTES.length];
      if (dir < 0) blip(f * 0.75, { dur: 0.13, type: 'sine', gain: 0.1, bend: 0.8 });
      else blip(f, { dur: 0.09, type: 'triangle', gain: 0.1, bend: 1.05 });
    },

    // 使えないマスを押したとき
    blocked() {
      blip(150, { dur: 0.13, type: 'square', gain: 0.05, bend: 0.6 });
    },

    // ヒント
    hint() {
      blip(1174.66, { dur: 0.06, type: 'sine', gain: 0.06 });
      blip(1567.98, { dur: 0.08, type: 'sine', gain: 0.05, delay: 0.07 });
    },

    // 完成
    solved() {
      [523.25, 659.25, 783.99, 1046.50].forEach((f, k) => {
        blip(f, { dur: 0.32, type: 'triangle', gain: 0.1, delay: k * 0.09 });
      });
    },
  };
})();

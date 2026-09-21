// ---- 解法アルゴリズム ----
//
// このファイルは「問題の記述」だけを受け取る純粋な計算で、画面や盤面の状態は
// いっさい参照しない。そのため同じ関数を
//   ・メインスレッドでそのまま呼ぶ（Worker が使えない環境の保険）
//   ・関数の文字列を Blob にして Web Worker の中で動かす（通常はこちら）
// の両方で使える。file:// で開いたときも Blob からなら Worker を作れる。
//
// 問題の記述 P
//   P.N, P.SIZE  盤の一辺とマス数
//   P.cyc[a][i]  能力 a をマス i で使ったときのサイクル（使えなければ null）
//   P.ord[a][i]  その手の位数（何回で元に戻るか）
//
// 定式化
//   状態 = 「絵柄の並び」（マス → 能力）。タイルの個体は区別しなくてよい。
//   手   = 「マス i の能力を順方向に 1 回」または「逆方向に 1 回」。
//          使ったタイルは動かないので逆の手は必ず打てる（グラフは無向）。
//   したがって単位コストの無向グラフ上の最短経路問題で、最短手数が定義できる。
//
// 解き方（候補をいくつも作り、いちばん短いものを返す。途中経過も知らせる）
//   1. 目標側の探索表   … 目標から BFS。以降のすべての方法が「表に当たったら最短で終わる」ために使う。
//   2. 双方向 BFS       … 厳密に最短。状態数が上限に収まる盤面（4×4 と多くの 5×5）で成功する。
//   3. 積み上げ         … 1 マスずつ確定していく人間流。確定マスを崩さない「きれいな手順」
//                         （交換子・共役、その 2〜3 段目）を機械的に作って探す。大きい盤でも数百手に収まる。
//                         最後に残す 3×3 の穴は、柄から「崩さずに動かせる配置の数」を測って
//                         いちばん豊かな位置を選び（pickHole）、そこへ向かって遠いマスから埋める。
//                         走査順は hole → spiral → rows の順に試す。
//                         途中で止まったら、そこからビームで続きを探す。
//   4. 双方向ビーム     … 目標側と開始側からビームを伸ばし、出会ったところでつなぐ。
//                         評価は色ごとの距離の合計。色数が 4 以下なら積み上げより先に走らせる。
//   5. 記録した逆手順   … 生成時の混ぜ方を逆にたどるもの。必ず存在する保険。
//   最後に経路短縮をかけて、いちばん短い候補を返す。
//
// 計測は tools/bench.js（Node）で行う。例: node tools/bench.js 8 3 6 3000
//
// 限界: 6×6 以上では最短の保証はない。
// 最後に残る穴のまわりの押し場所は、確定マスの中身を穴に引き込むものが多く、
// 崩さずに揃える手順の豊かさは穴の位置で大きく違う（6 通りしか動かせない所と全部動かせる所がある）。
// 豊かな位置を選ぶことで、色数が多い大きい盤でもほぼ解けるようになったが、
// どの位置も貧しい盤がまれにあり（10 盤に 1 つほど）、そのときは逆手順へ落ちる。

function solverModule() {
  'use strict';

  // ---- 基本 ----
  const keyOf = (lay) => String.fromCharCode.apply(null, lay);

  // サイクルに沿って中身を 1 つ送る（dir < 0 なら逆向き）
  function applyMove(dst, cycles, dir) {
    for (const cyc of cycles) {
      if (dir > 0) {
        const last = dst[cyc[cyc.length - 1]];
        for (let k = cyc.length - 1; k > 0; k--) dst[cyc[k]] = dst[cyc[k - 1]];
        dst[cyc[0]] = last;
      } else {
        const first = dst[cyc[0]];
        for (let k = 0; k < cyc.length - 1; k++) dst[cyc[k]] = dst[cyc[k + 1]];
        dst[cyc[cyc.length - 1]] = first;
      }
    }
  }

  const stepTo = (P, lay, i, dir) => {
    const next = Uint8Array.from(lay);
    applyMove(next, P.cyc[lay[i]][i], dir);
    return next;
  };

  // その状態で打てる手を [i, dir] の配列で返す。
  // 位数 2 の手は順方向と逆方向が同じ結果になるので 1 つだけ。
  function movesOf(P, lay, cells) {
    const out = [];
    if (cells) {
      for (const i of cells) {
        const a = lay[i];
        if (!P.cyc[a][i]) continue;
        out.push([i, 1]);
        if (P.ord[a][i] !== 2) out.push([i, -1]);
      }
    } else {
      for (let i = 0; i < P.SIZE; i++) {
        const a = lay[i];
        if (!P.cyc[a][i]) continue;
        out.push([i, 1]);
        if (P.ord[a][i] !== 2) out.push([i, -1]);
      }
    }
    return out;
  }

  const mismatchCount = (lay, goal) => {
    let m = 0;
    for (let i = 0; i < lay.length; i++) if (lay[i] !== goal[i]) m++;
    return m;
  };

  // 手順を適用して終点の並びを返す
  function runPlan(P, lay, plan) {
    const cur = Uint8Array.from(lay);
    for (const [i, dir] of plan) applyMove(cur, P.cyc[cur[i]][i], dir);
    return cur;
  }

  // ---- 1. 目標側の探索表 ----
  // 目標から BFS で広げ、各状態に「目標へ 1 歩近づく手」と「目標までの距離」を持たせる。
  // 1 状態あたりのメモリを抑えるため、値は 1 つの整数に詰める。
  //   code = d * (2 * SIZE) + i * 2 + (dir < 0 ? 1 : 0)
  function buildGoalTable(P, goal, maxStates, deadline) {
    const W = 2 * P.SIZE;
    const table = new Map();
    table.set(keyOf(goal), 0);
    let frontier = [goal];
    let depth = 0;
    let full = true; // 最後の層まで取りこぼしなく入ったか
    outer:
    while (frontier.length && table.size < maxStates) {
      if (performance.now() > deadline) { full = false; break; }
      const next = [];
      for (const lay of frontier) {
        for (const [i, dir] of movesOf(P, lay)) {
          const nl = stepTo(P, lay, i, dir);
          const k = keyOf(nl);
          if (table.has(k)) continue;
          // この状態からは逆向きの手で親（＝目標に近い側）へ戻れる
          table.set(k, (depth + 1) * W + i * 2 + (dir > 0 ? 1 : 0));
          next.push(nl);
          if (table.size >= maxStates) { full = false; break outer; }
        }
      }
      frontier = next;
      depth++;
    }
    const decode = (code) => {
      const bit = code % 2;
      const i = ((code - bit) / 2) % P.SIZE;
      const d = Math.floor(code / W);
      return { d, i, dir: bit ? -1 : 1 };
    };
    const distOf = (key) => {
      const c = table.get(key);
      return c === undefined ? -1 : Math.floor(c / W);
    };
    return { table, depth, full, decode, distOf };
  }

  // 表に載っている状態から目標までの手順を取り出す
  function pathFromTable(P, lay, T) {
    const out = [];
    const cur = Uint8Array.from(lay);
    let code = T.table.get(keyOf(cur));
    while (code !== undefined && code !== 0) {
      const { i, dir } = T.decode(code);
      out.push([i, dir]);
      applyMove(cur, P.cyc[cur[i]][i], dir);
      code = T.table.get(keyOf(cur));
    }
    return out;
  }

  // ---- 2. 双方向 BFS（厳密に最短） ----
  // 開始側を層ごとに広げ、目標側の表に当たった時点で最短を確定させる。
  // 表の最後の層が途中で切れていても、同じ層の中で目標までが最短のものを選べば
  // 全体も最短になる。開始側の層が途中で切れた場合だけは保証が崩れるので、
  // そのときは見つかった道を「最短とは限らない」として返す。
  function bidirectional(P, start, T, maxStates, deadline) {
    const startKey = keyOf(start);
    if (T.table.has(startKey)) return { plan: pathFromTable(P, start, T), optimal: true };

    const fwd = new Map();
    fwd.set(startKey, -1);
    let frontier = [start];
    let cut = false;

    while (frontier.length && fwd.size < maxStates) {
      if (performance.now() > deadline) return null;
      const next = [];
      let best = null;
      outer:
      for (let fi = 0; fi < frontier.length; fi++) {
        const lay = frontier[fi];
        for (const [i, dir] of movesOf(P, lay)) {
          const nl = stepTo(P, lay, i, dir);
          const k = keyOf(nl);
          if (fwd.has(k)) continue;
          fwd.set(k, i * 2 + (dir > 0 ? 0 : 1));
          const d = T.distOf(k);
          if (d >= 0 && (best === null || d < best.d)) best = { lay: nl, d };
          next.push(nl);
          if (fwd.size >= maxStates) { cut = fi < frontier.length - 1; break outer; }
        }
      }
      if (best) {
        // 開始側の道は、逆の手を打って親へ戻りながら拾う
        const head = [];
        const cur = Uint8Array.from(best.lay);
        let code = fwd.get(keyOf(cur));
        while (code !== -1) {
          const i = (code - (code % 2)) / 2;
          const dir = code % 2 ? -1 : 1;
          head.push([i, dir]);
          applyMove(cur, P.cyc[cur[i]][i], -dir);
          code = fwd.get(keyOf(cur));
        }
        head.reverse();
        return { plan: head.concat(pathFromTable(P, best.lay, T)), optimal: !cut };
      }
      frontier = next;
    }
    return null;
  }

  // ---- 3. 双方向ビームサーチ（最短の保証なし） ----
  // 開始側と目標側からビームを伸ばし、出会ったところでつなぐ。
  // 手順は配列を継ぎ足さず親をたどる形で持つ。盤が大きいと 1 段で数万の子ができるため。
  // 評価は「各マスの色が、相手側でその色のあるいちばん近いマスまでの距離」の合計。
  // 一致していないマスの数より細かく、色数が多い盤で効く。
  // タイルが行き来できるマスの類（偶奇など）が分かれる盤では、別の類にある目標マスは数えない。
  function cellClasses(P, present) {
    const cls = new Int16Array(P.SIZE);
    for (let i = 0; i < P.SIZE; i++) cls[i] = i;
    const find = (i) => { while (cls[i] !== i) { cls[i] = cls[cls[i]]; i = cls[i]; } return i; };
    for (const a of present) {
      for (let i = 0; i < P.SIZE; i++) {
        const cyc = P.cyc[a][i];
        if (!cyc) continue;
        for (const c of cyc) for (let k = 1; k < c.length; k++) {
          const x = find(c[0]), y = find(c[k]);
          if (x !== y) cls[x] = y;
        }
      }
    }
    for (let i = 0; i < P.SIZE; i++) cls[i] = find(i);
    return cls;
  }

  function distanceScorer(P, toward) {
    const N = P.N;
    const cls = cellClasses(P, new Set(toward));
    const maps = new Map();
    const colors = new Set(toward);
    for (const c of colors) {
      const m = new Uint8Array(P.SIZE).fill(2 * N);
      for (let i = 0; i < P.SIZE; i++) {
        if (toward[i] !== c) continue;
        const cx = i % N, cy = Math.floor(i / N);
        for (let j = 0; j < P.SIZE; j++) {
          if (cls[j] !== cls[i]) continue;
          const d = Math.max(Math.abs(j % N - cx), Math.abs(Math.floor(j / N) - cy));
          if (d < m[j]) m[j] = d;
        }
      }
      maps.set(c, m);
    }
    return (lay) => {
      let s = 0;
      for (let i = 0; i < P.SIZE; i++) s += maps.get(lay[i])[i];
      return s;
    };
  }

  function bidirectionalBeam(P, start, goal, T, limits, deadline) {
    // 1 段あたりの仕事量がだいたい一定になるよう、打てる手の数から幅を決める
    const branch = movesOf(P, start).length;
    const width = Math.max(80, Math.min(limits.beamWidth, Math.round(12000 / Math.max(4, branch))));

    const mk = (lay, toward) => {
      const key = keyOf(lay);
      const seen = new Map([[key, null]]);
      return { beam: [{ lay, key }], seen, toward, score: distanceScorer(P, toward) };
    };
    const sides = [mk(start, goal), mk(goal, start)];

    const trace = (side, key) => {
      const out = [];
      let e = side.seen.get(key);
      while (e) { out.push([e.i, e.dir]); e = side.seen.get(e.pk); }
      return out.reverse();
    };
    const invert = (path) => path.slice().reverse().map(([i, d]) => [i, -d]);

    for (let depth = 0; depth < limits.beamDepth; depth++) {
      for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
        if (performance.now() > deadline) return null;
        const me = sides[sideIdx];
        const other = sides[1 - sideIdx];
        if (!me.beam.length) continue;

        const cand = [];
        for (const node of me.beam) {
          for (const [i, dir] of movesOf(P, node.lay)) {
            const nl = stepTo(P, node.lay, i, dir);
            const k = keyOf(nl);
            if (me.seen.has(k)) continue;
            me.seen.set(k, { pk: node.key, i, dir });

            if (other.seen.has(k)) {
              const mine = trace(me, k);
              const theirs = trace(other, k);
              return sideIdx === 0 ? mine.concat(invert(theirs)) : theirs.concat(invert(mine));
            }
            // 開始側は目標側の表に当たれば、そこから先は最短で終われる
            if (sideIdx === 0 && T && T.table.has(k)) {
              return trace(me, k).concat(pathFromTable(P, nl, T));
            }
            cand.push({ lay: nl, key: k, score: me.score(nl) });
          }
        }
        if (!cand.length) { me.beam = []; continue; }
        cand.sort((a, b) => a.score - b.score);
        me.beam = cand.slice(0, width);
        if (me.beam[0].score === 0) {
          const p = trace(me, me.beam[0].key);
          return sideIdx === 0 ? p : invert(p);
        }
      }
      if (!sides[0].beam.length && !sides[1].beam.length) return null;
    }
    return null;
  }

  // ---- 4. 積み上げ（1 マスずつ確定していく） ----
  //
  // 上の行から順に 1 マスずつ目標の色を置いていく。置いたマスは「確定」とし、
  // 以後の手順の終わりでは必ず元どおりになっている（途中で崩すのは構わない）。
  // 下 3 行は列ごとに確定する。下 2 行だけ残すと、そこを押す手がすべて確定済みの
  // 行に触れてしまい、動かせなくなるため。最後に残った角のかたまりは局所の探索で揃える。
  //
  // 1 マスを置く手順は、そのマスの近くだけを押す局所探索で見つける。
  // 押す場所を近くに限るので、遠くで無駄に動かす手が候補に入らず、
  // 「確定したマスを一度崩して戻す」ような数手の手順も見つかる。
  //
  // 目安（h）は「運ぶタイルの距離」だけでは足りない。マス t の隣にほしい色があっても、
  // それを t に送り込む能力（道具）が隣に無ければ動かせないので、
  // 「t に送り込める入口 s と、その入口を動かす道具 (p, a)」の組ごとに
  //   色のタイルから s までの距離 + 道具のタイルから p までの距離（道具が既にあれば 0）
  // を出し、いちばん小さいものを目安にする。

  // 幾何
  function geometry(P) {
    const N = P.N;
    const cx = new Int8Array(P.SIZE), cy = new Int8Array(P.SIZE);
    for (let i = 0; i < P.SIZE; i++) { cx[i] = i % N; cy[i] = Math.floor(i / N); }
    const cheb = (a, b) => Math.max(Math.abs(cx[a] - cx[b]), Math.abs(cy[a] - cy[b]));
    const neighbors = (i) => {
      const out = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cx[i] + dx, y = cy[i] + dy;
        if (x >= 0 && x < N && y >= 0 && y < N) out.push(y * N + x);
      }
      return out;
    };
    const within = (centers, r) => {
      const out = [];
      for (let i = 0; i < P.SIZE; i++) {
        for (const c of centers) if (c >= 0 && cheb(i, c) <= r) { out.push(i); break; }
      }
      return out;
    };
    return { cx, cy, cheb, neighbors, within };
  }

  // 局所探索の舞台。presses のマスだけを押し、変わりうるマス（region）の中身だけを状態に持つ。
  // 盤全体を複製しないので、状態 1 つが小さく、鍵も短い。
  function makeArena(P, G, presses) {
    const mark = new Uint8Array(P.SIZE);
    for (const p of presses) { mark[p] = 1; for (const q of G.neighbors(p)) mark[q] = 1; }
    const region = [];
    const pos = new Int16Array(P.SIZE).fill(-1);
    for (let i = 0; i < P.SIZE; i++) if (mark[i]) { pos[i] = region.length; region.push(i); }
    // 押す場所ごとに、能力 → region 内の座標に置き換えたサイクル
    const table = presses.map((p) => {
      const byA = [];
      for (let a = 0; a < P.cyc.length; a++) {
        const cyc = P.cyc[a][p];
        byA.push(cyc ? { cyc: cyc.map((c) => c.map((i) => pos[i])), two: P.ord[a][p] === 2 } : null);
      }
      return { cell: p, q: pos[p], byA };
    });
    const extract = (lay) => { const S = new Uint8Array(region.length); for (let k = 0; k < region.length; k++) S[k] = lay[region[k]]; return S; };
    return { region, pos, table, extract };
  }

  // 局所探索。評価 f = 手数 + h の小さい順に広げる（h は目安なので最短の保証はない）。
  // 生成した状態数で打ち切るので、メモリが膨らまない。
  function localSearch(arena, S0, spec, deadline) {
    const { isGoal, h, maxNodes, maxDepth } = spec;
    const keyS = (S) => String.fromCharCode.apply(null, S);
    const seen = new Set([keyS(S0)]);
    const states = [S0], par = [-1], mvQ = [-1], mvD = [0], gs = [0];
    const buckets = [];
    let minF = 0;
    const push = (idx, f) => { (buckets[f] || (buckets[f] = [])).push(idx); if (f < minF) minF = f; };
    const pathTo = (idx) => {
      const out = [];
      for (let k = idx; par[k] >= 0; k = par[k]) out.push([arena.table[mvQ[k]].cell, mvD[k]]);
      return out.reverse();
    };
    if (isGoal(S0)) return [];
    push(0, h(S0));

    let expanded = 0;
    for (;;) {
      while (minF < buckets.length && (!buckets[minF] || !buckets[minF].length)) minF++;
      if (minF >= buckets.length) return null;
      if (states.length >= maxNodes) return null;
      if ((expanded++ & 255) === 0 && performance.now() > deadline) return null;
      const node = buckets[minF].pop();
      const S = states[node];
      const g = gs[node];
      for (let ti = 0; ti < arena.table.length; ti++) {
        const t = arena.table[ti];
        const mv = t.byA[S[t.q]];
        if (!mv) continue;
        for (let dir = 1; dir >= -1; dir -= 2) {
          if (dir < 0 && mv.two) break;
          const NS = Uint8Array.from(S);
          applyMove(NS, mv.cyc, dir);
          const k = keyS(NS);
          if (seen.has(k)) continue;
          seen.add(k);
          const idx = states.length;
          states.push(NS); par.push(node); mvQ.push(ti); mvD.push(dir); gs.push(g + 1);
          if (isGoal(NS)) return pathTo(idx);
          if (g + 1 < maxDepth) push(idx, g + 1 + h(NS));
        }
      }
    }
  }

  // 確定していく順番。
  //   rows:   上の行から右へ、下 3 行は列ごとに（上から下へ）。最後は右下の角に残る。
  //   spiral: 外側の周から内側へ。最後は中央に残る。中央なら周囲をすべて押せるので、
  //           確定マスを崩さない手順の種類が多く、色数が多い盤で有利。
  //   band:   上から下へ、下から上へと行を埋めて、中央の 2 行を最後に残す。
  //           2 行の帯は上下どちらの押し場所も使え、上の行を押す手と下の行を押す手は
  //           帯の中だけで重なるので、確定マスを崩さない交換子が豊富に作れる。
  //   hole:   指定した中心のまわり 3×3 を最後に残し、そこから遠いマスほど先に埋める。
  //           中心は pickHole が「確定マスを崩さずに動かせる配置の数」で選ぶ。
  function scanOrder(N, mode = 'rows', center = null) {
    const out = [];
    if (mode === 'hole' && center) {
      const [hx, hy] = center;
      const cells = [];
      for (let i = 0; i < N * N; i++) {
        const x = i % N, y = Math.floor(i / N);
        const d = Math.max(Math.abs(x - hx), Math.abs(y - hy));
        cells.push({ i, d, ang: Math.atan2(y - hy, x - hx) });
      }
      // 遠い順。同じ距離の輪の中は角度順（時計回りに一周）
      cells.sort((a, b) => (b.d - a.d) || (a.ang - b.ang));
      for (const c of cells) out.push(c.i);
      return out;
    }
    if (mode === 'band') {
      const m = Math.max(0, Math.floor((N - 2) / 2));
      for (let y = 0; y < m; y++) for (let x = 0; x < N; x++) out.push(y * N + x);
      for (let y = N - 1; y >= m + 2; y--) for (let x = 0; x < N; x++) out.push(y * N + x);
      for (let x = 0; x < N; x++) for (let y = m; y < Math.min(N, m + 2); y++) out.push(y * N + x);
      return out;
    }
    if (mode === 'spiral') {
      let x0 = 0, y0 = 0, x1 = N - 1, y1 = N - 1;
      while (x0 <= x1 && y0 <= y1) {
        for (let x = x0; x <= x1; x++) out.push(y0 * N + x);
        for (let y = y0 + 1; y <= y1; y++) out.push(y * N + x1);
        if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(y1 * N + x);
        if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(y * N + x0);
        x0++; y0++; x1--; y1--;
      }
      return out;
    }
    const band = Math.min(3, N);
    for (let y = 0; y < N - band; y++) for (let x = 0; x < N; x++) out.push(y * N + x);
    for (let x = 0; x < N; x++) for (let y = N - band; y < N; y++) out.push(y * N + x);
    return out;
  }

  const ENDGAME_CELLS = 9; // 最後にまとめて揃えるマス数（下 3 行 × 3 列）

  // 最後に残す 3×3 の穴の位置を選ぶ。
  // 穴のまわりの確定マスの能力は目標の柄で決まっているので、
  // 「確定マスを崩さない手順で穴の配置をいくつ作れるか（軌道の大きさ）」を先に測れる。
  // 穴の中のタイルは何が来るか分からないが、穴の中央を押す手が主な生成元なので、
  // 目標の並びのまま穴の中も押せるものとして見積もる（楽観的な目安）。
  // 位置によって 6 通りしか動かせない所と全部動かせる所があり、差が大きい。
  function pickHole(P, G, goal, deadline, cap = 4000) {
    const N = P.N;
    if (N < 4) return null;
    const fact = (m) => { let f = 1; for (let i = 2; i <= m; i++) f *= i; return f; };
    const cands = [];
    for (let cy = 1; cy < N - 1; cy++) for (let cx = 1; cx < N - 1; cx++) {
      const dc = Math.max(Math.abs(cx - (N - 1) / 2), Math.abs(cy - (N - 1) / 2));
      cands.push({ cx, cy, dc });
    }
    cands.sort((a, b) => a.dc - b.dc); // 中央から評価する（時間切れでも中央付近は見ている）
    const ranked = [];
    for (const c of cands) {
      if (performance.now() > deadline) break;
      const hole = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) hole.push((c.cy + dy) * N + c.cx + dx);
      const inHole = new Uint8Array(P.SIZE);
      for (const h of hole) inHole[h] = 1;
      const A = makeArena(P, G, G.within(hole, 2));
      const S0 = A.extract(goal);
      const fixedQ = [], holeQ = [];
      for (let q = 0; q < A.region.length; q++) (inHole[A.region[q]] ? holeQ : fixedQ).push(q);
      const cnt = new Map();
      for (const h of hole) cnt.set(goal[h], (cnt.get(goal[h]) || 0) + 1);
      let total = fact(hole.length);
      for (const v of cnt.values()) total /= fact(v);
      const macros = buildMacros(A, S0, fixedQ, 2, true);
      // 穴の配置だけを鍵にして広げる
      const key = (S) => String.fromCharCode.apply(null, holeQ.map((q) => S[q]));
      const seen = new Set([key(S0)]);
      let frontier = [S0];
      const limit = Math.min(cap, total);
      while (frontier.length && seen.size < limit) {
        const next = [];
        for (const S of frontier) {
          for (const seq of macros) {
            const NS = Uint8Array.from(S);
            let ok = true;
            for (const [ti, dir] of seq) {
              const t = A.table[ti];
              const mv = t.byA[NS[t.q]];
              if (!mv) { ok = false; break; }
              applyMove(NS, mv.cyc, dir);
            }
            if (!ok) continue;
            for (const q of fixedQ) if (NS[q] !== S[q]) { ok = false; break; }
            if (!ok) continue;
            const k = key(NS);
            if (seen.has(k)) continue;
            seen.add(k);
            next.push(NS);
            if (seen.size >= limit) break;
          }
          if (seen.size >= limit) break;
        }
        frontier = next;
      }
      const score = seen.size / limit; // 1 なら（上限の範囲で）全部に届く
      ranked.push({ center: [c.cx, c.cy], score, orbit: seen.size, total });
      if (score >= 1) break;
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked.length ? Object.assign(ranked[0], { ranked }) : null;
  }

  // マス t へ 1 手で中身を送り込める入口の一覧。
  // { s: 送り元, p: 押す場所, a: 必要な能力, dir: 押す向き }
  function entriesOf(P, G, t) {
    const out = [];
    for (const p of G.neighbors(t)) {
      for (let a = 0; a < P.cyc.length; a++) {
        const cyc = P.cyc[a][p];
        if (!cyc) continue;
        for (const c of cyc) {
          const k = c.indexOf(t);
          if (k < 0) continue;
          const fwd = c[(k - 1 + c.length) % c.length];
          const rev = c[(k + 1) % c.length];
          out.push({ s: fwd, p, a, dir: 1 });
          if (rev !== fwd) out.push({ s: rev, p, a, dir: -1 });
        }
      }
    }
    return out;
  }

  // 積み上げの作業台。盤面・確定印・手順をまとめて持ち、取り消しもできる。
  function makeBuilder(P, G, start, goal, deadline) {
    const lay = Uint8Array.from(start);
    const fixed = new Uint8Array(P.SIZE);
    const plan = [];
    // タイルが行き来できるマスの組（類）。能力の効果はどれも決まった変位なので、
    // 例えば半回転と斜め入れ替えだけの盤では x, y の偶奇が保たれ、4 つの類に分かれる。
    // 別の類にある同じ色のタイルは、どれだけ近くても t には来られない。
    const cls = cellClasses(P, new Set(start));
    const entryCache = new Map();
    const entries = (t) => {
      let e = entryCache.get(t);
      if (!e) { e = entriesOf(P, G, t); entryCache.set(t, e); }
      return e;
    };
    const doMove = (i, dir) => { applyMove(lay, P.cyc[lay[i]][i], dir); plan.push([i, dir]); };
    const undoTo = (mark) => {
      while (plan.length > mark) {
        const [i, dir] = plan.pop();
        applyMove(lay, P.cyc[lay[i]][i], -dir);
      }
    };
    const timeUp = () => performance.now() > timeUp.deadline;
    timeUp.deadline = deadline;
    return { P, G, goal, lay, fixed, plan, cls, entries, doMove, undoTo, timeUp, left: P.SIZE };
  }

  // ---- きれいな手順（マクロ） ----
  // 確定マスを終わりに元どおりにする短い手順を、押せる場所の組み合わせから機械的に作る。
  //   単発 A        … 効果範囲が確定マスに触れないもの
  //   二度押し A A   … 位数 3 以上のもの
  //   共役 C A C⁻¹   … A の効果を C でずらしたもの
  //   交換子 A B A⁻¹ B⁻¹ … 効果範囲が重なる 2 手から。重なりが 1 マスなら 3 つのマスの巡回になる
  // どれも「確定マスを崩さない」ものだけ残す。同じ並べ替えになる手順は短いほうを残す。
  // 手順の途中で押す場所の能力が変わりうるので、色の並びも同時に追って厳密に求める。
  // deep: 0/false = 1 段目まで、true/2 = 2 段目まで、3 = 段取り 2 手の共役も。
  // colorClean: 確定マスの「色」が戻れば合格とする（同じ色のタイルどうしの入れ替えは許す）。
  function buildMacros(arena, S0, fixedQ, deep = false, colorClean = false, extraSeeds = null) {
    // 手順の中で押す場所の能力は状態で変わる。目標の並びなど別の状態からも辞書を作って合わせると、
    // 探索の終わりの側でも使える手順が揃う。
    if (extraSeeds && extraSeeds.length) {
      const seen = new Set();
      const out = [];
      for (const seed of [S0, ...extraSeeds]) {
        for (const seq of buildMacros(arena, seed, fixedQ, deep, colorClean)) {
          const k = seq.map(([ti, d]) => ti * 2 + (d > 0 ? 0 : 1)).join(',');
          if (seen.has(k)) continue;
          seen.add(k);
          out.push(seq);
        }
      }
      return out;
    }
    const L = S0.length;
    const singles = [];
    for (let ti = 0; ti < arena.table.length; ti++) {
      const mv = arena.table[ti].byA[S0[arena.table[ti].q]];
      if (!mv) continue;
      const sup = new Set();
      for (const c of mv.cyc) for (const k of c) sup.add(k);
      singles.push({ seq: [[ti, 1]], sup, two: mv.two });
      if (!mv.two) singles.push({ seq: [[ti, -1]], sup, two: false });
    }
    const overlap = (x, y) => { for (const k of x.sup) if (y.sup.has(k)) return true; return false; };
    // 手順の逆: 逆順に、それぞれ逆向きで（位数 2 は同じ向き）
    const inv = (m) => ({ seq: m.seq.slice().reverse().map(([ti, d]) => [ti, -d]), sup: m.sup, two: m.two });
    const cat = (...ms) => ms.flatMap((m) => m.seq);

    const byPerm = new Map();
    const labels = new Uint16Array(L);
    const S = new Uint8Array(L);
    // 手順を実際に追って並べ替えを求め、確定マスが動かないものだけ登録する。
    // 登録したものは { seq, sup } として返し、次の段の材料にもする。
    const consider = (seq) => {
      for (let k = 0; k < L; k++) { labels[k] = k; S[k] = S0[k]; }
      for (const [ti, dir] of seq) {
        const t = arena.table[ti];
        const mv = t.byA[S[t.q]];
        if (!mv) return null;
        applyMove(S, mv.cyc, dir);
        applyMove(labels, mv.cyc, dir);
      }
      const sup = new Set();
      for (let k = 0; k < L; k++) if (labels[k] !== k) sup.add(k);
      if (!sup.size) return null;
      if (colorClean) { for (const k of fixedQ) if (S[k] !== S0[k]) return null; } // 確定マスの色が変わった
      else { for (const k of fixedQ) if (sup.has(k)) return null; }                 // 確定マスが動いた
      const key = String.fromCharCode.apply(null, labels);
      const prev = byPerm.get(key);
      if (prev && prev.seq.length <= seq.length) return prev;
      const m = { seq: seq.slice(), sup, two: false };
      byPerm.set(key, m);
      return m;
    };

    // 1 段目: 単発、二度押し、共役、交換子
    for (const A of singles) {
      consider(A.seq);
      if (!A.two) consider(cat(A, A));
    }
    for (const A of singles) {
      for (const B of singles) {
        if (A === B || A.seq[0][0] === B.seq[0][0] || !overlap(A, B)) continue;
        consider(cat(B, A, inv(B)));            // 共役
        consider(cat(A, B, inv(A), inv(B)));    // 交換子
      }
    }
    // 2 段目: 1 段目の手順 M と、それに重なる単発 A から
    //   A M A⁻¹（A で確定マスが一時的に動いても、M がそこに触れなければ戻る）
    //   M A M⁻¹ A⁻¹ とその逆
    // さらに手順同士の交換子。狭い角では 1 段目がほとんど無く、ここで初めて増える。
    if (deep) {
      const level1 = [...byPerm.values()];
      for (const M of level1) {
        const Mi = inv(M);
        for (const A of singles) {
          if (!overlap(M, A)) continue;
          const Ai = inv(A);
          consider(cat(A, M, Ai));
          consider(cat(M, A, Mi, Ai));
          consider(cat(A, M, Ai, Mi));
        }
      }
      for (const M1 of level1) {
        for (const M2 of level1) {
          if (M1 === M2 || !overlap(M1, M2)) continue;
          consider(cat(M1, M2, inv(M1), inv(M2)));
        }
      }
      // 3 段目: 段取り 2 手 X Y → M → Y⁻¹ X⁻¹
      if (deep >= 3) {
        for (const M of level1) {
          for (const X of singles) {
            if (!overlap(M, X)) continue;
            for (const Y of singles) {
              if (X === Y || !(overlap(Y, X) || overlap(Y, M))) continue;
              consider(cat(X, Y, M, inv(Y), inv(X)));
            }
          }
        }
      }
    }
    return [...byPerm.values()].map((m) => m.seq);
  }

  // マクロを手として使う探索。確定マスは決して崩れないので、評価は残りのマスだけ見ればよい。
  // 評価 f = 手数 + h の小さい順に広げる。
  // maxNodes は展開する状態の数の上限（1 回の展開でマクロの数だけ子ができる）。
  function macroSearch(arena, S0, fixedQ, spec, deadline) {
    const { isGoal, h, maxNodes, maxCost } = spec;
    const maxExpand = Math.max(200, Math.round(maxNodes / 20));
    const macros = buildMacros(arena, S0, fixedQ, spec.deep, spec.colorClean, spec.seeds);
    const keyS = (S) => String.fromCharCode.apply(null, S);
    const seen = new Set([keyS(S0)]);
    const states = [S0], par = [-1], via = [-1], gs = [0];
    const buckets = [];
    let minF = 0;
    const push = (idx, f) => { (buckets[f] || (buckets[f] = [])).push(idx); if (f < minF) minF = f; };
    const pathTo = (idx) => {
      const out = [];
      for (let k = idx; par[k] >= 0; k = par[k]) {
        const seq = macros[via[k]];
        for (let j = seq.length - 1; j >= 0; j--) out.push([arena.table[seq[j][0]].cell, seq[j][1]]);
      }
      return out.reverse();
    };
    if (isGoal(S0)) return [];
    push(0, h(S0));

    let expanded = 0;
    for (;;) {
      while (minF < buckets.length && (!buckets[minF] || !buckets[minF].length)) minF++;
      if (minF >= buckets.length) return null;
      if (expanded >= maxExpand) return null;
      if ((expanded++ & 63) === 0 && performance.now() > deadline) return null;
      const node = buckets[minF].pop();
      const S = states[node];
      const g = gs[node];
      for (let mi = 0; mi < macros.length; mi++) {
        const seq = macros[mi];
        if (g + seq.length > maxCost) continue;
        const NS = Uint8Array.from(S);
        let ok = true;
        for (const [ti, dir] of seq) {
          const t = arena.table[ti];
          const mv = t.byA[NS[t.q]];
          if (!mv) { ok = false; break; }
          applyMove(NS, mv.cyc, dir);
        }
        if (!ok) continue;
        for (const k of fixedQ) if (NS[k] !== S[k]) { ok = false; break; }
        if (!ok) continue;
        const key = keyS(NS);
        if (seen.has(key)) continue;
        seen.add(key);
        const idx = states.length;
        states.push(NS); par.push(node); via.push(mi); gs.push(g + seq.length);
        if (isGoal(NS)) return pathTo(idx);
        push(idx, g + seq.length + h(NS));
      }
    }
  }

  // 「マス t に色 c を置く」直接の探索。窓 centers/R の中だけ押す。
  // まずマクロだけで探し（確定マスが崩れないので早い）、だめなら 1 手ずつの探索で
  // 「崩して戻す」手順を探す（評価に入口と道具の距離を使う）。
  function directPlace(B, t, c, centers, R, cap, raw = true) {
    const { P, G, goal, lay, fixed, cls } = B;
    const A = makeArena(P, G, G.within(centers, R));
    const { region, pos } = A;
    const tq = pos[t];
    const fixedQ = [], freeQ = [];
    for (let k = 0; k < region.length; k++) (fixed[region[k]] ? fixedQ : freeQ).push(k);
    const goalQ = region.map((i) => goal[i]);
    const deadline = B.timeUp.deadline || Infinity;
    const S0 = A.extract(lay);

    // 同じ類にあるタイルだけが t に来られる
    const distT = freeQ.map((k) => (cls[region[k]] === cls[t] ? G.cheb(region[k], t) : 99));
    let outside = Infinity;
    for (let i = 0; i < P.SIZE; i++) if (pos[i] < 0 && !fixed[i] && lay[i] === c && cls[i] === cls[t]) outside = Math.min(outside, G.cheb(i, t));
    const nearest = (S) => {
      if (S[tq] === c) return 0;
      let m = outside === Infinity ? 30 : outside;
      for (let n = 0; n < freeQ.length; n++) if (S[freeQ[n]] === c && distT[n] < m) m = distT[n];
      return m;
    };
    // 終盤のやり直しでは、穴の配置がすでに失敗したものと同じにならない解を求める
    const rejected = B.rejected;
    let notRejected = () => true;
    if (rejected && rejected.size) {
      const holeQ = B.holeCells.map((i) => pos[i]);
      const outsideKey = B.holeCells.map((i, k) => (holeQ[k] < 0 ? String.fromCharCode(lay[i]) : '')).join('');
      notRejected = (S) => {
        let key = '';
        for (let k = 0; k < holeQ.length; k++) key += holeQ[k] >= 0 ? String.fromCharCode(S[holeQ[k]]) : '';
        return !rejected.has(key + outsideKey);
      };
    }
    let found = macroSearch(A, S0, fixedQ, {
      isGoal: (S) => S[tq] === c && notRejected(S),
      h: (S) => 2 * nearest(S),
      maxNodes: cap,
      maxCost: 40,
    }, deadline);

    if (!found && raw && !B.timeUp()) {
      const tabs = [];
      for (const e of B.entries(t)) {
        const distS = freeQ.map((k) => (cls[region[k]] === cls[e.s] ? G.cheb(region[k], e.s) : 99));
        const distP = freeQ.map((k) => (cls[region[k]] === cls[e.p] ? G.cheb(region[k], e.p) : 99));
        let outC = Infinity, outA = Infinity;
        for (let i = 0; i < P.SIZE; i++) {
          if (pos[i] >= 0 || fixed[i]) continue;
          if (lay[i] === c && cls[i] === cls[e.s]) outC = Math.min(outC, G.cheb(i, e.s));
          if (lay[i] === e.a && cls[i] === cls[e.p]) outA = Math.min(outA, G.cheb(i, e.p));
        }
        tabs.push({ sq: pos[e.s], pq: pos[e.p], a: e.a, sFixed: fixed[e.s] === 1, pFixed: fixed[e.p] === 1, distS, distP, outC, outA });
      }
      const broken = (S) => { let b = 0; for (const k of fixedQ) if (S[k] !== goalQ[k]) b++; return b; };
      const core = (S) => {
        if (S[tq] === c) return 0;
        let best = Infinity;
        for (const e of tabs) {
          let dc;
          if (e.sFixed) { if (S[e.sq] !== c) continue; dc = 0; }
          else {
            dc = e.outC;
            for (let n = 0; n < freeQ.length; n++) {
              const k = freeQ[n];
              if (S[k] === c && k !== e.pq && e.distS[n] < dc) dc = e.distS[n];
            }
            if (dc === Infinity) continue;
          }
          let da = 0;
          if (S[e.pq] !== e.a) {
            if (e.pFixed) continue;
            da = e.outA;
            for (let n = 0; n < freeQ.length; n++) {
              const k = freeQ[n];
              if (S[k] === e.a && e.distP[n] < da) da = e.distP[n];
            }
            if (da === Infinity) continue;
          }
          if (dc + da < best) best = dc + da;
        }
        return best === Infinity ? 40 : best;
      };
      found = localSearch(A, S0, {
        isGoal: (S) => S[tq] === c && broken(S) === 0 && notRejected(S),
        h: (S) => 2 * core(S) + 2 * broken(S),
        maxNodes: cap,
        maxDepth: 14,
      }, deadline);
    }
    if (!found) return false;
    for (const [i, dir] of found) B.doMove(i, dir);
    return true;
  }

  // 色 c の（同じ類にある）タイルを t の近く（距離 2 以内）まで運ぶ。
  // 窓はタイルのまわりと、t へ向かう先に置く。1 段で距離が縮めば次の段へ。
  function approach(B, t, c) {
    const { P, G, lay, fixed, cls } = B;
    const nearestCell = () => {
      let d0 = Infinity, j = -1;
      for (let i = 0; i < P.SIZE; i++) {
        if (fixed[i] || lay[i] !== c || cls[i] !== cls[t]) continue;
        const d = G.cheb(i, t);
        if (d < d0) { d0 = d; j = i; }
      }
      return [j, d0];
    };
    for (let stage = 0; stage < 4 * P.N; stage++) {
      const [j, d0] = nearestCell();
      if (j < 0) return false;
      if (d0 <= 2) return true;
      if (B.timeUp()) return false;
      // タイルから t へ 2 歩進んだマス
      const sx = Math.sign(G.cx[t] - G.cx[j]), sy = Math.sign(G.cy[t] - G.cy[j]);
      const mid = (G.cy[j] + 2 * sy) * P.N + (G.cx[j] + 2 * sx);
      let found = null;
      for (const [R, cap] of [[2, 20000], [3, 60000]]) {
        const A = makeArena(P, G, G.within([j, mid], R));
        const { region, pos } = A;
        const fixedQ = [], freeQ = [];
        for (let k = 0; k < region.length; k++) (fixed[region[k]] ? fixedQ : freeQ).push(k);
        const distT = freeQ.map((k) => (cls[region[k]] === cls[t] ? G.cheb(region[k], t) : 99));
        let outside = Infinity;
        for (let i = 0; i < P.SIZE; i++) if (pos[i] < 0 && !fixed[i] && lay[i] === c && cls[i] === cls[t]) outside = Math.min(outside, G.cheb(i, t));
        const nearest = (S) => {
          let m = outside === Infinity ? 30 : outside;
          for (let n = 0; n < freeQ.length; n++) if (S[freeQ[n]] === c && distT[n] < m) m = distT[n];
          return m;
        };
        found = macroSearch(A, A.extract(lay), fixedQ, {
          isGoal: (S) => nearest(S) < d0,
          h: (S) => 2 * nearest(S),
          maxNodes: cap,
          maxCost: 20,
        }, B.timeUp.deadline || Infinity);
        if (found && found.length) break;
        found = null;
      }
      if (!found) return false;
      for (const [i, dir] of found) B.doMove(i, dir);
    }
    return nearestCell()[1] <= 2;
  }

  // 今の盤面で、t に c を送り込むのにいちばん安い入口を並べる。
  // 値は「色のタイルから送り元までの距離 + 道具のタイルから押す場所までの距離」。
  function rankEntries(B, t, c) {
    const { P, G, lay, fixed, cls } = B;
    const out = [];
    for (const e of B.entries(t)) {
      let dc = Infinity, jc = -1;
      if (fixed[e.s]) { if (lay[e.s] !== c) continue; dc = 0; jc = e.s; }
      else {
        for (let i = 0; i < P.SIZE; i++) {
          if (fixed[i] || lay[i] !== c || i === e.p || cls[i] !== cls[e.s]) continue;
          const d = G.cheb(i, e.s);
          if (d < dc) { dc = d; jc = i; }
        }
        if (jc < 0) continue;
      }
      let da = 0, ja = -1;
      if (lay[e.p] !== e.a) {
        if (fixed[e.p]) continue;
        da = Infinity;
        for (let i = 0; i < P.SIZE; i++) {
          if (fixed[i] || lay[i] !== e.a || i === jc || cls[i] !== cls[e.p]) continue;
          const d = G.cheb(i, e.p);
          if (d < da) { da = d; ja = i; }
        }
        if (ja < 0) continue;
      }
      out.push({ e, v: dc + da, jc, ja });
    }
    out.sort((x, y) => x.v - y.v);
    return out;
  }

  // マス t に色 c を置く（確定マスは終わりに元どおり）。置けたら true、だめなら盤面を戻して false。
  //
  // まず狭い窓の直接探索を試す。見つからなければ入口ごとに分解する:
  //   1. 道具 a を押す場所 p に置く（再帰）
  //   2. p を仮に確定して、色 c を送り元 s に置く（再帰）
  //   3. p を押して t に送り込む
  //   4. それで崩れた確定マスを 1 つずつ置き直す（再帰。t は仮に確定）
  // 再帰の深さは 2 まで。深いところでは狭い窓の直接探索だけを行う。
  const PLACE_MAX_DEPTH = 2;

  function place(B, t, c, depth) {
    const { lay, fixed, goal } = B;
    if (lay[t] === c) return true;
    if (B.timeUp()) return false;
    const mark = B.plan.length;
    // 1 マスに使う時間の上限。長引くマスは後回しにしたほうが全体では速い。
    if (depth === 0) {
      const saved = B.timeUp.deadline;
      // 盤が大きいほど、また終盤（穴のまわりの輪）ほど 1 マスに時間をかける。
      // 盤の端や角は押せる場所が少なく手順が長くなるので、さらに時間を足す。
      const N = B.P.N, x = t % N, y = Math.floor(t / N);
      const edges = (x === 0 || x === N - 1 ? 1 : 0) + (y === 0 || y === N - 1 ? 1 : 0);
      const scale = (B.P.SIZE >= 81 ? 2 : B.P.SIZE >= 49 ? 1.5 : 1) * (B.left <= 25 ? 1.5 : 1) * (1 + edges);
      B.timeUp.deadline = Math.min(saved, performance.now() + PLACE_MS * scale);
      const ok = placeInner(B, t, c, depth, mark);
      B.timeUp.deadline = saved;
      return ok;
    }
    return placeInner(B, t, c, depth, mark);
  }

  const PLACE_MS = 250;

  function placeInner(B, t, c, depth, mark) {
    const { lay, fixed, goal } = B;

    let ranked = rankEntries(B, t, c);
    if (!ranked.length) return false;

    // 色のタイルが遠ければ、まず t の近くまで運ぶ（確定していない送り元があるときだけ）
    const freeSource = (r) => r.jc >= 0 && !fixed[r.jc];
    if (!ranked.some((r) => freeSource(r) && B.G.cheb(r.jc, t) <= 3)) {
      approach(B, t, c);
      ranked = rankEntries(B, t, c);
      if (!ranked.length) { B.undoTo(mark); return false; }
    }
    const top = ranked.find(freeSource) || ranked[0];

    // 直接探索。狭い窓から。運ぶタイルが遠ければ、そのまわりも窓に入れる。
    // 半径 2 の窓で押せるのは t から 3 以内のマスだけなので、それより遠いタイルは狭い窓では届かない。
    const far = top.jc >= 0 ? B.G.cheb(top.jc, t) : 0;
    if (far <= 3 && directPlace(B, t, c, [t], 2, depth === 0 ? 30000 : 15000)) return true;
    if (far >= 2 && directPlace(B, t, c, [t, top.jc], 2, depth === 0 ? 60000 : 30000)) return true;
    // 少し広い窓（道具の置き場も入れる）。分解より安いことが多いので先に試す。
    if (directPlace(B, t, c, [t, top.jc, top.ja], 3, depth === 0 ? 120000 : 60000)) return true;
    if (depth >= PLACE_MAX_DEPTH) { B.undoTo(mark); return false; }

    // 入口ごとの分解
    for (const { e, jc, ja } of ranked.slice(0, 4)) {
      if (B.timeUp()) break;
      let ok = true;
      const pWasFixed = fixed[e.p] === 1;
      const tWasFixed = fixed[t] === 1;
      if (lay[e.p] !== e.a) ok = place(B, e.p, e.a, depth + 1);
      if (ok) {
        fixed[e.p] = 1;
        ok = lay[e.s] === c || place(B, e.s, c, depth + 1);
        if (!pWasFixed) fixed[e.p] = 0;
      }
      if (ok && lay[e.p] === e.a && lay[e.s] === c) {
        B.doMove(e.p, e.dir);
        if (lay[t] === c) {
          fixed[t] = 1;
          for (let i = 0; i < fixed.length && ok; i++) {
            if (fixed[i] && lay[i] !== goal[i]) ok = place(B, i, goal[i], depth + 1);
          }
          if (!tWasFixed) fixed[t] = 0;
          if (ok) return true;
        }
      }
      B.undoTo(mark);
    }
    B.undoTo(mark);
    return false;
  }

  // 残ったマスをまとめて揃える。
  // まずマクロで（確定マスを崩さない手だけなので、残りのマスの配置だけを探せばよい）、
  // だめなら region の中で双方向 BFS、最後に評価つきの探索。
  function endgame(B, maxNodes = 400000, quick = false) {
    const { P, G, lay, fixed, goal } = B;
    const rest = [];
    for (let i = 0; i < P.SIZE; i++) if (!fixed[i]) rest.push(i);
    if (!rest.length) return true;
    const deadline = B.timeUp.deadline || Infinity;

    for (const [R, cap] of [[2, Math.round(maxNodes / 2)], [3, maxNodes]]) {
      if (B.timeUp()) return false;
      const A = makeArena(P, G, G.within(rest, R));
      const S0 = A.extract(lay);
      const SG = A.extract(goal);
      const fixedQ = [], freeQ = [];
      for (let k = 0; k < A.region.length; k++) (fixed[A.region[k]] ? fixedQ : freeQ).push(k);
      const bad = (S) => { let m = 0; for (const k of freeQ) if (S[k] !== SG[k]) m++; return m; };
      // マクロだけの探索は残りのマスの配置しか動かないので状態数が少ない（9 マスなら数万まで）。
      // 全部を見きれる上限にしておく。
      let found = macroSearch(A, S0, fixedQ, { isGoal: (S) => bad(S) === 0, h: (S) => 2 * bad(S), maxNodes: 400000, maxCost: 200, seeds: [SG] }, deadline);
      if (!found && !B.timeUp()) found = macroSearch(A, S0, fixedQ, { isGoal: (S) => bad(S) === 0, h: (S) => 2 * bad(S), maxNodes: 800000, maxCost: 400, deep: 3, colorClean: true, seeds: [SG] }, deadline);
      if (!found && !quick && !B.timeUp()) found = regionBidir(A, S0, SG, Math.round(cap / 2), deadline);
      if (!found && !quick && !B.timeUp()) {
        const badAll = (S) => { let m = 0; for (let k = 0; k < S.length; k++) if (S[k] !== SG[k]) m++; return m; };
        found = localSearch(A, S0, { isGoal: (S) => badAll(S) === 0, h: (S) => 2 * badAll(S), maxNodes: cap, maxDepth: 80 }, deadline);
      }
      if (found) { for (const [i, dir] of found) B.doMove(i, dir); return true; }
    }
    return false;
  }

  // region の中での双方向 BFS。両端が 1 つの状態なので確実に出会える範囲では最短。
  function regionBidir(arena, S0, SG, maxNodes, deadline) {
    const keyS = (S) => String.fromCharCode.apply(null, S);
    const k0 = keyS(S0), kG = keyS(SG);
    if (k0 === kG) return [];
    const mkSide = (S, k) => ({ seen: new Map([[k, null]]), frontier: [S] });
    const sides = [mkSide(S0, k0), mkSide(SG, kG)];
    const children = (S) => {
      const out = [];
      for (let ti = 0; ti < arena.table.length; ti++) {
        const t = arena.table[ti];
        const mv = t.byA[S[t.q]];
        if (!mv) continue;
        for (let dir = 1; dir >= -1; dir -= 2) {
          if (dir < 0 && mv.two) break;
          const NS = Uint8Array.from(S);
          applyMove(NS, mv.cyc, dir);
          out.push([NS, t.cell, dir]);
        }
      }
      return out;
    };
    // 出会った鍵から両側をたどる。目標側の手順は向きを反転して逆順に。
    const build = (meetKey) => {
      const head = [];
      for (let e = sides[0].seen.get(meetKey); e; e = sides[0].seen.get(e.pk)) head.push([e.i, e.dir]);
      head.reverse();
      const tail = [];
      for (let e = sides[1].seen.get(meetKey); e; e = sides[1].seen.get(e.pk)) tail.push([e.i, -e.dir]);
      return head.concat(tail);
    };
    let total = 2;
    while (sides[0].frontier.length && sides[1].frontier.length) {
      if (performance.now() > deadline || total > maxNodes) return null;
      const si = sides[0].frontier.length <= sides[1].frontier.length ? 0 : 1;
      const me = sides[si], other = sides[1 - si];
      const next = [];
      for (const S of me.frontier) {
        const pk = keyS(S);
        for (const [NS, i, dir] of children(S)) {
          const k = keyS(NS);
          if (me.seen.has(k)) continue;
          me.seen.set(k, { pk, i, dir });
          total++;
          if (other.seen.has(k)) return build(k);
          next.push(NS);
        }
      }
      me.frontier = next;
    }
    return null;
  }

  function constructive(P, start, goal, T, deadline, mode = 'rows', center = null) {
    const G = geometry(P);
    const B = makeBuilder(P, G, start, goal, deadline);
    B.timeUp.deadline = deadline;
    const { lay, fixed, plan } = B;
    const order = scanOrder(P.N, mode, center);
    const endCells = mode === 'band' ? 6 : ENDGAME_CELLS;
    let left = P.SIZE;

    const finishIfNear = () => {
      if (!T || !T.table.has(keyOf(lay))) return false;
      for (const mv of pathFromTable(P, lay, T)) plan.push(mv);
      return true;
    };
    const tryEnd = (cap) => finishIfNear() || endgame(B, cap);

    // 置けなかったマスは後回しにして先へ進む。後で周りが変われば置けることがある。
    // 最後まで揃えられなくても、そこまでの手順と盤面を返す（続きは別の方法に任せる）。
    const trace = constructive.trace = [];
    const result = (solved) => ({ plan, lay: Uint8Array.from(lay), solved, left });
    const deferred = [];
    const history = []; // 置いたマスと、その直前の手順の長さ（やり直し用）
    let retried = false;
    for (const t of order) {
      B.left = left;
      if (B.timeUp()) { trace.push({ t, what: 'timeout' }); return result(false); }
      if (fixed[t]) continue;
      if (left === endCells || left === 4) {
        // 後回しにしたマスがあれば、穴を崩さないうちに置き直しておく
        for (let k = deferred.length - 1; k >= 0; k--) {
          const d = deferred[k];
          if (lay[d] === goal[d] || place(B, d, goal[d], 0)) { fixed[d] = 1; left--; deferred.splice(k, 1); }
        }
        const t0 = performance.now();
        let ok = tryEnd(left <= 4 ? 300000 : 120000);
        trace.push({ t, what: 'end', left, ok, ms: Math.round(performance.now() - t0) });
        if (ok) return result(true);
        // 穴の配置が届く範囲に無いときは、直前に置いたマスを別の手順で置き直して配置を変える。
        // 届く配置の割合が 3 割でも、数回やり直せばたいてい当たる。
        if (!retried && mode === 'hole' && center) {
          retried = true;
          B.holeCells = [];
          for (let i = 0; i < P.SIZE; i++) if (!fixed[i]) B.holeCells.push(i);
          B.rejected = new Set();
          const holeKey = () => B.holeCells.map((i) => String.fromCharCode(lay[i])).join('');
          // 直前の 1 マスだけ置き直しても、同じ「届く範囲」の中で配置が変わるだけのことが多い。
          // 置き直すマスを 2 つ、3 つと増やすと、別の範囲へ移れる。
          for (let attempt = 0; attempt < 6 && history.length && !B.timeUp(); attempt++) {
            B.rejected.add(holeKey());
            const depth = Math.min(1 + Math.floor(attempt / 2), 3, history.length);
            const redo = history.slice(history.length - depth);
            B.undoTo(redo[0].mark);
            for (const h of redo) fixed[h.t] = 0;
            const t1 = performance.now();
            let re = true;
            for (const h of redo) {
              re = lay[h.t] === goal[h.t] || place(B, h.t, goal[h.t], 0);
              if (!re) break;
              fixed[h.t] = 1;
            }
            if (!re) {
              // 戻せなかったら、その分だけ履歴から外して次へ
              B.undoTo(redo[0].mark);
              for (const h of redo) fixed[h.t] = 0;
              history.length -= depth;
              left += depth;
              trace.push({ t: redo[0].t, what: 'retry', ok: false, ms: Math.round(performance.now() - t1) });
              break;
            }
            ok = finishIfNear() || endgame(B, 120000, true);
            trace.push({ t: redo[0].t, what: 'retry', ok, depth, ms: Math.round(performance.now() - t1) });
            if (ok) { B.rejected = null; return result(true); }
          }
          B.rejected = null;
        }
      }
      if (lay[t] !== goal[t]) {
        const t0 = performance.now(), before = plan.length;
        const ok = place(B, t, goal[t], 0);
        trace.push({ t, what: 'place', ok, ms: Math.round(performance.now() - t0), moves: plan.length - before });
        if (!ok) {
          deferred.push(t);
          if (deferred.length > 10) return result(false);
          continue;
        }
        history.push({ t, mark: before });
      }
      fixed[t] = 1;
      left--;
    }
    for (const t of deferred) {
      if (B.timeUp()) return result(false);
      if (lay[t] === goal[t] || place(B, t, goal[t], 0)) { fixed[t] = 1; left--; }
    }
    const t0 = performance.now();
    const ok = tryEnd(400000);
    trace.push({ t: -1, what: 'end', left, ok, ms: Math.round(performance.now() - t0) });
    return result(ok);
  }

  // ---- 5. 経路短縮 ----
  // 手順は「状態の列」でもある。ある地点から数手で列のもっと先の状態へ飛べるなら
  // 途中をまるごと省ける。目標側の表に当たれば、そこから先は最短で終われる。
  function shortcutPlan(P, plan, startLay, deadline, radius, T) {
    if (!plan || plan.length < 3) return plan;

    const states = [Uint8Array.from(startLay)];
    for (const [i, dir] of plan) {
      const nx = Uint8Array.from(states[states.length - 1]);
      applyMove(nx, P.cyc[nx[i]][i], dir);
      states.push(nx);
    }
    const latest = new Map();
    states.forEach((st, j) => latest.set(keyOf(st), j));

    const out = [];
    let pos = 0;
    while (pos < plan.length) {
      if (performance.now() > deadline) { out.push(...plan.slice(pos)); break; }

      let frontier = [{ lay: states[pos], path: [] }];
      const seen = new Set([keyOf(states[pos])]);
      let best = null;
      for (let d = 1; d <= radius && frontier.length; d++) {
        const next = [];
        for (const node of frontier) {
          for (const [i, dir] of movesOf(P, node.lay)) {
            const nl = stepTo(P, node.lay, i, dir);
            const k = keyOf(nl);
            if (seen.has(k)) continue;
            seen.add(k);
            const path = node.path.concat([[i, dir]]);

            const j = latest.get(k);
            if (j !== undefined && j - pos > d) {
              const gain = (j - pos) - d;
              if (!best || gain > best.gain) best = { gain, j, path };
            }
            const hd = T ? T.distOf(k) : -1;
            if (hd >= 0) {
              const gain = (plan.length - pos) - (d + hd);
              if (gain > 0 && (!best || gain > best.gain)) best = { gain, j: plan.length, path, finishFrom: nl };
            }
            next.push({ lay: nl, path });
          }
        }
        frontier = next;
      }

      if (best) {
        out.push(...best.path);
        if (best.finishFrom) { out.push(...pathFromTable(P, best.finishFrom, T)); pos = plan.length; }
        else pos = best.j;
      } else { out.push(plan[pos]); pos++; }
    }
    return out;
  }

  function shortcutRepeat(P, plan, startLay, deadline, radius, T, maxPass = 4) {
    let cur = plan;
    for (let pass = 0; pass < maxPass; pass++) {
      if (performance.now() > deadline) break;
      const next = shortcutPlan(P, cur, startLay, deadline, radius, T);
      if (next.length >= cur.length) break;
      cur = next;
    }
    return cur;
  }

  // ---- 手順の形の変換 ----
  // 「このマスを n 回押す」のまとまり（runs）と 1 手ずつの並び（plan）の相互変換。
  function planToRuns(P, plan, startLay) {
    const lay = Uint8Array.from(startLay);
    const runs = [];
    for (const [i, dir] of plan) {
      const cyc = P.cyc[lay[i]][i];
      const order = P.ord[lay[i]][i];
      const last = runs[runs.length - 1];
      if (last && last.i === i) {
        last.n = ((last.n + (dir > 0 ? 1 : order - 1)) % order + order) % order;
        if (last.n === 0) runs.pop();
      } else {
        runs.push({ i, n: dir > 0 ? 1 : order - 1, order });
      }
      applyMove(lay, cyc, dir);
    }
    return runs;
  }

  function runsToPlan(runs) {
    const plan = [];
    for (const r of runs) {
      const back = r.order - r.n;
      if (r.n <= back) for (let k = 0; k < r.n; k++) plan.push([r.i, 1]);
      else for (let k = 0; k < back; k++) plan.push([r.i, -1]);
    }
    return plan;
  }

  // 手数（まとまりごとに少ない側の向きを選んだ数）
  const planCost = (P, plan, startLay) =>
    planToRuns(P, plan, startLay).reduce((a, r) => a + Math.min(r.n, r.order - r.n), 0);

  // ---- 入口 ----
  // startLay: 今の絵柄の並び / goalLay: 目標の並び / fallbackPlan: 必ず解ける保険の手順（任意）
  // 戻り値: { plan: [[マス, 向き], ...], optimal: 最短だと保証できるか, method, ms, tried }
  function solvePuzzle(P, startLay, goalLay, budgetMs = 3000, fallbackPlan = null, report = null) {
    const t0 = performance.now();
    const deadline = t0 + budgetMs;
    const start = Uint8Array.from(startLay);
    const goal = Uint8Array.from(goalLay);
    const tried = {};

    if (keyOf(start) === keyOf(goal)) return { plan: [], optimal: true, method: 'solved', ms: 0, tried };

    // 状態 1 つに 100 バイト前後かかるので、表の大きさはマス数で抑える。
    // 大きい盤では厳密解は望めないので表は小さくし、時間は積み上げとビームに回す。
    const big = P.SIZE >= 64;
    const colors = new Set(goal).size;
    const tableCap = P.SIZE <= 25 ? 700000 : P.SIZE <= 36 ? 350000 : big ? 40000 : 150000;
    const fwdCap = tableCap;
    const share = (frac) => performance.now() + (deadline - performance.now()) * frac;

    // 1. 目標側の表
    const T = buildGoalTable(P, goal, tableCap, share(big ? 0.08 : 0.2));
    tried.table = T.table.size;

    const cands = [];
    // 途中経過。見つかった候補のうち最短のものを、そのつど呼び出し側に知らせる
    const tell = () => {
      if (!report || !cands.length) return;
      const b = cands.reduce((x, y) => (y.plan.length < x.plan.length ? y : x));
      report({ plan: b.plan, optimal: false, method: b.method, ms: performance.now() - t0, partial: true });
    };

    // 2. 厳密解（大きい盤では省く）
    if (!big) {
      const exact = bidirectional(P, start, T, fwdCap, share(0.3));
      if (exact && exact.optimal) {
        return { plan: exact.plan, optimal: true, method: 'bidirectional', ms: performance.now() - t0, tried };
      }
      if (exact) { cands.push({ plan: exact.plan, method: 'bidirectional' }); tell(); }
    }

    const limits = { beamWidth: 1200, beamDepth: 450 };
    const runBeam = (frac) => {
      const beam = bidirectionalBeam(P, start, goal, T, limits, share(frac));
      tried.beam = beam ? beam.length : null;
      if (beam) { cands.push({ plan: beam, method: 'beam' }); tell(); }
    };
    // 色数が少ない盤ではビームが最も短い手順を出すので先に走らせる。
    // 色数が多い盤ではビームはほぼ成功しないので、積み上げに時間を回す。
    const beamFirst = colors <= 4;
    if (beamFirst) runBeam(big ? 0.3 : P.SIZE <= 36 ? 0.45 : 0.35);

    // 3. 積み上げ。走査順を変えて 2 回まで試す（中央に残す順が色数の多い盤で強い）。
    //    途中で止まっても、ほぼ揃った盤面からビームで続きを探す。
    let partial = null;
    const G = geometry(P);
    const hole = P.N >= 5 ? pickHole(P, G, goal, share(0.12)) : null;
    tried.hole = hole ? `${hole.center} ${hole.orbit}/${hole.total}` : null;
    // 穴は評価の高い順に 3 つまで試す（豊かな穴が無い盤では、当たる配置になるかは運もある）
    const attempts = [];
    if (hole) for (const h of hole.ranked.slice(0, 3)) attempts.push({ mode: 'hole', center: h.center, label: `hole${h.center}` });
    attempts.push({ mode: 'spiral' }, { mode: 'rows' });
    for (const at of attempts) {
      if (performance.now() > deadline) break;
      // ビームが先に失敗した盤は難しいので、最初の積み上げに時間を多めに渡す
      const first = at === attempts[0];
      const cons = constructive(P, start, goal, T, share(first ? (beamFirst && tried.beam === null ? 0.75 : 0.6) : 0.5), at.mode, at.center || null);
      tried['constructive:' + (at.label || at.mode)] = cons.solved ? cons.plan.length : -cons.left;
      if (cons.solved) { cands.push({ plan: cons.plan, method: 'constructive' }); tell(); break; }
      if (!partial || cons.left < partial.left) partial = cons;
    }
    if (partial && partial.plan.length && performance.now() < deadline) {
      const tail = bidirectionalBeam(P, partial.lay, goal, T, limits, share(0.5));
      tried.consBeam = tail ? tail.length : null;
      if (tail) { cands.push({ plan: partial.plan.concat(tail), method: 'constructive+beam' }); tell(); }
    }
    if (!beamFirst && performance.now() < deadline) runBeam(0.6);

    // 5. 保険
    if (fallbackPlan && fallbackPlan.length) cands.push({ plan: fallbackPlan, method: 'reverse' });
    if (!cands.length) return { plan: null, optimal: false, method: 'none', ms: performance.now() - t0, tried };

    // 短い候補から順に経路短縮をかける
    const radius = P.SIZE <= 25 ? 3 : 2;
    cands.sort((x, y) => x.plan.length - y.plan.length);
    let best = null;
    for (const c of cands) {
      if (best && c.plan.length > 4 * best.plan.length + 20) break; // 明らかに長いものは省く
      const cut = shortcutRepeat(P, c.plan, start, deadline, radius, T);
      const cand = { plan: cut, method: c.method, raw: c.plan.length };
      if (!best || cand.plan.length < best.plan.length) best = cand;
      if (performance.now() > deadline) break;
    }

    return {
      plan: best.plan,
      optimal: false,
      method: best.method,
      shortcut: best.raw - best.plan.length,
      ms: performance.now() - t0,
      tried,
    };
  }

  return { solvePuzzle, planToRuns, runsToPlan, planCost, runPlan, keyOf };
}

// Worker の中で動かすときの入口。メインスレッドはこの関数の文字列を Blob にして Worker を作る。
function solverWorkerMain() {
  const api = solverModule();
  let P = null;
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'init') { P = m.problem; return; }
    if (m.type === 'solve' && P) {
      const res = api.solvePuzzle(P, m.start, m.goal, m.budget, m.fallback,
        (partial) => self.postMessage({ id: m.id, res: partial, partial: true }));
      self.postMessage({ id: m.id, res });
    }
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { solverModule };

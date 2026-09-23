// ---- 絵柄の描き方 ----
// 同じ 10 個の能力を、6 通りの描き方で起こす。設定から選べる。
//
// 能力そのものの情報は持たない。script.js から渡された「サイクル」
// （その能力が中身を送るマスの順序。ABILITIES[k].cells(0, 0) の戻り値）
// だけを見て、どのマスが動くか・どこへ行くか・何本の対かを読み取る。
// 能力を足しても消しても、ここを直す必要はない。
//
// どの描き方も viewBox 0 0 24 24。線も塗りも currentColor（＝タイル上のインク）。
// 3×3 の相対座標 -1 / 0 / 1 は、それぞれ 6 / 12 / 18 に対応する。
function glyphStyles() {
  const P = (d) => 12 + d * 6;
  const rad = (a) => (a * Math.PI) / 180;
  const ang = ([x, y]) => (Math.atan2(y, x) * 180) / Math.PI;
  const rot = (a, inner) => `<g transform="rotate(${a.toFixed(2)} 12 12)">${inner}</g>`;
  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${body}</svg>`;
  const n2 = (v) => v.toFixed(2);

  // 先端 (x,y)、進行方向 a（度）の矢じり
  const head = (x, y, a, s = 3.2) => {
    const r = rad(a), w = s * 0.5;
    const bx = x - Math.cos(r) * s, by = y - Math.sin(r) * s;
    const px = -Math.sin(r) * w, py = Math.cos(r) * w;
    return `<polygon points="${n2(x)},${n2(y)} ${n2(bx + px)},${n2(by + py)} ${n2(bx - px)},${n2(by - py)}"`
         + ' fill="currentColor" stroke="none"/>';
  };

  // サイクルから、描くのに要るものを読み取る。
  //   cells  動くマス（3×3 の相対座標）
  //   dest   その中身の行き先。回転なら次のマス、入れ替え・半回転なら相手のマス
  //   axes   対の軸の角度。入れ替えは 1 本、半回転はマス数 ÷ 2 本
  //   fam    swap（1 対）/ half（複数の対）/ rot（1 本の長いサイクル）
  function read(cycles) {
    const cells = cycles.flat();
    const dest = [];
    for (const c of cycles) c.forEach((_, i) => dest.push(c[(i + 1) % c.length]));
    const diag = ([x, y]) => x !== 0 && y !== 0;
    const reps = cycles.map((c) => c[0]);   // 各対の代表。軸の向きと長さはここから取る
    // 対が自分をまたいで向かい合っているか。「上下と左右を同時に入れ替え」の類は
    // またぐが、「四角の 4 すみの上と下」のように片側どうしで組む能力はまたがない。
    // またがない対は中心を通る線では描けないので、2 マスを直に結ぶ。
    const anti = cycles.every((c) => c.length === 2
      && c[1][0] === -c[0][0] && c[1][1] === -c[0][1]);
    return {
      cells, dest, reps, anti,
      pairs: cycles.filter((c) => c.length === 2).map((c) => [c[0], c[1]]),
      axes: reps.map(ang),
      fam: !cycles.length ? 'none'
        : cycles.length > 1 ? 'half' : cycles[0].length === 2 ? 'swap' : 'rot',
      allDiag: cells.every(diag),
    };
  }

  // 対の 2 マスを直に結ぶ弧。中心から遠ざかる側へ膨らませて、
  // あいだにある別のマス（下地の点）を通らないようにする。
  // 戻り値は d 属性と、両端での進む向き（矢じりを置くため）。
  function bowOf(p, q, h = 4.4) {
    const A = [P(p[0]), P(p[1])], B = [P(q[0]), P(q[1])];
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    const d = Math.hypot(mx - 12, my - 12) || 1;
    const C = [mx + ((mx - 12) / d) * h, my + ((my - 12) / d) * h];
    return {
      d: `M${A[0]} ${A[1]} Q${n2(C[0])} ${n2(C[1])} ${B[0]} ${B[1]}`,
      A, B, C,
      angA: ang([A[0] - C[0], A[1] - C[1]]),   // A 側の端で外を向く向き
      angB: ang([B[0] - C[0], B[1] - C[1]]),
    };
  }

  /* =========================================================
     点図 ── 3×3 の模式図
     輪が自分、濃い点が動くマス、弧と線が動き。
     回転の弧は点の外側を通し、点と重ならないようにしている。
     ========================================================= */
  const MOTION = {
    'link-h': '<path d="M6 12 Q12 5 18 12" stroke-width="1.3" opacity=".7"/>',
    'link-v': '<path d="M12 6 Q19 12 12 18" stroke-width="1.3" opacity=".7"/>',
    'link-d1': '<path d="M6 6 Q19 5 18 18" stroke-width="1.3" opacity=".7"/>',
    'link-d2': '<path d="M18 6 Q5 5 6 18" stroke-width="1.3" opacity=".7"/>',
    // 回転: 点より外側を回る 3/4 円 + 進行方向の矢じり（時計回りのみ）
    cw: '<path d="M12 2 A10 10 0 1 1 2 12" stroke-width="1.3" opacity=".8"/>'
      + '<polygon points="2,7.8 0.1,12.2 3.9,12.2" fill="currentColor" stroke="none"/>',
    // 半回転: 向かい合う 2 点を中心ごしに結ぶ。中心の輪の手前で切って、
    // 「自分を挟んで反対どうしが入れ替わる」ことを線の向きで示す。
    // 入れ替えの弧（1 本）と見分けがつくよう、こちらは直線で描く。
    'half-cross': '<path d="M12 6.6 V8.6 M12 15.4 V17.4 M6.6 12 H8.6 M15.4 12 H17.4"'
                + ' stroke-width="1.5" opacity=".8"/>',
    'half-diag': '<path d="M7.6 7.6 L9.9 9.9 M14.1 14.1 L16.4 16.4'
               + ' M16.4 7.6 L14.1 9.9 M9.9 14.1 L7.6 16.4" stroke-width="1.5" opacity=".8"/>',
    'half-ring': '<path d="M12 6.6 V8.6 M12 15.4 V17.4 M6.6 12 H8.6 M15.4 12 H17.4'
               + ' M7.6 7.6 L9.9 9.9 M14.1 14.1 L16.4 16.4'
               + ' M16.4 7.6 L14.1 9.9 M9.9 14.1 L7.6 16.4" stroke-width="1.5" opacity=".8"/>',
  };

  const motionOf = (a) => {
    if (a.fam === 'rot') return 'cw';
    if (a.fam === 'half') return a.cells.length === 8 ? 'half-ring' : a.allDiag ? 'half-diag' : 'half-cross';
    const [x, y] = a.cells[0];
    return y === 0 ? 'link-h' : x === 0 ? 'link-v' : x * y > 0 ? 'link-d1' : 'link-d2';
  };

  function drawDots(a) {
    const parts = [];
    for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
      if (dx === 0 && dy === 0) continue;
      parts.push(`<circle cx="${P(dx)}" cy="${P(dy)}" r="1.1" fill="currentColor" stroke="none" opacity=".2"/>`);
    }
    // またぐ対は決め打ちの形、またがない対は 2 マスを直に結ぶ
    if (a.fam === 'half' && !a.anti) {
      for (const [p, q] of a.pairs) {
        parts.push(`<path d="${bowOf(p, q).d}" stroke-width="1.5" opacity=".8"/>`);
      }
    } else {
      parts.push(MOTION[motionOf(a)]);   // 弧や矢印は点の下に敷く
    }
    for (const [dx, dy] of a.cells) {
      parts.push(`<circle cx="${P(dx)}" cy="${P(dy)}" r="2.2" fill="currentColor" stroke="none"/>`);
    }
    parts.push('<circle cx="12" cy="12" r="2.9" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".9"/>');
    return svg(parts.join(''));
  }

  /* =========================================================
     標識 ── 動きだけを大きく描く
     入れ替えと半回転は軸ごとの両向き矢印（軸の数 = 動くマス数 ÷ 2）。
     回転は効果の及ぶ方角に輻を張り、外周の 3/4 の輪が「回る」ことを言う。
     上下左右なら ⊕、斜めなら ⊗、周囲 8 なら 8 本車輪になる。
     ========================================================= */
  function drawSign(a) {
    const parts = [];
    if (a.fam === 'rot') {
      for (const [dx, dy] of a.cells) {
        parts.push(rot(ang([dx, dy]), '<path d="M14.6 12 H21" stroke-width="2.1" stroke-linecap="round"/>'));
      }
      parts.push('<path d="M12 2.6 A9.4 9.4 0 1 1 2.6 12" stroke-width="1.7" stroke-linecap="round" opacity=".9"/>');
      parts.push(head(2.6, 11.9, 270, 3.6));   // 時計回りなので、西の端では上を向く
      parts.push('<circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.7"/>');
    } else if (a.anti) {
      for (const ax of a.axes) {
        // 中央の輪を避けて左右に分けた両向き矢印
        parts.push(rot(ax,
          '<path d="M6.4 12 H9.2 M14.8 12 H17.6" stroke-width="1.9" stroke-linecap="round"/>'
          + head(4.2, 12, 180, 3.4) + head(19.8, 12, 0, 3.4)));
      }
      parts.push('<circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".85"/>');
    } else {
      // またがない対。2 マスのあいだを両向きの矢印で結ぶ
      for (const [p, q] of a.pairs) {
        const b = bowOf(p, q, 3.4);
        parts.push(`<path d="${b.d}" stroke-width="1.9" stroke-linecap="round"/>`);
        parts.push(head(b.A[0], b.A[1], b.angA, 3.4));
        parts.push(head(b.B[0], b.B[1], b.angB, 3.4));
      }
      parts.push('<circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".85"/>');
    }
    return svg(parts.join(''));
  }

  /* =========================================================
     升目 ── 3×3 を実際のマスとして描く
     動くマスは塗り、その中に行き先を指す三角を地の色で抜く。自分は枠だけ。
     ========================================================= */
  function drawGrid(a, bg) {
    const s = 5.1, r = 1.2;
    const sq = (dx, dy, attr) =>
      `<rect x="${n2(P(dx) - s / 2)}" y="${n2(P(dy) - s / 2)}" width="${s}" height="${s}" rx="${r}" ${attr}/>`;
    const hit = new Set(a.cells.map(([x, y]) => `${x},${y}`));
    const parts = [];
    for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
      if (dx === 0 && dy === 0) continue;
      if (!hit.has(`${dx},${dy}`)) parts.push(sq(dx, dy, 'fill="none" stroke="currentColor" stroke-width=".85" opacity=".16"'));
    }
    for (const [dx, dy] of a.cells) parts.push(sq(dx, dy, 'fill="currentColor" stroke="none" opacity=".95"'));
    parts.push(sq(0, 0, 'fill="none" stroke="currentColor" stroke-width="1.5" opacity=".9"'));
    a.cells.forEach(([dx, dy], i) => {
      const [ex, ey] = a.dest[i];
      const u = rad(ang([ex - dx, ey - dy]));
      const cx = P(dx), cy = P(dy), L = 2.05, w = 1.55;
      const tx = cx + Math.cos(u) * L, ty = cy + Math.sin(u) * L;
      const bx = cx - Math.cos(u) * L * 0.75, by = cy - Math.sin(u) * L * 0.75;
      const px = -Math.sin(u) * w, py = Math.cos(u) * w;
      parts.push(`<polygon points="${n2(tx)},${n2(ty)} ${n2(bx + px)},${n2(by + py)} ${n2(bx - px)},${n2(by - py)}"`
               + ` fill="${bg}" stroke="none"/>`);
    });
    return svg(parts.join(''));
  }

  /* =========================================================
     単形 ── 塗りの形だけ。線も矢じりも使わない
     腕の数が動くマスの数、腕の向きがその方角、長さが実際の距離
     （斜めは √2 倍遠い）。回転だけ花びらを時計回りに寝かせる。
     ========================================================= */
  const ARM = '<rect x="13.9" y="9.9" width="4.8" height="4.2" rx="1.3" fill="currentColor" stroke="none"/>';
  const PETAL = '<path d="M12.9 14.6 Q9.4 7.0 15.6 4.3 Q18.4 9.9 12.9 14.6 Z" fill="currentColor" stroke="none"/>';

  // 2 マスを結ぶ太い棒（単形のためのもの）
  function barOf(p, q, t = 4.2) {
    const A = [P(p[0]), P(p[1])], B = [P(q[0]), P(q[1])];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    return `<g transform="rotate(${n2(ang([B[0] - A[0], B[1] - A[1]]))} ${n2(mx)} ${n2(my)})">`
      + `<rect x="${n2(mx - len / 2 - t / 2)}" y="${n2(my - t / 2)}" width="${n2(len + t)}" height="${t}"`
      + ` rx="${t / 2}" fill="currentColor" stroke="none"/></g>`;
  }

  function drawSolid(a) {
    const parts = [];
    if (a.fam === 'half' && !a.anti) {
      // またがない対。中心から腕を伸ばすと「斜め 4 マス」と同じ形になってしまうので、
      // 2 マスのあいだを棒で結んで、どことどこが入れ替わるかを示す。
      for (const [p, q] of a.pairs) parts.push(barOf(p, q));
      parts.push('<circle cx="12" cy="12" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".9"/>');
      return svg(parts.join(''));
    }
    for (const [dx, dy] of a.cells) {
      const k = Math.hypot(dx, dy);                 // 1 か √2
      if (a.fam === 'rot') {
        parts.push(rot(ang([dx, dy]) - 270,
          `<g transform="translate(12 12) scale(${k.toFixed(3)}) translate(-12 -12)">${PETAL}</g>`));
      } else {
        parts.push(rot(ang([dx, dy]),
          `<g transform="translate(12 12) scale(${k.toFixed(3)} 1) translate(-12 -12)">${ARM}</g>`));
      }
    }
    if (a.fam !== 'rot') {
      parts.push('<circle cx="12" cy="12" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".9"/>');
    }
    return svg(parts.join(''));
  }

  /* =========================================================
     結線 ── 置換をそのまま図にする
     回転は動くマスを順に結んだ閉じた輪（◇・□・八角）、
     入れ替えは 2 マスを回る細長い循環、半回転は自分をまたぐ直線。
     ========================================================= */
  function drawWire(a) {
    const parts = [];
    for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
      if (dx === 0 && dy === 0) continue;
      parts.push(`<circle cx="${P(dx)}" cy="${P(dy)}" r=".9" fill="currentColor" stroke="none" opacity=".18"/>`);
    }

    if (a.fam === 'rot') {
      const d = a.cells.map(([x, y], i) => `${i ? 'L' : 'M'}${P(x)} ${P(y)}`).join(' ') + ' Z';
      parts.push(`<path d="${d}" stroke-width="1.5" stroke-linejoin="round" opacity=".85"/>`);
      a.cells.forEach(([x, y], i) => {
        const [nx, ny] = a.dest[i];
        const mx = (P(x) + P(nx)) / 2, my = (P(y) + P(ny)) / 2;
        const t = ang([P(nx) - P(x), P(ny) - P(y)]);
        parts.push(head(mx + Math.cos(rad(t)) * 1.2, my + Math.sin(rad(t)) * 1.2, t, 2.9));
      });
      for (const [dx, dy] of a.cells) parts.push(`<circle cx="${P(dx)}" cy="${P(dy)}" r="1.8" fill="currentColor" stroke="none"/>`);

    } else if (a.fam === 'swap') {
      const [A, B] = a.cells.map(([x, y]) => [P(x), P(y)]);
      const vx = B[0] - A[0], vy = B[1] - A[1];
      const len = Math.hypot(vx, vy);
      const nx = -vy / len, ny = vx / len;          // 進行方向の左手
      const t = ang([vx, vy]);
      const h = 5.6;                                // 頂点は中心から h/2 離れる
      for (const sgn of [1, -1]) {
        const [S, E] = sgn > 0 ? [A, B] : [B, A];
        parts.push(`<path d="M${S[0]} ${S[1]} Q${n2(12 + nx * h * sgn)} ${n2(12 + ny * h * sgn)} ${E[0]} ${E[1]}"`
                 + ' stroke-width="1.4" opacity=".85"/>');
        const ax = 12 + nx * (h / 2) * sgn, ay = 12 + ny * (h / 2) * sgn;
        const d = sgn > 0 ? 1.4 : -1.4;
        parts.push(head(ax + Math.cos(rad(t)) * d, ay + Math.sin(rad(t)) * d, sgn > 0 ? t : t + 180, 2.9));
      }
      for (const [dx, dy] of a.cells) parts.push(`<circle cx="${P(dx)}" cy="${P(dy)}" r="1.8" fill="currentColor" stroke="none"/>`);

    } else if (!a.anti) {
      // またがない対。2 マスを弧で結び、両端に矢じりを置く
      for (const [p, q] of a.pairs) {
        const b = bowOf(p, q, 3.8);
        parts.push(`<path d="${b.d}" stroke-width="1.4" opacity=".85"/>`);
        parts.push(head(b.A[0], b.A[1], b.angA, 2.6));
        parts.push(head(b.B[0], b.B[1], b.angB, 2.6));
      }
      for (const [dx, dy] of a.cells) parts.push(`<circle cx="${P(dx)}" cy="${P(dy)}" r="1.5" fill="currentColor" stroke="none"/>`);
    } else {
      // 矢じりが行き先のマスに着地する
      a.reps.forEach((rep, i) => {
        const ax = a.axes[i];
        const L = 6 * Math.hypot(rep[0], rep[1]);   // 上下左右なら 6、斜めなら 6√2
        for (const s of [0, 180]) {
          const u = rad(ax + s), ux = Math.cos(u), uy = Math.sin(u);
          parts.push(`<path d="M${n2(12 + ux * 3)} ${n2(12 + uy * 3)} L${n2(12 + ux * (L - 2.2))} ${n2(12 + uy * (L - 2.2))}"`
                   + ' stroke-width="1.4" stroke-linecap="round" opacity=".85"/>');
          parts.push(head(12 + ux * L, 12 + uy * L, ax + s, 2.5));
        }
      });
    }

    parts.push(`<circle cx="12" cy="12" r="${a.fam === 'swap' ? 1.9 : 2.3}" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".9"/>`);
    return svg(parts.join(''));
  }

  /* =========================================================
     直線 ── 直線だけ。点も矢じりも輪もない
     入れ替えは対を結ぶ 1 本、半回転は対の本数だけ交差させる。
     回転は動くマスを結んだ多角形で、上下左右なら菱形、斜めなら
     正方形、周囲 8 なら八角形。頂点の数がそのまま動くマスの数。
     ========================================================= */
  function drawLine(a) {
    const attr = 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    if (a.fam === 'rot') {
      // 菱形は角が上下左右に来るぶん大きく見えるので、正方形だけ外接を広く取る（目の補正）。
      const R = a.allDiag ? 9.9 : 8.6;
      const d = a.cells.map(([x, y], i) => {
        const u = rad(ang([x, y]));
        return `${i ? 'L' : 'M'}${n2(12 + Math.cos(u) * R)} ${n2(12 + Math.sin(u) * R)}`;
      }).join(' ') + ' Z';
      return svg(`<path d="${d}" ${attr}/>`);
    }
    // またがない対は中心を通らない。2 マスを直に結ぶ。
    const d = a.anti
      ? a.axes.map((ax) => {
        const u = rad(ax), L = 7.6, cx = Math.cos(u) * L, cy = Math.sin(u) * L;
        return `M${n2(12 - cx)} ${n2(12 - cy)} L${n2(12 + cx)} ${n2(12 + cy)}`;
      }).join(' ')
      : a.pairs.map(([p, q]) => `M${P(p[0])} ${P(p[1])} L${P(q[0])} ${P(q[1])}`).join(' ');
    return svg(`<path d="${d}" ${attr}/>`);
  }

  // 並びは具体的なものから抽象的なものへ。
  // legend は説明パネルの「絵柄の読み方」。描き方を変えたら読み方も変わるので、
  // 文章もここに一緒に置いて取り違えないようにする。
  const STYLES = [
    { id: 'dots', name: '点図', note: '3×3 の模式図', draw: drawDots, legend: [
      '薄い点＝周囲のマス、輪＝<strong>自分</strong>（動かない）。',
      '濃い点＝効果を受けるマス。',
      '線で結ばれた 2 点は<strong>入れ替え</strong>。',
      '矢印つきの弧は、その順に<strong>1 つ回す</strong>。',
      '短い線が 2 本ずつ重なっているものは、<strong>向かい合う組が同時に入れ替わる</strong>（回転の半分ぶん）。',
    ] },
    { id: 'grid', name: '升目', note: 'マスと行き先の矢印', draw: drawGrid, legend: [
      '薄い枠＝周囲のマス、太い枠＝<strong>自分</strong>（動かない）。',
      '塗られたマスが<strong>効果を受けるマス</strong>。',
      'マスの中の三角は、その中身が<strong>向かう先</strong>。',
      '三角が互いを指していれば入れ替え、ぐるりと同じ向きなら回転。',
    ] },
    { id: 'wire', name: '結線', note: '置換の図', draw: drawWire, legend: [
      '薄い点＝周囲のマス、輪＝<strong>自分</strong>（動かない）。',
      '濃い点＝効果を受けるマス。',
      '閉じた輪（菱形・正方形・八角）は、その順に<strong>1 つ回す</strong>。',
      '2 点を回る細長い輪は<strong>入れ替え</strong>。',
      '自分をまたぐ直線は、向かい合う組が<strong>同時に入れ替わる</strong>。',
    ] },
    { id: 'sign', name: '標識', note: '矢印と車輪', draw: drawSign, legend: [
      '輪＝<strong>自分</strong>（動かない）。周囲のマスは描かない。',
      '両向きの矢印は、その線の<strong>両端が入れ替わる</strong>。矢印の本数だけ同時に起きる。',
      '車輪は<strong>時計回り</strong>。輻が伸びている方角のマスが動く。',
      '輻が上下左右なら ⊕、斜めなら ⊗、8 本なら周囲ぜんぶ。',
    ] },
    { id: 'solid', name: '単形', note: '塗りの形だけ', draw: drawSolid, legend: [
      '輪＝<strong>自分</strong>（動かない）。',
      '腕の<strong>数</strong>が動くマスの数、<strong>向き</strong>がその方角、<strong>長さ</strong>が距離（斜めは √2 倍長い）。',
      'まっすぐな腕は<strong>入れ替え</strong>。2 本以上あれば同時に起きる。',
      '寝かせた花びらは<strong>時計回り</strong>の回転。',
    ] },
    { id: 'line', name: '直線', note: '線と多角形だけ', draw: drawLine, legend: [
      '直線 1 本が 1 組の<strong>入れ替え</strong>。本数だけ同時に起きる。',
      '多角形は<strong>時計回り</strong>の回転。頂点の数が動くマスの数。',
      '菱形＝上下左右の 4 マス、正方形＝斜めの 4 マス、八角形＝周囲 8 マス。',
      '自分は描かない。押したマス自身はいつも動かない。',
    ] },
  ];
  const DEFAULT = 'dots';

  const byId = (id) => STYLES.find((s) => s.id === id) || STYLES[0];

  // cycles は ABILITIES[k].cells(0, 0)、bg はそのタイルの地の色。
  // 何も起きないマスは、どの描き方でも絵柄を持たない。
  // 「押しても何も起きない」を、描かないことで示す（暗い地の色がその合図）。
  const draw = (styleId, cycles, bg) => {
    const a = read(cycles);
    return a.fam === 'none' ? svg('') : byId(styleId).draw(a, bg);
  };

  return { STYLES, DEFAULT, draw, byId, has: (id) => STYLES.some((s) => s.id === id) };
}

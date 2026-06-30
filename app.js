const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function fmt(n, d = 4) {
  return Number(n).toFixed(d);
}

/* ---------- shared SVG plotting helper ---------- */
function buildFrame(W, H, pad, xLim, yLim) {
  const plotW = W - pad * 2,
    plotH = H - pad * 2;
  const toSx = (x) => pad + ((x + xLim) / (2 * xLim)) * plotW;
  const toSy = (y) => pad + plotH - ((y + yLim) / (2 * yLim)) * plotH;

  // smart tick step: keeps tick count between ~4 and ~10 regardless of scale
  function tickStep(range) {
    const raw = range / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    if (norm <= 1) return mag;
    if (norm <= 2) return 2 * mag;
    if (norm <= 5) return 5 * mag;
    return 10 * mag;
  }

  const xStep = tickStep(2 * xLim);
  const yStep = tickStep(2 * yLim);

  let svg = "";

  // grid lines — one per integer (fine grid, subtle)
  for (let gx = Math.ceil(-xLim); gx <= Math.floor(xLim); gx++) {
    const sx = toSx(gx);
    const isAxis = gx === 0;
    svg += `<line x1="${sx}" y1="${pad}" x2="${sx}" y2="${H - pad}" stroke="${isAxis ? "#a89c87" : "#ded5bd"}" stroke-width="${isAxis ? 1.5 : 0.5}"/>`;
  }
  for (let gy = Math.ceil(-yLim); gy <= Math.floor(yLim); gy++) {
    const sy = toSy(gy);
    const isAxis = gy === 0;
    svg += `<line x1="${pad}" y1="${sy}" x2="${W - pad}" y2="${sy}" stroke="${isAxis ? "#a89c87" : "#ded5bd"}" stroke-width="${isAxis ? 1.5 : 0.5}"/>`;
  }

  // axis tick marks + number labels — only at step multiples, skip 0
  const x0 = toSx(0),
    y0 = toSy(0);
  const TICK = 4; // tick mark half-length in px

  // x-axis ticks
  for (let v = -xLim; v <= xLim + 1e-9; v += xStep) {
    const rounded = Math.round(v / xStep) * xStep;
    if (Math.abs(rounded) < xStep * 0.01) continue; // skip 0
    const sx = toSx(rounded);
    const label = Number(rounded.toPrecision(6)).toString();
    svg += `<line x1="${sx}" y1="${y0 - TICK}" x2="${sx}" y2="${y0 + TICK}" stroke="#74695a" stroke-width="1.2"/>`;
    svg += `<text x="${sx}" y="${y0 + 16}" font-family="JetBrains Mono, monospace" font-size="10" fill="#74695a" text-anchor="middle">${label}</text>`;
  }

  // y-axis ticks
  for (let v = -yLim; v <= yLim + 1e-9; v += yStep) {
    const rounded = Math.round(v / yStep) * yStep;
    if (Math.abs(rounded) < yStep * 0.01) continue; // skip 0
    const sy = toSy(rounded);
    const label = Number(rounded.toPrecision(6)).toString();
    svg += `<line x1="${x0 - TICK}" y1="${sy}" x2="${x0 + TICK}" y2="${sy}" stroke="#74695a" stroke-width="1.2"/>`;
    svg += `<text x="${x0 - 8}" y="${sy + 4}" font-family="JetBrains Mono, monospace" font-size="10" fill="#74695a" text-anchor="end">${label}</text>`;
  }

  // origin label
  svg += `<text x="${x0 + 5}" y="${y0 + 14}" font-family="JetBrains Mono, monospace" font-size="10" fill="#a89c87">0</text>`;

  // axis name labels
  svg += `<text x="${W - pad + 10}" y="${y0 + 4}" font-family="JetBrains Mono, monospace" font-size="12" fill="#74695a" font-weight="600">x</text>`;
  svg += `<text x="${x0 - 4}" y="${pad - 10}" font-family="JetBrains Mono, monospace" font-size="12" fill="#74695a" font-weight="600" text-anchor="middle">y</text>`;

  return { svg, toSx, toSy, plotW, plotH };
}

function pathFrom(pts, xKey, yKey, toSx, toSy) {
  let d = "";
  pts.forEach((p, idx) => {
    const sx = toSx(p[xKey]),
      sy = toSy(p[yKey]);
    d += (idx === 0 ? "M" : "L") + sx.toFixed(2) + "," + sy.toFixed(2) + " ";
  });
  return d;
}

function loadLabel(n) {
  if (n <= 14) return { text: "Rendah", cls: "ok" };
  if (n <= 60) return { text: "Sedang", cls: "" };
  return { text: "Tinggi", cls: "warn" };
}

/* ---------- coordinate crosshair + label ----------
   Dotted projection lines to BOTH axes (x and y), plus a boxed
   "(x, y)" label near the point. Styled clearly different from the
   plain axis tick numbers: colored, pill-background, same font but
   with a filled rect behind it so it reads as a data annotation.
*/
function coordCallout(sx, sy, toSx, toSy, xVal, yVal, opts = {}) {
  const color = opts.color || "#272318";
  const bgColor = opts.bgColor || "#fffcf4";
  const x0 = toSx(0); // x-axis line (x=0 in data space → pixel)
  const y0 = toSy(0); // y-axis line

  const labelDx = opts.labelDx ?? (sx > x0 ? 7 : -7);
  const labelDy = opts.labelDy ?? (sy < y0 ? -10 : 14);
  const anchor = sx > x0 ? "start" : "end";

  const xFmt = Number(xVal.toPrecision(4));
  const yFmt = Number(yVal.toPrecision(4));
  const text = `(${xFmt}, ${yFmt})`;
  const charW = 6.2; // approx px per char at font-size 9.5
  const bw = text.length * charW + 6;
  const bh = 14;
  const bx = anchor === "start" ? sx + labelDx - 3 : sx + labelDx - bw + 3;
  const by = sy + labelDy - 10;

  let s = "";
  // projection to x-axis (vertical dashed line down to y=0)
  s += `<line x1="${sx}" y1="${sy}" x2="${sx}" y2="${y0}" stroke="${color}" stroke-width="0.9" stroke-dasharray="3,3" opacity="0.45"/>`;
  // projection to y-axis (horizontal dashed line across to x=0)
  s += `<line x1="${sx}" y1="${sy}" x2="${x0}" y2="${sy}" stroke="${color}" stroke-width="0.9" stroke-dasharray="3,3" opacity="0.45"/>`;
  // small tick on x-axis at projected x position
  s += `<line x1="${sx}" y1="${y0 - 3}" x2="${sx}" y2="${y0 + 3}" stroke="${color}" stroke-width="1.2" opacity="0.6"/>`;
  // small tick on y-axis at projected y position
  s += `<line x1="${x0 - 3}" y1="${sy}" x2="${x0 + 3}" y2="${sy}" stroke="${color}" stroke-width="1.2" opacity="0.6"/>`;
  // label pill background
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="${bgColor}" stroke="${color}" stroke-width="0.8" opacity="0.92"/>`;
  // label text
  s += `<text x="${sx + labelDx}" y="${sy + labelDy}" font-family="JetBrains Mono, monospace" font-size="9.5" fill="${color}" text-anchor="${anchor}">${text}</text>`;
  return s;
}

/* ---------- t1 / t2 endpoint markers ----------
   Diamond shape (rotated square) + "t=value" badge above it.
   Visually distinct from:
     - iteration dots (plain circle, white fill, colored stroke)
     - coordinate callout labels (pill box, (x,y) format)
   These specifically mark WHERE on the curve t starts and ends.
*/
function tEndpointMarker(sx, sy, tVal, label, opts = {}) {
  const color = opts.color || "#5b3fa8"; // purple — distinct from sienna/teal/ochre
  const size = opts.size || 7;
  // diamond = rotated square drawn as a polygon
  const pts = [
    `${sx},${sy - size}`,
    `${sx + size},${sy}`,
    `${sx},${sy + size}`,
    `${sx - size},${sy}`,
  ].join(" ");
  const text = `${label}: t=${Number(tVal.toPrecision(4))}`;
  const charW = 6;
  const bw = text.length * charW + 8;
  const bh = 14;
  const above = opts.above ?? true;
  const bx = sx - bw / 2;
  const by = above ? sy - size - bh - 4 : sy + size + 4;
  let s = "";
  s += `<polygon points="${pts}" fill="${color}" stroke="#fffcf4" stroke-width="1.5" opacity="0.92"/>`;
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="${color}" opacity="0.88"/>`;
  s += `<text x="${sx}" y="${by + 10}" font-family="JetBrains Mono, monospace" font-size="9" fill="#fffcf4" text-anchor="middle" font-weight="600">${text}</text>`;
  return s;
}

/* ---------- looping tracer dot ----------
   Visualizes "parameter t sweeping along the curve" — the actual
   conceptual point of parametric generation, not just decoration.
   Uses native SVG <animateMotion> so it restarts cleanly every time
   the SVG is rebuilt via innerHTML (no JS animation loop to manage).
*/
function tracerMarkup(pathD, opts = {}) {
  const dur = opts.duration || 5.5;
  const color = opts.color || "#c4862a";
  const radius = opts.radius || 6;
  const glow = opts.glow || color;
  return `
    <circle r="${radius + 3}" fill="${glow}" opacity="0.18">
      <animateMotion dur="${dur}s" repeatCount="indefinite" path="${pathD}" rotate="auto"/>
    </circle>
    <circle r="${radius}" fill="${color}" stroke="#fffcf4" stroke-width="1.6">
      <animateMotion dur="${dur}s" repeatCount="indefinite" path="${pathD}" rotate="auto"/>
    </circle>`;
}

/* animate a metric value bump (subtle, not bouncy) */
function bumpValue(el) {
  if (!window.gsap) return;
  gsap.fromTo(
    el,
    { color: "#9c3f24" },
    { color: "", duration: 0.5, clearProps: "color", ease: "power1.out" },
  );
}

/* ============================================================
   CIRCLE
   ============================================================ */
function initCircle() {
  const ns = "circle";
  const elR = $("#circle-r"),
    elXc = $("#circle-xc"),
    elYc = $("#circle-yc");
  const elDelta = $("#circle-delta"),
    elShow = $("#circle-showPoints");
  let unit = "radian";
  $(`[data-unit-toggle="${ns}"]`).addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    $$(`[data-unit-toggle="${ns}"] button`).forEach((b) =>
      b.classList.remove("active"),
    );
    btn.classList.add("active");
    unit = btn.dataset.unit;
    render();
  });

  function compute(r, xc, yc, delta) {
    const pts = [];
    let i = 0;
    for (let t = 0; t <= 2 * Math.PI + 1e-9; t += delta) {
      pts.push({ i, t, x: xc + r * Math.cos(t), y: yc + r * Math.sin(t) });
      i++;
    }
    return pts;
  }

  function render() {
    const r = parseFloat(elR.value),
      xc = parseFloat(elXc.value),
      yc = parseFloat(elYc.value);
    const delta = parseFloat(elDelta.value);

    $(`[data-out="${ns}-r"]`).textContent = fmt(r, 2);
    $(`[data-out="${ns}-xc"]`).textContent = fmt(xc, 2);
    $(`[data-out="${ns}-yc"]`).textContent = fmt(yc, 2);
    $(`[data-out="${ns}-delta"]`).textContent = fmt(delta, 3) + " rad";

    const pts = compute(r, xc, yc, delta);
    const n = pts.length;

    $(`[data-out="${ns}-n"]`).textContent = n;
    $(`[data-out="${ns}-evals"]`).textContent = n * 2;
    $(`[data-out="${ns}-segments"]`).textContent = n; // closed loop
    const lb = loadLabel(n);
    const loadEl = $(`[data-out="${ns}-load"]`);
    loadEl.textContent = lb.text + " (" + n + " iterasi)";
    loadEl.className = "v " + lb.cls;

    $(`[data-out="${ns}-badge"]`).textContent = "n = " + n + " titik";
    $(`[data-out="${ns}-tablebadge"]`).textContent = n + " baris";

    const W = 760,
      H = 560,
      pad = 40;
    const lim = Math.max(5, r * 1.6 + Math.max(Math.abs(xc), Math.abs(yc)));
    const { svg: base, toSx, toSy } = buildFrame(W, H, pad, lim, lim * 0.74);

    let svg = base;
    const closed = [...pts, pts[0]];
    const circlePathD = pathFrom(closed, "x", "y", toSx, toSy);
    svg += `<path d="${circlePathD}" fill="none" stroke="#9c3f24" stroke-width="2.4" stroke-linejoin="round"/>`;

    if (elShow.checked) {
      pts.forEach((p) => {
        svg += `<circle cx="${toSx(p.x)}" cy="${toSy(p.y)}" r="4.2" fill="#fffcf4" stroke="#9c3f24" stroke-width="1.6"/>`;
      });
    }

    // callouts: show every Nth point so diagram stays readable
    const calloutEvery = n > 16 ? Math.ceil(n / 8) : 2;
    pts.forEach((p, idx) => {
      if (idx % calloutEvery !== 0) return;
      svg += coordCallout(toSx(p.x), toSy(p.y), toSx, toSy, p.x, p.y);
    });

    svg += `<circle cx="${toSx(xc)}" cy="${toSy(yc)}" r="5" fill="#c4862a" stroke="#272318" stroke-width="1"/>`;
    svg += `<text x="${toSx(xc) + 9}" y="${toSy(yc) - 9}" font-family="JetBrains Mono, monospace" font-size="11" fill="#272318">(${fmt(xc, 1)}, ${fmt(yc, 1)})</text>`;
    svg += tracerMarkup(circlePathD, {
      duration: Math.max(3, 2 * Math.PI * 1.6),
    });

    $("#circle-plot").innerHTML = svg;

    const th = $(`[data-th="${ns}-t"]`);
    th.textContent =
      unit === "radian"
        ? "t (rad)"
        : unit === "degree"
          ? "t (\u00B0)"
          : "t (rad / \u00B0)";

    let rows = "";
    pts.forEach((p) => {
      const deg = (p.t * 180) / Math.PI;
      let tD =
        unit === "radian"
          ? fmt(p.t, 4)
          : unit === "degree"
            ? fmt(deg, 2) + "\u00B0"
            : fmt(p.t, 3) + " / " + fmt(deg, 1) + "\u00B0";
      rows += `<tr><td>${p.i}</td><td>${tD}</td><td>${fmt(p.x)}</td><td>${fmt(p.y)}</td></tr>`;
    });
    $(`[data-out="${ns}-tbody"]`).innerHTML = rows;
  }

  [elR, elXc, elYc, elDelta, elShow].forEach((el) =>
    el.addEventListener("input", render),
  );
  render();
}

/* ============================================================
   ELLIPSE
   ============================================================ */
function initEllipse() {
  const ns = "ellipse";
  const elA = $("#ellipse-a"),
    elB = $("#ellipse-b");
  const elDelta = $("#ellipse-delta"),
    elShow = $("#ellipse-showPoints");
  let unit = "radian";
  $(`[data-unit-toggle="${ns}"]`).addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    $$(`[data-unit-toggle="${ns}"] button`).forEach((b) =>
      b.classList.remove("active"),
    );
    btn.classList.add("active");
    unit = btn.dataset.unit;
    render();
  });

  function compute(a, b, delta) {
    const pts = [];
    let i = 0;
    for (let t = 0; t <= 2 * Math.PI + 1e-9; t += delta) {
      pts.push({ i, t, x: a * Math.cos(t), y: b * Math.sin(t) });
      i++;
    }
    return pts;
  }

  function render() {
    const a = parseFloat(elA.value),
      b = parseFloat(elB.value);
    const delta = parseFloat(elDelta.value);

    $(`[data-out="${ns}-a"]`).textContent = fmt(a, 2);
    $(`[data-out="${ns}-b"]`).textContent = fmt(b, 2);
    $(`[data-out="${ns}-delta"]`).textContent = fmt(delta, 3) + " rad";

    const pts = compute(a, b, delta);
    const n = pts.length;

    $(`[data-out="${ns}-n"]`).textContent = n;
    $(`[data-out="${ns}-evals"]`).textContent = n * 2;
    $(`[data-out="${ns}-segments"]`).textContent = n;
    const lb = loadLabel(n);
    const loadEl = $(`[data-out="${ns}-load"]`);
    loadEl.textContent = lb.text + " (" + n + " iterasi)";
    loadEl.className = "v " + lb.cls;

    $(`[data-out="${ns}-badge"]`).textContent = "n = " + n + " titik";
    $(`[data-out="${ns}-tablebadge"]`).textContent = n + " baris";

    const W = 760,
      H = 560,
      pad = 40;
    const xLim = Math.max(5, a * 1.35),
      yLim = Math.max(3.5, b * 1.5);
    const { svg: base, toSx, toSy } = buildFrame(W, H, pad, xLim, yLim);

    let svg = base;
    const closed = [...pts, pts[0]];
    const ellipsePathD = pathFrom(closed, "x", "y", toSx, toSy);
    svg += `<path d="${ellipsePathD}" fill="none" stroke="#9c3f24" stroke-width="2.4" stroke-linejoin="round"/>`;

    if (elShow.checked) {
      pts.forEach((p) => {
        svg += `<circle cx="${toSx(p.x)}" cy="${toSy(p.y)}" r="4.2" fill="#fffcf4" stroke="#9c3f24" stroke-width="1.6"/>`;
      });
    }

    // callouts every Nth point
    const calloutEveryE = n > 16 ? Math.ceil(n / 8) : 2;
    pts.forEach((p, idx) => {
      if (idx % calloutEveryE !== 0) return;
      svg += coordCallout(toSx(p.x), toSy(p.y), toSx, toSy, p.x, p.y);
    });

    svg += `<circle cx="${toSx(0)}" cy="${toSy(0)}" r="5" fill="#c4862a" stroke="#272318" stroke-width="1"/>`;
    svg += tracerMarkup(ellipsePathD, {
      duration: Math.max(3, 2 * Math.PI * 1.6),
    });

    $("#ellipse-plot").innerHTML = svg;

    const th = $(`[data-th="${ns}-t"]`);
    th.textContent =
      unit === "radian"
        ? "t (rad)"
        : unit === "degree"
          ? "t (\u00B0)"
          : "t (rad / \u00B0)";

    let rows = "";
    pts.forEach((p) => {
      const deg = (p.t * 180) / Math.PI;
      let tD =
        unit === "radian"
          ? fmt(p.t, 4)
          : unit === "degree"
            ? fmt(deg, 2) + "\u00B0"
            : fmt(p.t, 3) + " / " + fmt(deg, 1) + "\u00B0";
      rows += `<tr><td>${p.i}</td><td>${tD}</td><td>${fmt(p.x)}</td><td>${fmt(p.y)}</td></tr>`;
    });
    $(`[data-out="${ns}-tbody"]`).innerHTML = rows;
  }

  [elA, elB, elDelta, elShow].forEach((el) =>
    el.addEventListener("input", render),
  );
  render();
}

/* ============================================================
   PARABOLA
   ============================================================ */
function initParabola() {
  const ns = "parabola";
  const elA = $("#parabola-a"),
    elT1 = $("#parabola-t1"),
    elT2 = $("#parabola-t2");
  const elDelta = $("#parabola-delta"),
    elShow = $("#parabola-showPoints");
  const MIN_GAP = 0.3;

  function compute(a, t1, t2, delta) {
    const pts = [];
    let i = 0;
    for (let t = t1; t <= t2 + 1e-9; t += delta) {
      pts.push({ i, t, x: a * t * t, y: 2 * a * t });
      i++;
    }
    return pts;
  }

  function render() {
    const a = parseFloat(elA.value);
    let t1 = parseFloat(elT1.value),
      t2 = parseFloat(elT2.value);
    // keep t1 strictly below t2 with a minimum gap, nudging whichever
    // slider just moved without fighting the user's input
    if (t2 - t1 < MIN_GAP) {
      if (document.activeElement === elT1) t1 = t2 - MIN_GAP;
      else t2 = t1 + MIN_GAP;
    }
    const delta = parseFloat(elDelta.value);

    $(`[data-out="${ns}-a"]`).textContent = fmt(a, 2);
    $(`[data-out="${ns}-t1"]`).textContent = fmt(t1, 2);
    $(`[data-out="${ns}-t2"]`).textContent = fmt(t2, 2);
    $(`[data-out="${ns}-delta"]`).textContent = fmt(delta, 3);

    const pts = compute(a, t1, t2, delta);
    const n = pts.length;

    $(`[data-out="${ns}-n"]`).textContent = n;
    $(`[data-out="${ns}-evals"]`).textContent = n * 2;
    $(`[data-out="${ns}-segments"]`).textContent = Math.max(0, n - 1);
    const lb = loadLabel(n);
    const loadEl = $(`[data-out="${ns}-load"]`);
    loadEl.textContent = lb.text + " (" + n + " iterasi)";
    loadEl.className = "v " + lb.cls;

    $(`[data-out="${ns}-badge"]`).textContent = "n = " + n + " titik";
    $(`[data-out="${ns}-tablebadge"]`).textContent = n + " baris";

    const W = 760,
      H = 560,
      pad = 40;
    const rawXMax = Math.max(...pts.map((p) => p.x), 2);
    const rawYMax = Math.max(...pts.map((p) => Math.abs(p.y)), 2);
    const xMax = rawXMax * 1.12;
    const yMax = rawYMax * 1.18;
    const plotW = W - pad * 2,
      plotH = H - pad * 2;
    const xLo = -xMax * 0.18,
      xHi = xMax;
    const toSx2 = (x) => pad + ((x - xLo) / (xHi - xLo)) * plotW;
    const toSy2 = (y) => pad + plotH - ((y + yMax) / (2 * yMax)) * plotH;

    function pTickStep(range) {
      const raw = range / 5,
        mag = Math.pow(10, Math.floor(Math.log10(raw))),
        norm = raw / mag;
      return norm <= 1
        ? mag
        : norm <= 2
          ? 2 * mag
          : norm <= 5
            ? 5 * mag
            : 10 * mag;
    }
    const xStep2 = pTickStep(xHi - xLo);
    const yStep2 = pTickStep(2 * yMax);
    const px0 = toSx2(0),
      py0 = toSy2(0);
    const TICK = 4;

    let svg = "";
    // grid
    for (let gx = Math.ceil(xLo); gx <= Math.floor(xHi); gx++) {
      const sx = toSx2(gx);
      svg += `<line x1="${sx}" y1="${pad}" x2="${sx}" y2="${H - pad}" stroke="${gx === 0 ? "#a89c87" : "#ded5bd"}" stroke-width="${gx === 0 ? 1.5 : 0.5}"/>`;
    }
    for (let gy = Math.ceil(-yMax); gy <= Math.floor(yMax); gy++) {
      const sy = toSy2(gy);
      svg += `<line x1="${pad}" y1="${sy}" x2="${W - pad}" y2="${sy}" stroke="${gy === 0 ? "#a89c87" : "#ded5bd"}" stroke-width="${gy === 0 ? 1.5 : 0.5}"/>`;
    }
    // x ticks
    for (let v = xLo; v <= xHi + 1e-9; v += xStep2) {
      const r = Math.round(v / xStep2) * xStep2;
      if (Math.abs(r) < xStep2 * 0.01) continue;
      const sx = toSx2(r);
      svg += `<line x1="${sx}" y1="${py0 - TICK}" x2="${sx}" y2="${py0 + TICK}" stroke="#74695a" stroke-width="1.2"/>`;
      svg += `<text x="${sx}" y="${py0 + 16}" font-family="JetBrains Mono, monospace" font-size="10" fill="#74695a" text-anchor="middle">${Number(r.toPrecision(6))}</text>`;
    }
    // y ticks
    for (let v = -yMax; v <= yMax + 1e-9; v += yStep2) {
      const r = Math.round(v / yStep2) * yStep2;
      if (Math.abs(r) < yStep2 * 0.01) continue;
      const sy = toSy2(r);
      svg += `<line x1="${px0 - TICK}" y1="${sy}" x2="${px0 + TICK}" y2="${sy}" stroke="#74695a" stroke-width="1.2"/>`;
      svg += `<text x="${px0 - 8}" y="${sy + 4}" font-family="JetBrains Mono, monospace" font-size="10" fill="#74695a" text-anchor="end">${Number(r.toPrecision(6))}</text>`;
    }
    svg += `<text x="${px0 + 5}" y="${py0 + 14}" font-family="JetBrains Mono, monospace" font-size="10" fill="#a89c87">0</text>`;
    svg += `<text x="${W - pad + 10}" y="${py0 + 4}" font-family="JetBrains Mono, monospace" font-size="12" fill="#74695a" font-weight="600">x</text>`;
    svg += `<text x="${px0 - 4}" y="${pad - 10}" font-family="JetBrains Mono, monospace" font-size="12" fill="#74695a" font-weight="600" text-anchor="middle">y</text>`;

    const sorted = [...pts].sort((p, q) => p.t - q.t);
    const parabolaPathD = pathFrom(sorted, "x", "y", toSx2, toSy2);
    svg += `<path d="${parabolaPathD}" fill="none" stroke="#9c3f24" stroke-width="2.4" stroke-linejoin="round"/>`;

    if (elShow.checked) {
      pts.forEach((p) => {
        svg += `<circle cx="${toSx2(p.x)}" cy="${toSy2(p.y)}" r="4.2" fill="#fffcf4" stroke="#9c3f24" stroke-width="1.6"/>`;
      });
    }

    // t1 / t2 endpoint diamonds — always shown regardless of showPoints toggle
    const pt1 = sorted[0],
      pt2 = sorted[sorted.length - 1];
    svg += tEndpointMarker(toSx2(pt1.x), toSy2(pt1.y), pt1.t, "t₁", {
      above: pt1.y >= 0,
    });
    svg += tEndpointMarker(toSx2(pt2.x), toSy2(pt2.y), pt2.t, "t₂", {
      above: pt2.y >= 0,
    });

    // coordinate callouts: endpoints (t1, t2) always shown; thin out
    // interior points so the diagram doesn't turn into label soup
    const calloutEvery = n > 14 ? Math.ceil(n / 8) : 1;
    sorted.forEach((p, idx) => {
      const isEndpoint = idx === 0 || idx === sorted.length - 1;
      if (!isEndpoint && idx % calloutEvery !== 0) return;
      const sx = toSx2(p.x),
        sy = toSy2(p.y);
      svg += coordCallout(sx, sy, toSx2, toSy2, p.x, p.y);
    });

    svg += `<circle cx="${toSx2(0)}" cy="${toSy2(0)}" r="5" fill="#c4862a" stroke="#272318" stroke-width="1"/>`;
    svg += `<text x="${toSx2(0) + 9}" y="${toSy2(0) - 9}" font-family="JetBrains Mono, monospace" font-size="11" fill="#272318">vertex (0,0)</text>`;
    // open curve (not a loop) — build a forward+reverse path so the tracer ping-pongs
    const reversed = [...sorted].reverse();
    const pingpongD = pathFrom(
      [...sorted, ...reversed.slice(1)],
      "x",
      "y",
      toSx2,
      toSy2,
    );
    svg += tracerMarkup(pingpongD, { duration: Math.max(3, (t2 - t1) * 1.4) });

    $("#parabola-plot").innerHTML = svg;

    let rows = "";
    pts.forEach((p) => {
      rows += `<tr><td>${p.i}</td><td>${fmt(p.t)}</td><td>${fmt(p.x)}</td><td>${fmt(p.y)}</td></tr>`;
    });
    $(`[data-out="${ns}-tbody"]`).innerHTML = rows;
  }

  [elA, elT1, elT2, elDelta, elShow].forEach((el) =>
    el.addEventListener("input", render),
  );
  render();
}

/* ============================================================
   HYPERBOLA
   ============================================================ */
function initHyperbola() {
  const ns = "hyperbola";
  const elA = $("#hyperbola-a"),
    elB = $("#hyperbola-b");
  const elT1 = $("#hyperbola-t1"),
    elT2 = $("#hyperbola-t2");
  const elDelta = $("#hyperbola-delta"),
    elShow = $("#hyperbola-showPoints");
  let unit = "radian";
  $(`[data-unit-toggle="${ns}"]`).addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    $$(`[data-unit-toggle="${ns}"] button`).forEach((b) =>
      b.classList.remove("active"),
    );
    btn.classList.add("active");
    unit = btn.dataset.unit;
    render();
  });

  const MIN_GAP = 0.1;

  function compute(a, b, t1, t2, delta) {
    const pts = [];
    let i = 0;
    for (let t = t1; t <= t2 + 1e-9; t += delta) {
      const xr = a / Math.cos(t),
        yr = b * Math.tan(t);
      pts.push({ i, t, xr, yr, xl: -xr, yl: yr });
      i++;
    }
    return pts;
  }

  function render() {
    const a = parseFloat(elA.value),
      b = parseFloat(elB.value);
    let t1 = parseFloat(elT1.value),
      t2 = parseFloat(elT2.value);
    if (t2 - t1 < MIN_GAP) {
      if (document.activeElement === elT1) t1 = t2 - MIN_GAP;
      else t2 = t1 + MIN_GAP;
    }
    const delta = parseFloat(elDelta.value);

    $(`[data-out="${ns}-a"]`).textContent = fmt(a, 2);
    $(`[data-out="${ns}-b"]`).textContent = fmt(b, 2);
    $(`[data-out="${ns}-t1"]`).textContent = fmt(t1, 2);
    $(`[data-out="${ns}-t2"]`).textContent = fmt(t2, 2);
    $(`[data-out="${ns}-delta"]`).textContent = fmt(delta, 3) + " rad";

    const pts = compute(a, b, t1, t2, delta);
    const n = pts.length;

    $(`[data-out="${ns}-n"]`).textContent = n;
    $(`[data-out="${ns}-total"]`).textContent = n * 2;
    $(`[data-out="${ns}-evals"]`).textContent = n * 2 + " (\u00D72 cabang)";
    $(`[data-out="${ns}-segments"]`).textContent = Math.max(0, n - 1) * 2;
    const lb = loadLabel(n);
    const loadEl = $(`[data-out="${ns}-load"]`);
    loadEl.textContent = lb.text + " (" + n * 2 + " iterasi)";
    loadEl.className = "v " + lb.cls;

    $(`[data-out="${ns}-badge"]`).textContent = "n = " + n + " titik / cabang";
    $(`[data-out="${ns}-tablebadge"]`).textContent = n + " baris";

    const W = 760,
      H = 560,
      pad = 40;
    const xLim = Math.min(
      14,
      Math.max(
        6,
        a * 2.6,
        ...pts.map((p) => Math.max(Math.abs(p.xr), Math.abs(p.xl))),
      ),
    );
    const yLim = Math.min(
      10,
      Math.max(4, b * 2.6, ...pts.map((p) => Math.abs(p.yr))),
    );
    const { svg: base, toSx, toSy } = buildFrame(W, H, pad, xLim, yLim);

    let svg = base;
    const slope = b / a;
    svg += `<line x1="${toSx(-xLim)}" y1="${toSy(-slope * xLim)}" x2="${toSx(xLim)}" y2="${toSy(slope * xLim)}" stroke="#c4862a" stroke-width="1.4" stroke-dasharray="6,5" opacity="0.85"/>`;
    svg += `<line x1="${toSx(-xLim)}" y1="${toSy(slope * xLim)}" x2="${toSx(xLim)}" y2="${toSy(-slope * xLim)}" stroke="#c4862a" stroke-width="1.4" stroke-dasharray="6,5" opacity="0.85"/>`;

    const sorted = [...pts].sort((p, q) => p.t - q.t);
    const rightPathD = pathFrom(sorted, "xr", "yr", toSx, toSy);
    const leftPathD = pathFrom(sorted, "xl", "yl", toSx, toSy);
    svg += `<path d="${rightPathD}" fill="none" stroke="#9c3f24" stroke-width="2.4" stroke-linejoin="round"/>`;
    svg += `<path d="${leftPathD}" fill="none" stroke="#1f5c52" stroke-width="2.4" stroke-linejoin="round"/>`;

    if (elShow.checked) {
      pts.forEach((p) => {
        svg += `<circle cx="${toSx(p.xr)}" cy="${toSy(p.yr)}" r="4.2" fill="#fffcf4" stroke="#9c3f24" stroke-width="1.6"/>`;
        svg += `<circle cx="${toSx(p.xl)}" cy="${toSy(p.yl)}" r="4.2" fill="#fffcf4" stroke="#1f5c52" stroke-width="1.6"/>`;
      });
    }

    // t1 / t2 endpoint diamonds on both branches — always visible
    const pt1h = sorted[0],
      pt2h = sorted[sorted.length - 1];
    // right branch endpoints
    svg += tEndpointMarker(toSx(pt1h.xr), toSy(pt1h.yr), pt1h.t, "t₁", {
      color: "#5b3fa8",
      above: pt1h.yr >= 0,
    });
    svg += tEndpointMarker(toSx(pt2h.xr), toSy(pt2h.yr), pt2h.t, "t₂", {
      color: "#5b3fa8",
      above: pt2h.yr >= 0,
    });
    // left branch endpoints (same t values, mirrored x)
    svg += tEndpointMarker(toSx(pt1h.xl), toSy(pt1h.yl), pt1h.t, "t₁", {
      color: "#5b3fa8",
      above: pt1h.yl >= 0,
    });
    svg += tEndpointMarker(toSx(pt2h.xl), toSy(pt2h.yl), pt2h.t, "t₂", {
      color: "#5b3fa8",
      above: pt2h.yl >= 0,
    });

    // coordinate callouts — thin out interior points to avoid label soup
    const calloutEvery = n > 12 ? Math.ceil(n / 6) : 1;
    sorted.forEach((p, idx) => {
      const isEndpoint = idx === 0 || idx === sorted.length - 1;
      if (!isEndpoint && idx % calloutEvery !== 0) return;
      // right branch
      svg += coordCallout(toSx(p.xr), toSy(p.yr), toSx, toSy, p.xr, p.yr, {
        color: "#9c3f24",
        bgColor: "#fff5f0",
      });
      // left branch
      svg += coordCallout(toSx(p.xl), toSy(p.yl), toSx, toSy, p.xl, p.yl, {
        color: "#1f5c52",
        bgColor: "#f0faf7",
      });
    });

    svg += `<circle cx="${toSx(a)}" cy="${toSy(0)}" r="5" fill="#c4862a" stroke="#272318" stroke-width="1"/>`;
    svg += `<circle cx="${toSx(-a)}" cy="${toSy(0)}" r="5" fill="#c4862a" stroke="#272318" stroke-width="1"/>`;
    svg += `<text x="${toSx(a) + 8}" y="${toSy(0) - 8}" font-family="JetBrains Mono, monospace" font-size="11" fill="#272318">(a, 0)</text>`;
    svg += `<text x="${toSx(-a) - 46}" y="${toSy(0) - 8}" font-family="JetBrains Mono, monospace" font-size="11" fill="#272318">(-a, 0)</text>`;

    const sortedRev = [...sorted].reverse();
    const rightPingpong = pathFrom(
      [...sorted, ...sortedRev.slice(1)],
      "xr",
      "yr",
      toSx,
      toSy,
    );
    const leftPingpong = pathFrom(
      [...sorted, ...sortedRev.slice(1)],
      "xl",
      "yl",
      toSx,
      toSy,
    );
    svg += tracerMarkup(rightPingpong, {
      duration: Math.max(3, (t2 - t1) * 3),
      color: "#9c3f24",
    });
    svg += tracerMarkup(leftPingpong, {
      duration: Math.max(3, (t2 - t1) * 3),
      color: "#1f5c52",
    });

    $("#hyperbola-plot").innerHTML = svg;

    const th = $(`[data-th="${ns}-t"]`);
    th.textContent =
      unit === "radian"
        ? "t (rad)"
        : unit === "degree"
          ? "t (\u00B0)"
          : "t (rad / \u00B0)";

    let rows = "";
    pts.forEach((p) => {
      const deg = (p.t * 180) / Math.PI;
      let tD =
        unit === "radian"
          ? fmt(p.t, 4)
          : unit === "degree"
            ? fmt(deg, 2) + "\u00B0"
            : fmt(p.t, 3) + " / " + fmt(deg, 1) + "\u00B0";
      rows += `<tr><td>${p.i}</td><td>${tD}</td><td class="branchR">${fmt(p.xr)}</td><td class="branchR">${fmt(p.yr)}</td><td class="branchL">${fmt(p.xl)}</td><td class="branchL">${fmt(p.yl)}</td></tr>`;
    });
    $(`[data-out="${ns}-tbody"]`).innerHTML = rows;
  }

  [elA, elB, elT1, elT2, elDelta, elShow].forEach((el) =>
    el.addEventListener("input", render),
  );
  render();
}

/* ============================================================
   NAVBAR — tab switching + sliding indicator + page transition
   ============================================================ */
function initNavbar() {
  const links = $$(".nav-link");
  const indicator = $("#nav-indicator");
  const pages = {
    circle: $("#page-circle"),
    ellipse: $("#page-ellipse"),
    parabola: $("#page-parabola"),
    hyperbola: $("#page-hyperbola"),
  };

  function moveIndicator(btn, animate = true) {
    const navLinks = $("#nav-links");
    const r = btn.getBoundingClientRect();
    const parentR = navLinks.getBoundingClientRect();
    const left = r.left - parentR.left;
    const width = r.width;
    if (animate && window.gsap) {
      gsap.to(indicator, { left, width, duration: 0.35, ease: "power2.out" });
    } else {
      indicator.style.left = left + "px";
      indicator.style.width = width + "px";
    }
  }

  let current = "circle";

  links.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.curve;
      if (target === current) return;

      links.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      moveIndicator(btn);

      const oldPage = pages[current];
      const newPage = pages[target];

      if (window.gsap) {
        gsap.to(oldPage, {
          opacity: 0,
          y: -10,
          duration: 0.22,
          ease: "power1.in",
          onComplete: () => {
            oldPage.hidden = true;
            newPage.hidden = false;
            gsap.fromTo(
              newPage,
              { opacity: 0, y: 10 },
              { opacity: 1, y: 0, duration: 0.32, ease: "power2.out" },
            );
            revealPanels(newPage);
            const titleEl = $(".page-title[data-typewriter]", newPage);
            if (titleEl) {
              const word = titleEl.dataset.label || titleEl.textContent.trim();
              typewriterIn(titleEl, word, true);
            }
          },
        });
      } else {
        oldPage.hidden = true;
        newPage.hidden = false;
      }
      current = target;
    });
  });

  // resize-safe indicator position
  window.addEventListener("resize", () => {
    const activeBtn = $(".nav-link.active");
    if (activeBtn) moveIndicator(activeBtn, false);
  });

  // init indicator position after layout settles — wait for webfonts too,
  // since button widths shift once JetBrains Mono / Fraunces finish loading
  function settleIndicator() {
    const activeBtn = $(".nav-link.active");
    if (activeBtn) moveIndicator(activeBtn, false);
  }
  requestAnimationFrame(settleIndicator);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(settleIndicator);
  }
  window.addEventListener("load", settleIndicator);
}

/* ============================================================
   Panel reveal — staggered entrance on first load / page switch
   ============================================================ */
function revealPanels(scope = document) {
  if (!window.gsap) return;
  const panels = $$("[data-reveal]", scope);
  gsap.fromTo(
    panels,
    { opacity: 0, y: 14 },
    { opacity: 1, y: 0, duration: 0.45, ease: "power2.out", stagger: 0.06 },
  );
}

/* ============================================================
   Slider micro-interaction: subtle scale pulse on the value chip
   ============================================================ */
function initSliderFeedback() {
  $$("input[type=range]").forEach((input) => {
    input.addEventListener("input", () => {
      const field = input.closest(".field");
      if (!field) return;
      const chip = field.querySelector(".val");
      if (chip && window.gsap) {
        gsap.killTweensOf(chip);
        gsap.fromTo(
          chip,
          { scale: 1.08 },
          { scale: 1, duration: 0.25, ease: "power2.out" },
        );
      }
    });
  });
}

/* ============================================================
   Typewriter — page title types itself in on load / tab switch.
   Deletes the previous word then types the new one so the effect
   reads as "the lab re-labeling itself", not a generic intro gag.
   ============================================================ */
const TYPE_SPEED = 0.045; // seconds per character, typing
const DELETE_SPEED = 0.028; // seconds per character, deleting
let _twLastWord = "";

function typewriterIn(el, word, withDelete = false) {
  if (!el) return;
  const prevWord = withDelete ? _twLastWord : "";
  _twLastWord = word;

  if (!window.gsap) {
    el.textContent = word;
    return;
  }

  const cursor = '<span class="tw-cursor">&nbsp;</span>';
  const tl = gsap.timeline();

  if (withDelete && prevWord.length) {
    let i = prevWord.length;
    tl.to(
      {},
      {
        duration: DELETE_SPEED * prevWord.length,
        onUpdate: function () {
          const progress = this.progress();
          const chars = Math.round(prevWord.length * (1 - progress));
          el.innerHTML = prevWord.slice(0, chars) + cursor;
        },
      },
    );
  } else {
    el.innerHTML = cursor;
  }

  tl.to(
    {},
    {
      duration: TYPE_SPEED * word.length,
      onUpdate: function () {
        const progress = this.progress();
        const chars = Math.round(word.length * progress);
        el.innerHTML = word.slice(0, chars) + cursor;
      },
      onComplete: function () {
        el.innerHTML = word; // drop the blinking cursor once settled
      },
    },
  );
}

function initHeaderEffects() {
  // type in the title of the page that's visible on first load
  const firstTitle = $(
    ".curve-page:not([hidden]) .page-title[data-typewriter]",
  );
  if (firstTitle)
    typewriterIn(
      firstTitle,
      firstTitle.dataset.label || firstTitle.textContent.trim(),
      false,
    );
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initCircle();
  initEllipse();
  initParabola();
  initHyperbola();
  initNavbar();
  initSliderFeedback();
  initHeaderEffects();
  revealPanels($("#page-circle"));

  // gentle page-load entrance for the masthead
  if (window.gsap) {
    gsap.from(".navbar", {
      y: -16,
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
    });
    gsap.from(".page-head", {
      opacity: 0,
      y: 10,
      duration: 0.5,
      delay: 0.1,
      ease: "power2.out",
    });
  }
});

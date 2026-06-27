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
  let svg = "";
  for (let gx = Math.ceil(-xLim); gx <= Math.floor(xLim); gx++) {
    const sx = toSx(gx);
    svg += `<line x1="${sx}" y1="${pad}" x2="${sx}" y2="${H - pad}" stroke="#ded5bd" stroke-width="${gx === 0 ? 1.4 : 0.6}"/>`;
  }
  for (let gy = Math.ceil(-yLim); gy <= Math.floor(yLim); gy++) {
    const sy = toSy(gy);
    svg += `<line x1="${pad}" y1="${sy}" x2="${W - pad}" y2="${sy}" stroke="#ded5bd" stroke-width="${gy === 0 ? 1.4 : 0.6}"/>`;
  }
  svg += `<text x="${W - pad + 8}" y="${toSy(0) + 4}" font-family="JetBrains Mono, monospace" font-size="11" fill="#74695a">x</text>`;
  svg += `<text x="${toSx(0) - 6}" y="${pad - 10}" font-family="JetBrains Mono, monospace" font-size="11" fill="#74695a">y</text>`;
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
    elTrange = $("#parabola-trange");
  const elDelta = $("#parabola-delta"),
    elShow = $("#parabola-showPoints");

  function compute(a, tmax, delta) {
    const pts = [];
    let i = 0;
    for (let t = -tmax; t <= tmax + 1e-9; t += delta) {
      pts.push({ i, t, x: a * t * t, y: 2 * a * t });
      i++;
    }
    return pts;
  }

  function render() {
    const a = parseFloat(elA.value),
      tmax = parseFloat(elTrange.value);
    const delta = parseFloat(elDelta.value);

    $(`[data-out="${ns}-a"]`).textContent = fmt(a, 2);
    $(`[data-out="${ns}-trange"]`).textContent = "\u00B1" + fmt(tmax, 2);
    $(`[data-out="${ns}-delta"]`).textContent = fmt(delta, 3);

    const pts = compute(a, tmax, delta);
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
    // Keep vertex roughly centered vertically, give x-axis a touch of left margin
    // so the curve doesn't hug the top-right corner of the canvas.
    const xMax = rawXMax * 1.12;
    const yMax = rawYMax * 1.18;
    const plotW = W - pad * 2,
      plotH = H - pad * 2;
    const xLo = -xMax * 0.18,
      xHi = xMax;
    const toSx2 = (x) => pad + ((x - xLo) / (xHi - xLo)) * plotW;
    const toSy2 = (y) => pad + plotH - ((y + yMax) / (2 * yMax)) * plotH;

    let svg = "";
    for (let gx = Math.ceil(xLo); gx <= Math.floor(xHi); gx++) {
      const sx = toSx2(gx);
      svg += `<line x1="${sx}" y1="${pad}" x2="${sx}" y2="${H - pad}" stroke="#ded5bd" stroke-width="${gx === 0 ? 1.4 : 0.6}"/>`;
    }
    for (let gy = Math.ceil(-yMax); gy <= Math.floor(yMax); gy++) {
      const sy = toSy2(gy);
      svg += `<line x1="${pad}" y1="${sy}" x2="${W - pad}" y2="${sy}" stroke="#ded5bd" stroke-width="${gy === 0 ? 1.4 : 0.6}"/>`;
    }
    svg += `<text x="${W - pad + 8}" y="${toSy2(0) + 4}" font-family="JetBrains Mono, monospace" font-size="11" fill="#74695a">x</text>`;
    svg += `<text x="${toSx2(0) - 6}" y="${pad - 10}" font-family="JetBrains Mono, monospace" font-size="11" fill="#74695a">y</text>`;

    const sorted = [...pts].sort((p, q) => p.t - q.t);
    const parabolaPathD = pathFrom(sorted, "x", "y", toSx2, toSy2);
    svg += `<path d="${parabolaPathD}" fill="none" stroke="#9c3f24" stroke-width="2.4" stroke-linejoin="round"/>`;

    if (elShow.checked) {
      pts.forEach((p) => {
        svg += `<circle cx="${toSx2(p.x)}" cy="${toSy2(p.y)}" r="4.2" fill="#fffcf4" stroke="#9c3f24" stroke-width="1.6"/>`;
      });
    }
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
    svg += tracerMarkup(pingpongD, { duration: Math.max(3, tmax * 2.2) });

    $("#parabola-plot").innerHTML = svg;

    let rows = "";
    pts.forEach((p) => {
      rows += `<tr><td>${p.i}</td><td>${fmt(p.t)}</td><td>${fmt(p.x)}</td><td>${fmt(p.y)}</td></tr>`;
    });
    $(`[data-out="${ns}-tbody"]`).innerHTML = rows;
  }

  [elA, elTrange, elDelta, elShow].forEach((el) =>
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
    elB = $("#hyperbola-b"),
    elTrange = $("#hyperbola-trange");
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

  function compute(a, b, tmax, delta) {
    const pts = [];
    let i = 0;
    for (let t = -tmax; t <= tmax + 1e-9; t += delta) {
      const xr = a / Math.cos(t),
        yr = b * Math.tan(t);
      pts.push({ i, t, xr, yr, xl: -xr, yl: yr });
      i++;
    }
    return pts;
  }

  function render() {
    const a = parseFloat(elA.value),
      b = parseFloat(elB.value),
      tmax = parseFloat(elTrange.value);
    const delta = parseFloat(elDelta.value);

    $(`[data-out="${ns}-a"]`).textContent = fmt(a, 2);
    $(`[data-out="${ns}-b"]`).textContent = fmt(b, 2);
    $(`[data-out="${ns}-trange"]`).textContent = "\u00B1" + fmt(tmax, 2);
    $(`[data-out="${ns}-delta"]`).textContent = fmt(delta, 3) + " rad";

    const pts = compute(a, b, tmax, delta);
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
    svg += `<circle cx="${toSx(a)}" cy="${toSy(0)}" r="5" fill="#c4862a" stroke="#272318" stroke-width="1"/>`;
    svg += `<circle cx="${toSx(-a)}" cy="${toSy(0)}" r="5" fill="#c4862a" stroke="#272318" stroke-width="1"/>`;
    svg += `<text x="${toSx(a) + 8}" y="${toSy(0) - 8}" font-family="JetBrains Mono, monospace" font-size="11" fill="#272318">(a, 0)</text>`;
    svg += `<text x="${toSx(-a) - 46}" y="${toSy(0) - 8}" font-family="JetBrains Mono, monospace" font-size="11" fill="#272318">(-a, 0)</text>`;
    // open branches — ping-pong each tracer back and forth along its own branch
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
      duration: Math.max(3, tmax * 3),
      color: "#9c3f24",
    });
    svg += tracerMarkup(leftPingpong, {
      duration: Math.max(3, tmax * 3),
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

  [elA, elB, elTrange, elDelta, elShow].forEach((el) =>
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

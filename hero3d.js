/*
 * Hero 3D scene: gold armillary rings orbiting the portrait, drifting particles
 * and slowly turning wireframe solids, all projected in true 3D and drawn on a
 * 2D canvas (no libraries, no WebGL needed). Respects reduced-motion settings.
 */
(function () {
  "use strict";

  var hero = document.querySelector(".hero");
  if (!hero) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var canvas = document.createElement("canvas");
  canvas.className = "gl-canvas";
  canvas.setAttribute("aria-hidden", "true");
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  hero.insertBefore(canvas, hero.firstChild);
  hero.classList.add("gl");

  var portrait = hero.querySelector(".portrait");
  var F = 900;                       // focal length of the virtual camera
  var W = 0, H = 0;
  var mx = 0, my = 0, tx = 0, ty = 0; // smoothed and target pointer (-1..1)
  var t = 0, last = 0, running = false, inView = true, firstFrame = true;
  var PI2 = Math.PI * 2;
  var GOLD = "227,201,127";

  /* ---------- helpers ---------- */
  var rx = 0, ry = 0, rz = 0;
  function rot(x, y, z, ax, ay) {
    var ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay);
    var y1 = y * ca - z * sa, z1 = y * sa + z * ca;
    rx = x * cb + z1 * sb;
    ry = y1;
    rz = -x * sb + z1 * cb;
  }
  var ps = 1;
  function proj(v, c) { ps = F / (F + rz); return c + v * ps; }

  /* ---------- particles ---------- */
  var P = [];
  function initParticles() {
    var n = W < 700 ? 70 : 150;
    P.length = 0;
    for (var i = 0; i < n; i++) {
      P.push({
        x: (Math.random() - 0.5) * W * 1.3,
        y: (Math.random() - 0.5) * H * 1.3,
        z: -250 + Math.random() * 800,
        v: 6 + Math.random() * 16,
        r: 0.8 + Math.random() * 1.7,
        ph: Math.random() * PI2
      });
    }
  }

  /* ---------- wireframe solids ---------- */
  function buildSolid(verts) {
    var d = [], min = 1e9, i, j;
    for (i = 0; i < verts.length; i++) for (j = i + 1; j < verts.length; j++) {
      var dx = verts[i][0] - verts[j][0], dy = verts[i][1] - verts[j][1], dz = verts[i][2] - verts[j][2];
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      d.push([i, j, dist]);
      if (dist < min) min = dist;
    }
    var edges = [];
    d.forEach(function (e) { if (e[2] <= min * 1.05) edges.push([e[0], e[1]]); });
    return { v: verts, e: edges };
  }
  var phi = (1 + Math.sqrt(5)) / 2;
  var ico = buildSolid([
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
  ]);
  var octa = buildSolid([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]);
  var solids = [
    { s: ico,  fx: 0.93, fy: 0.16, size: 30, sx: 0.22, sy: 0.31, z: 120 },
    { s: octa, fx: 0.52, fy: 0.88, size: 38, sx: -0.27, sy: 0.19, z: 40 }
  ];

  /* ---------- rings ---------- */
  var SEG = 96;
  var cosT = [], sinT = [];
  for (var i = 0; i <= SEG; i++) { cosT.push(Math.cos(i / SEG * PI2)); sinT.push(Math.sin(i / SEG * PI2)); }
  var rings = [
    { k: 1.00, ax: 1.15, ay: 0.15, sx: 0.21, sy: 0.13, sat: 0.55, off: 0.0 },
    { k: 1.12, ax: 0.55, ay: 0.95, sx: -0.16, sy: 0.20, sat: -0.42, off: 2.1 },
    { k: 1.24, ax: 1.40, ay: -0.60, sx: 0.10, sy: -0.17, sat: 0.33, off: 4.2 }
  ];
  var ringPX = new Array(SEG + 1), ringPY = new Array(SEG + 1), ringT = new Array(SEG + 1);

  function drawRing(r, cx, cy, R, sy) {
    var rad = R * r.k;
    var ax = r.ax + t * r.sx + my * 0.28 + sy;
    var ay = r.ay + t * r.sy + mx * 0.38;
    var i;
    for (i = 0; i <= SEG; i++) {
      rot(cosT[i] * rad, sinT[i] * rad, 0, ax, ay);
      ringPX[i] = proj(rx, cx);
      ringPY[i] = cy + ry * ps;
      ringT[i] = (rz / rad + 1) / 2;          // 0 = near the viewer, 1 = far
    }
    var b;
    ctx.lineCap = "round";
    for (b = 0; b < 6; b++) {
      var q = b / 5;
      ctx.beginPath();
      for (i = 0; i < SEG; i++) {
        var near = 1 - (ringT[i] + ringT[i + 1]) / 2;
        if (Math.min(5, Math.floor(near * 5.999)) !== b) continue;
        ctx.moveTo(ringPX[i], ringPY[i]);
        ctx.lineTo(ringPX[i + 1], ringPY[i + 1]);
      }
      ctx.strokeStyle = "rgba(" + GOLD + "," + (0.12 + 0.62 * q).toFixed(3) + ")";
      ctx.lineWidth = 0.9 + 1.3 * q;
      ctx.stroke();
    }
    // satellite
    var a = r.off + t * r.sat;
    rot(Math.cos(a) * rad, Math.sin(a) * rad, 0, ax, ay);
    var sx = proj(rx, cx), sy2 = cy + ry * ps, near2 = 1 - (rz / rad + 1) / 2;
    var size = 3.2 + 3.2 * near2;
    ctx.fillStyle = "rgba(" + GOLD + "," + (0.10 + 0.14 * near2).toFixed(3) + ")";
    ctx.beginPath(); ctx.arc(sx, sy2, size * 3.2, 0, PI2); ctx.fill();
    ctx.fillStyle = "rgba(255,244,214," + (0.55 + 0.4 * near2).toFixed(3) + ")";
    ctx.beginPath(); ctx.arc(sx, sy2, size, 0, PI2); ctx.fill();
  }

  /* ---------- frame ---------- */
  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    mx += (tx - mx) * Math.min(1, dt * 3.2);
    my += (ty - my) * Math.min(1, dt * 3.2);
    var scroll = Math.min(1.6, (window.pageYOffset || 0) / Math.max(1, H)) * 0.55;

    // particles
    ctx.globalCompositeOperation = "lighter";
    var cxs = W / 2, cys = H / 2, i, p;
    for (i = 0; i < P.length; i++) {
      p = P[i];
      p.y -= p.v * dt;
      if (p.y < -H * 0.68) { p.y = H * 0.68; p.x = (Math.random() - 0.5) * W * 1.3; }
      var s = F / (F + p.z);
      var x = cxs + (p.x - mx * 60 * (1 - s)) * s;
      var y = cys + (p.y - my * 40 * (1 - s)) * s;
      var tw = 0.55 + 0.45 * Math.sin(t * 1.6 + p.ph);
      var al = Math.min(0.9, (0.18 + 0.55 * s * s) * tw);
      ctx.fillStyle = "rgba(" + GOLD + "," + al.toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(x, y, p.r * s * 1.6, 0, PI2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // wireframe solids
    ctx.lineWidth = 1;
    solids.forEach(function (o) {
      var cx = o.fx * W - mx * 18, cy = o.fy * H - my * 12, size = o.size * (W < 700 ? 0.8 : 1.15);
      var ax = t * o.sx + scroll, ay = t * o.sy + mx * 0.3;
      var pts = o.s.v.map(function (v) {
        rot(v[0] * size, v[1] * size, v[2] * size + o.z, ax, ay);
        var x = proj(rx, cx), y = cy + ry * ps;
        return [x, y, rz];
      });
      ctx.beginPath();
      o.s.e.forEach(function (e) {
        ctx.moveTo(pts[e[0]][0], pts[e[0]][1]);
        ctx.lineTo(pts[e[1]][0], pts[e[1]][1]);
      });
      ctx.strokeStyle = "rgba(" + GOLD + ",0.30)";
      ctx.stroke();
      ctx.fillStyle = "rgba(" + GOLD + ",0.55)";
      pts.forEach(function (q) { ctx.beginPath(); ctx.arc(q[0], q[1], 1.6, 0, PI2); ctx.fill(); });
    });

    // rings around the portrait
    var cx = W * 0.72, cy = H * 0.5, R = Math.min(H, W) * 0.36;
    if (portrait) {
      var pr = portrait.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      cx = pr.left - hr.left + pr.width / 2;
      cy = pr.top - hr.top + pr.height / 2;
      R = Math.min(pr.height * 0.66, W * 0.46 / 1.24);
    }
    rings.forEach(function (r) { drawRing(r, cx, cy, R, scroll); });

    if (firstFrame) { firstFrame = false; canvas.classList.add("on"); }
  }

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now; t += dt;
    draw(dt);
    requestAnimationFrame(frame);
  }
  function start() { if (running || !inView || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  function stop() { running = false; }

  /* ---------- sizing, pointer and visibility ---------- */
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = hero.clientWidth, h = hero.clientHeight;
    if (!w || !h) return;
    var hadParticles = P.length;
    W = w; H = h;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var want = W < 700 ? 70 : 150;
    if (!hadParticles || P.length !== want) initParticles();
    if (!running) draw(0.016);
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(hero);
  else window.addEventListener("resize", resize);
  resize();

  hero.addEventListener("pointermove", function (e) {
    var r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }, { passive: true });
  hero.addEventListener("pointerleave", function () { tx = 0; ty = 0; });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      inView = en[0].isIntersecting;
      inView ? start() : stop();
    }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  start();
})();

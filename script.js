(function () {
  var canvas = document.getElementById('sky');
  var ctx = canvas.getContext('2d');
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
 
  var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, rh = 30, rMax = 1000;
  var stars = [], raf = 0, last = 0, time = 0;
  var TILT = -0.22, cosT = Math.cos(TILT), sinT = Math.sin(TILT);
 
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
 
  // Place a star in the swirl. Initial stars fill the whole sky; respawned
  // stars re-enter at a mid distance and fade in, so nothing pops.
  function place(s, initial) {
    var u = Math.random();
    s.r = initial
      ? rh * 1.5 + (rMax - rh * 1.5) * Math.pow(u, 2.1)
      : rh * (4 + 12 * Math.pow(u, 1.6));
    var inArm = Math.random() < 0.72;
    s.a = inArm
      ? Math.log(s.r / rh) * 2.2 + (Math.random() < 0.5 ? 0 : Math.PI) + gauss() * 0.55
      : Math.random() * Math.PI * 2;
    s.size = 0.5 + Math.pow(Math.random(), 3) * 1.4;
    s.bright = 0.35 + Math.random() * 0.65;
    s.tw = 0.6 + Math.random() * 1.6;
    s.ph = Math.random() * 6.283;
    s.age = initial ? 99 : 0;
  }
 
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
 
    var top = clamp(H * 0.34, 200, 340);      // matches the panel's top gap
    cx = W * 0.5;
    cy = top * 0.5 + 6;
    rh = clamp(Math.min(W, H) * 0.05, 24, 46);
    rMax = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 1.05;
 
    var n = Math.round(clamp((W * H) / 1300, 600, 1700));
    stars = [];
    for (var i = 0; i < n; i++) { var s = {}; place(s, true); stars.push(s); }
  }
 
  function step(dt) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var k = rh / s.r;
      s.a += 0.7 * Math.pow(k, 1.4) * dt;          // inner stars orbit faster
      s.r -= rh * 0.32 * Math.pow(k, 1.2) * dt;    // slow inward drift
      s.age += dt;
      if (s.r < rh * 1.06) place(s, false);        // swallowed, so respawn
    }
  }
 
  function glow() {
    // Wide violet halo
    var g = ctx.createRadialGradient(cx, cy, rh, cx, cy, rh * 9);
    g.addColorStop(0, 'rgba(110, 90, 210, 0.16)');
    g.addColorStop(1, 'rgba(110, 90, 210, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, rh * 9, 0, 6.2832); ctx.fill();
 
    // Flattened, tilted accretion glow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(TILT);
    ctx.scale(1, 0.3);
    var d = ctx.createRadialGradient(0, 0, rh, 0, 0, rh * 4.6);
    d.addColorStop(0, 'rgba(255, 190, 120, 0.42)');
    d.addColorStop(0.25, 'rgba(255, 140, 80, 0.2)');
    d.addColorStop(0.6, 'rgba(255, 110, 90, 0.07)');
    d.addColorStop(1, 'rgba(255, 110, 90, 0)');
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.arc(0, 0, rh * 4.6, 0, 6.2832); ctx.fill();
    ctx.restore();
  }
 
  function project(r, a, q) {
    var x0 = r * Math.cos(a), y0 = r * Math.sin(a) * q;
    return [cx + x0 * cosT - y0 * sinT, cy + x0 * sinT + y0 * cosT];
  }
 
  function draw() {
    ctx.clearRect(0, 0, W, H);
    glow();
    ctx.lineCap = 'round';
 
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var far = smooth((s.r - 2.5 * rh) / (14 * rh));   // 0 near hole, 1 far away
      var q = 0.3 + 0.7 * far;                          // disk flattens near the hole
      var p = project(s.r, s.a, q);
      var X = p[0], Y = p[1];
      if (X < -20 || X > W + 20 || Y < -20 || Y > H + 20) continue;
 
      var k = rh / s.r;
      var omega = 0.7 * Math.pow(k, 1.4);
      var depth = 0.5 + 0.5 * Math.sin(s.a);            // front of disk is nearer
      var df = 1 + (depth - 0.5) * 0.9 * (1 - far);
 
      var tw = 0.8 + 0.2 * Math.sin(time * s.tw + s.ph);
      var horizon = clamp((s.r - rh * 1.05) / (rh * 1.2), 0, 1);
      var born = clamp(s.age / 2, 0, 1);
      var alpha = s.bright * df * tw * horizon * born * 0.9;
      if (alpha < 0.02) continue;
 
      var hot = clamp(1 - (s.r - rh) / (7 * rh), 0, 1);
      hot *= hot;
      var R = Math.round(196 + 59 * hot);
      var G = Math.round(214 - 38 * hot);
      var B = Math.round(255 - 145 * hot);
      var size = s.size * (0.8 + 0.4 * df);
 
      var streak = omega * s.r * 0.16;
      if (streak > 1.2) {
        var p0 = project(s.r, s.a - omega * 0.16, q);
        ctx.strokeStyle = 'rgba(' + R + ',' + G + ',' + B + ',' + alpha.toFixed(3) + ')';
        ctx.lineWidth = size;
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(X, Y); ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(' + R + ',' + G + ',' + B + ',' + alpha.toFixed(3) + ')';
        ctx.fillRect(X - size / 2, Y - size / 2, size, size);
      }
    }
 
    // Photon ring and event horizon
    ctx.save();
    ctx.shadowColor = 'rgba(255, 170, 100, 0.9)';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(255, 200, 150, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rh * 1.03, 0, 6.2832); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx, cy, rh, 0, 6.2832); ctx.fill();
  }
 
  function frame(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    time += dt;
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }
 
  function start() {
    cancelAnimationFrame(raf);
    if (mq.matches) { draw(); }
    else { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
 
  var lastW = 0, lastH = 0, timer = 0;
  function onResize() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      // Ignore small height changes (mobile address bar) so the sky doesn't reshuffle
      if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 150) return;
      lastW = window.innerWidth; lastH = window.innerHeight;
      layout();
      if (mq.matches) draw();
    }, 120);
  }
 
  lastW = window.innerWidth; lastH = window.innerHeight;
  layout();
  start();
  window.addEventListener('resize', onResize);
  if (mq.addEventListener) mq.addEventListener('change', start);
 
  document.getElementById('printBtn').addEventListener('click', function () { window.print(); });
})();
 
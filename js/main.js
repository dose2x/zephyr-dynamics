(function () {
  var root = document.documentElement;
  function paused() { return root.classList.contains('motion-paused'); }

  /* ---------- pause / play control (WCAG 2.2.2) ---------- */
  var btn = document.querySelector('.top__motion');
  function paintButton() {
    if (!btn) return;
    var p = paused();
    btn.setAttribute('aria-pressed', p ? 'true' : 'false');
    btn.querySelector('.top__motion-t').textContent = p ? 'Play motion' : 'Pause motion';
  }
  if (btn) {
    btn.addEventListener('click', function () {
      root.classList.toggle('motion-paused');
      try { localStorage.setItem('zd-motion', paused() ? 'paused' : 'playing'); } catch (e) {}
      paintButton();
      document.dispatchEvent(new Event('motionchange'));
    });
  }
  paintButton();

  /* ---------- reveal on scroll ---------- */
  var targets = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    targets.forEach(function (t) { t.classList.add('in'); });
  }

  /* ---------- circuit lap: a marker runs the 3D track, lighting up each sector ---------- */
  var path = document.getElementById('circuit');
  var dot = document.getElementById('dot');
  var track = document.querySelector('.track');
  var tilt = document.querySelector('.track__tilt');
  var stage = document.querySelector('.track__stage');
  var beacon = document.querySelector('.beacon');
  var beaconS = document.getElementById('beacon-s');
  var beaconT = document.getElementById('beacon-t');
  var sectors = document.querySelectorAll('.sector');
  if (!path || !dot || !track || !tilt) return;

  var total = path.getTotalLength();
  var progress = 0.02;
  var pinned = false;
  var last = null;
  var visible = false;
  var raf = 0;

  // camera: slow drift while motion is on, plus a lean toward the cursor (the cursor lean works even when paused)
  var BASE_RX = 54, BASE_RZ = -16;
  var cam = { rx: BASE_RX, rz: BASE_RZ }, aim = { x: 0, y: 0, on: false };

  // measure once and on resize, not every frame
  var tw = 0, th = 0;
  function measure() { tw = tilt.offsetWidth; th = tilt.offsetHeight; setProgress(progress, true); }
  if (window.ResizeObserver) new ResizeObserver(measure).observe(tilt); else window.addEventListener('resize', measure);

  function placeBeacon(pt) {
    var x = pt.x / 800 * tw, y = pt.y / 450 * th;
    beacon.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,14px) rotateZ(' + (-cam.rz).toFixed(2) + 'deg) rotateX(' + (-cam.rx).toFixed(2) + 'deg)';
  }

  function setProgress(p, force) {
    var pt = path.getPointAtLength(p * total);
    dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
    placeBeacon(pt);
    var s = Math.min(3, Math.floor(p * 4));
    if (force || track.getAttribute('data-active') !== String(s)) {
      track.setAttribute('data-active', s);
      sectors.forEach(function (el, i) { el.classList.toggle('on', i === s); });
      beaconS.textContent = sectors[s].querySelector('.sector__n').textContent;
      beaconT.textContent = sectors[s].querySelector('h3').textContent;
    }
  }

  function applyCamera(t, drifting) {
    var tx = BASE_RX + (aim.on ? -aim.y * 9 : 0);
    var tz = BASE_RZ + (aim.on ? aim.x * 16 : (drifting ? Math.sin(t / 5200) * 7 : 0));
    cam.rx += (tx - cam.rx) * 0.08; cam.rz += (tz - cam.rz) * 0.08;
    tilt.style.setProperty('--rx', cam.rx.toFixed(2) + 'deg');
    tilt.style.setProperty('--rz', cam.rz.toFixed(2) + 'deg');
    return !drifting && Math.abs(tx - cam.rx) + Math.abs(tz - cam.rz) < 0.02;     // true once the camera has come to rest
  }

  function frame(t) {
    raf = 0;
    if (!visible) return;
    if (last === null) last = t;
    var dt = t - last; last = t;
    var moving = !paused();
    if (moving && !pinned) progress = (progress + dt / 14000) % 1;
    var settled = applyCamera(t, moving);
    setProgress(progress);
    if (!settled) raf = requestAnimationFrame(frame);       // stops by itself when paused and the camera is at rest
  }

  function wake() {
    if (raf || !visible) return;
    last = null;
    raf = requestAnimationFrame(frame);
  }

  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) wake(); }).observe(track);
  document.addEventListener('motionchange', wake);

  stage.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var r = stage.getBoundingClientRect();
    aim.x = (e.clientX - r.left) / r.width - 0.5; aim.y = (e.clientY - r.top) / r.height - 0.5; aim.on = true;
    wake();
  });
  stage.addEventListener('pointerleave', function () { aim.on = false; wake(); });

  // step cards: hover or focus previews a step; a click (or Enter / Space) locks it until clicked again
  var locked = -1;
  var sectorBtns = Array.prototype.map.call(sectors, function (el) { return el.querySelector('.sector__btn'); });
  sectors.forEach(function (el, i) {
    var b = sectorBtns[i];
    function preview() { if (locked === -1) { pinned = true; progress = (i + 0.5) / 4; setProgress(progress); wake(); } }
    function release() { if (locked === -1) { pinned = false; wake(); } }
    el.addEventListener('mouseenter', preview);
    el.addEventListener('mouseleave', release);
    b.addEventListener('focus', preview);
    b.addEventListener('blur', release);
    b.addEventListener('click', function () {
      if (locked === i) { locked = -1; pinned = false; }
      else { locked = i; pinned = true; progress = (i + 0.5) / 4; setProgress(progress); }
      sectorBtns.forEach(function (x, k) { x.setAttribute('aria-pressed', k === locked ? 'true' : 'false'); });
      wake();
    });
  });

  measure();          // first placement of the marker, even when motion is paused
  applyCamera(0, false);
})();

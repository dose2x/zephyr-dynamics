(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce) document.querySelectorAll('svg').forEach(function (s) { if (s.pauseAnimations) s.pauseAnimations(); });

  // reveal on scroll
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

  // circuit lap: a marker runs the 3D track, lighting up each sector as it passes
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
  var visible = true;

  // camera: slow drift, plus a lean toward the cursor
  var BASE_RX = 54, BASE_RZ = -16;
  var cam = { rx: BASE_RX, rz: BASE_RZ }, aim = { x: 0, y: 0, on: false };

  function placeBeacon(pt) {
    var x = pt.x / 800 * tilt.offsetWidth, y = pt.y / 450 * tilt.offsetHeight;
    beacon.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,14px) rotateZ(' + (-cam.rz).toFixed(2) + 'deg) rotateX(' + (-cam.rx).toFixed(2) + 'deg)';
  }

  var lastPt = path.getPointAtLength(progress * total);
  function setProgress(p) {
    var pt = path.getPointAtLength(p * total);
    lastPt = pt;
    dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
    placeBeacon(pt);
    var s = Math.min(3, Math.floor(p * 4));
    if (track.getAttribute('data-active') !== String(s)) {
      track.setAttribute('data-active', s);
      sectors.forEach(function (el, i) { el.classList.toggle('on', i === s); });
      beaconS.textContent = sectors[s].querySelector('.sector__n').textContent;
      beaconT.textContent = sectors[s].querySelector('h3').textContent;
    }
  }

  function applyCamera(t) {
    var tx = BASE_RX + (aim.on ? -aim.y * 9 : 0);
    var tz = BASE_RZ + (aim.on ? aim.x * 16 : Math.sin(t / 5200) * 7);
    cam.rx += (tx - cam.rx) * 0.08; cam.rz += (tz - cam.rz) * 0.08;
    tilt.style.setProperty('--rx', cam.rx.toFixed(2) + 'deg');
    tilt.style.setProperty('--rz', cam.rz.toFixed(2) + 'deg');
  }

  function tick(t) {
    if (last === null) last = t;
    var dt = t - last; last = t;
    if (visible && !reduce) {
      if (!pinned) progress = (progress + dt / 14000) % 1;
      applyCamera(t);
      setProgress(pinned ? progress : progress);
    }
    requestAnimationFrame(tick);
  }

  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(track);

  stage.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var r = stage.getBoundingClientRect();
    aim.x = (e.clientX - r.left) / r.width - 0.5; aim.y = (e.clientY - r.top) / r.height - 0.5; aim.on = true;
  });
  stage.addEventListener('pointerleave', function () { aim.on = false; });

  sectors.forEach(function (el, i) {
    function pin() { pinned = true; progress = (i + 0.5) / 4; setProgress(progress); }
    function release() { pinned = false; }
    el.addEventListener('mouseenter', pin);
    el.addEventListener('mouseleave', release);
    el.addEventListener('focus', pin);
    el.addEventListener('blur', release);
    el.addEventListener('click', function () { pinned ? release() : pin(); });
  });

  setProgress(progress);
  requestAnimationFrame(tick);
})();

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

  // circuit lap: a dot runs the track, lighting up each sector as it passes
  var path = document.getElementById('circuit');
  var dot = document.getElementById('dot');
  var ring = document.getElementById('dot-ring');
  var track = document.querySelector('.track');
  var sectors = document.querySelectorAll('.sector');
  if (!path || !dot || !track) return;

  var total = path.getTotalLength();
  var progress = 0.02;
  var pinned = false;
  var last = null;
  var visible = true;

  function setProgress(p) {
    var pt = path.getPointAtLength(p * total);
    dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
    ring.setAttribute('cx', pt.x); ring.setAttribute('cy', pt.y);
    var s = Math.min(3, Math.floor(p * 4));
    if (track.getAttribute('data-active') !== String(s)) {
      track.setAttribute('data-active', s);
      sectors.forEach(function (el, i) { el.classList.toggle('on', i === s); });
    }
  }

  function tick(t) {
    if (last === null) last = t;
    var dt = t - last; last = t;
    if (!pinned && visible && !reduce) {
      progress = (progress + dt / 14000) % 1;
      setProgress(progress);
    }
    requestAnimationFrame(tick);
  }

  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(track);

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

/* Package-card demos: two scaled-down sites that slowly scroll, a phone app that
   ticks its own tasks off, and an assistant that answers questions. Loops run only
   while the cards are on screen and the tab is in front. With reduced motion on,
   each demo shows a finished still. */
(function () {
  'use strict';
  var cards = document.querySelector('#build .cards');
  if (!cards) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var B = function (n) { return cards.querySelector('[data-bind="' + n + '"]'); };

  /* ---------- scale each 720px-wide site to fit its browser frame ---------- */
  function fit() {
    cards.querySelectorAll('.browser__view').forEach(function (view) {
      var site = view.querySelector('.site'), pan = view.querySelector('.pan');
      var k = view.clientWidth / 720;
      site.style.setProperty('--k', k);
      var total = site.offsetHeight * k;
      pan.style.height = total + 'px';
      pan.style.setProperty('--pan', Math.max(0, total - view.clientHeight) + 'px');
    });
  }
  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(cards); else window.addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  /* ---------- run / pause plumbing ---------- */
  var running = false, waiters = [], inView = false;
  function update() {
    var go = inView && !document.hidden;
    if (go === running) return;
    running = go;
    if (go) { var w = waiters; waiters = []; w.forEach(function (f) { f(); }); }
  }
  function gate() { return running ? Promise.resolve() : new Promise(function (r) { waiters.push(r); }); }
  function sleep(ms) { return gate().then(function () { return new Promise(function (r) { setTimeout(r, ms); }); }).then(gate); }
  function div(cls, text) { var d = document.createElement('div'); d.className = cls; if (text) d.textContent = text; return d; }
  function typeInto(el, text, speed) {
    var i = 0;
    return new Promise(function (resolve) {
      (function tick() {
        gate().then(function () {
          el.textContent = text.slice(0, ++i);
          if (i < text.length) setTimeout(tick, speed); else resolve();
        });
      })();
    });
  }

  /* ---------- phone app ---------- */
  var tasks = B('tasks').querySelectorAll('li'), ring = B('ring'), count = B('count');
  var CIRC = 100.53;
  function setDone(n) {
    for (var i = 0; i < tasks.length; i++) tasks[i].classList.toggle('done', i < n);
    ring.style.strokeDashoffset = CIRC * (1 - n / tasks.length);
    count.textContent = n;
  }
  function taskLoop() {
    var n = 0;
    (function next() {
      sleep(1300).then(function () {
        if (n < tasks.length) setDone(++n);
        else return sleep(2400).then(function () { n = 0; setDone(0); });
      }).then(next);
    })();
  }

  /* ---------- assistant chat ---------- */
  var QA = [
    ['What time do you open on Sunday?', 'We open at 8 am on Sundays. Want me to save you a table?'],
    ['Do you ship your beans?', 'Yes, we ship nationwide. Orders over $40 ship free.'],
    ['Do you have oat milk?', 'We do. Oat, almond or whole. Anything else I can help with?']
  ];
  var log = B('chat');
  function trim(el, max) { while (el.children.length > max) el.removeChild(el.firstChild); }
  function chatLoop() {
    var k = 0;
    (function next() {
      var qa = QA[k++ % QA.length];
      sleep(900).then(function () { log.appendChild(div('msg msg--me', qa[0])); trim(log, 4); return sleep(600); })
        .then(function () {
          var t = div('msg msg--bot msg--typing'); t.innerHTML = '<i></i><i></i><i></i>';
          log.appendChild(t); trim(log, 4);
          return sleep(1100).then(function () {
            var bot = div('msg msg--bot'); log.replaceChild(bot, t);
            return typeInto(bot, qa[1], 24);
          });
        })
        .then(function () { return sleep(2800); })
        .then(next);
    })();
  }

  /* ---------- start ---------- */
  if (reduce) {
    setDone(tasks.length);
    log.appendChild(div('msg msg--me', QA[0][0])); log.appendChild(div('msg msg--bot', QA[0][1]));
    return;
  }
  taskLoop(); chatLoop();
  new IntersectionObserver(function (e) { inView = e[0].isIntersecting; update(); }, { threshold: 0.1 }).observe(cards);
  document.addEventListener('visibilitychange', update);
})();

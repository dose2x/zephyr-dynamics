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
    cards.querySelectorAll('.phone__screen').forEach(function (scr) {
      var fl = scr.querySelector('.fl'), k = scr.clientWidth / 300;
      fl.style.setProperty('--kp', k);
      fl.style.setProperty('--hh', (scr.clientHeight / k) + 'px');
    });
  }
  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(cards); else window.addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  /* ---------- run / pause plumbing ---------- */
  var running = false, waiters = [], inView = false;
  function update() {
    var go = inView && !document.hidden && !document.documentElement.classList.contains('motion-paused');
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
  var CIRC = ring.getTotalLength();
  ring.style.strokeDasharray = CIRC; ring.style.strokeDashoffset = CIRC;
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
    ['Do you take walk-ins?', 'For emergencies, yes. Cleanings are best booked. Want me to find a time?'],
    ['Cleaning on Friday morning?', 'Friday has 9:30 and 11:00 open. Which works for you?'],
    ['9:30 please', 'Booked: Friday at 9:30 am. A confirmation is on its way to your email.']
  ];
  var log = B('chat');
  function trim(el, max) { while (el.children.length > max) el.removeChild(el.firstChild); }
  function chatLoop() {
    var k = 0;
    (function next() {
      var qa = QA[k++ % QA.length];
      sleep(900).then(function () { log.appendChild(div('msg msg--me', qa[0])); trim(log, 4); return sleep(600); })
        .then(function () {
          var t = div('msg msg--bot msg--typing'); for (var d = 0; d < 3; d++) t.appendChild(document.createElement('i'));
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
  document.addEventListener('motionchange', update);
})();

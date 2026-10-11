/* Showroom demos: each one is a small looping script that only runs while the
   section is on screen and the tab is in front. With reduced motion on, every
   demo shows a finished still instead of looping. */
(function () {
  'use strict';
  var root = document.querySelector('.show');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var B = function (n) { return root.querySelector('[data-bind="' + n + '"]'); };

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

  /* ---------- phone app: tasks tick themselves off ---------- */
  var tasks = B('tasks').querySelectorAll('li'), bar = B('bar'), count = B('count');
  function setDone(n) {
    for (var i = 0; i < tasks.length; i++) tasks[i].classList.toggle('done', i < n);
    bar.style.width = (n / tasks.length * 100) + '%';
    count.textContent = n;
  }
  function taskLoop() {
    var n = 0;
    (function next() {
      sleep(n === 0 ? 1200 : 1300).then(function () {
        if (n < tasks.length) { setDone(++n); } else { return sleep(2400).then(function () { n = 0; setDone(0); }); }
      }).then(next);
    })();
  }

  /* ---------- assistant chat ---------- */
  var QA = [
    ['What time do you open on Sunday?', 'We open at 8am on Sundays. Want me to save you a table?'],
    ['Do you ship your beans?', 'Yes, we ship nationwide. Orders over $40 ship free.'],
    ['Do you have oat milk?', 'We do! Oat, almond or whole. Anything else I can help with?']
  ];
  var log = B('chat');
  function trim(el, max) { while (el.children.length > max) el.removeChild(el.firstChild); }
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
  function chatLoop() {
    var k = 0;
    (function next() {
      var qa = QA[k++ % QA.length], me = div('msg msg--me', qa[0]);
      sleep(900).then(function () { log.appendChild(me); trim(log, 4); return sleep(600); })
        .then(function () {
          var t = div('msg msg--bot msg--typing'); t.innerHTML = '<i></i><i></i><i></i>';
          log.appendChild(t); trim(log, 4);
          return sleep(1100).then(function () {
            var bot = div('msg msg--bot'); log.replaceChild(bot, t);
            return typeInto(bot, qa[1], 24);
          });
        })
        .then(function () { return sleep(2600); })
        .then(next);
    })();
  }

  /* ---------- easy changes ---------- */
  var pvH = B('pv-h'), pvBtn = B('pv-btn'), pvHrs = B('pv-hrs'), eLog = B('edit-log'), eIn = B('edit-in');
  var EDITS = [
    ['Make the button orange.', function () { pvBtn.classList.add('orange'); }],
    ['Change the headline to "Fresh roasted today".', function () { pvH.classList.add('swap'); setTimeout(function () { pvH.textContent = 'Fresh roasted today'; pvH.classList.remove('swap'); }, 260); }],
    ['Add our opening hours.', function () { pvHrs.classList.add('on'); }]
  ];
  function resetEdits() {
    pvBtn.classList.remove('orange'); pvHrs.classList.remove('on');
    pvH.textContent = 'Welcome to Harbor Coffee'; eLog.innerHTML = ''; eIn.textContent = '';
  }
  function editLoop() {
    var k = 0;
    (function next() {
      if (k === EDITS.length) { k = 0; sleep(2600).then(function () { resetEdits(); return sleep(900); }).then(next); return; }
      var e = EDITS[k++];
      sleep(1000).then(function () { return typeInto(eIn, e[0], 38); })
        .then(function () { return sleep(500); })
        .then(function () {
          eLog.appendChild(div('msg msg--me', e[0])); trim(eLog, 4); eIn.textContent = '';
          return sleep(800);
        })
        .then(function () { e[1](); eLog.appendChild(div('ok', 'Done ✓')); trim(eLog, 4); })
        .then(next);
    })();
  }

  /* ---------- start ---------- */
  if (reduce) {                       // still images of each finished demo
    setDone(tasks.length);
    log.appendChild(div('msg msg--me', QA[0][0])); log.appendChild(div('msg msg--bot', QA[0][1]));
    EDITS.forEach(function (e) { e[1](); });
    eLog.appendChild(div('msg msg--me', EDITS[0][0])); eLog.appendChild(div('ok', 'Done ✓'));
    return;
  }
  taskLoop(); chatLoop(); editLoop();
  new IntersectionObserver(function (e) { inView = e[0].isIntersecting; update(); }, { threshold: 0.1 }).observe(root);
  document.addEventListener('visibilitychange', update);
})();

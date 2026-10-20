/* Hero wordmark intro: splits ZEPHYR / DYNAMICS into letters so each one can
   slide in from the left, blurred and slanted, one after another (see .giant .M in style.css).
   It plays on load and again every 20 seconds.
   The original stretched <text> stays in the markup as the no-JS / reduced-motion fallback. */
(function () {
  'use strict';
  var svg = document.querySelector('.giant svg');
  if (!svg || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var REPLAY_MS = 20000;   // how often the intro plays again
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  var built = false;
  function build() {
    if (built) return; built = true;
    var originals = Array.prototype.slice.call(svg.querySelectorAll('text'));
    var layer = el('g', { 'class': 'letters', 'aria-hidden': 'true' }, svg);
    var idx = 0;

    originals.forEach(function (orig) {
      var str = orig.textContent.trim(), cls = orig.getAttribute('class'), y = orig.getAttribute('y');
      var tmp = el('text', { 'class': cls, x: 0, y: y }, svg);        // unstretched copy, only for measuring
      tmp.textContent = str;
      var sx = 1000 / tmp.getComputedTextLength();                      // same stretch the original uses
      var row = el('g', { transform: 'scale(' + sx + ' 1)' }, layer);

      for (var i = 0; i < str.length; i++) {
        var m = el('g', { 'class': 'M' }, row);
        m.style.setProperty('--i', idx++);
        var t = el('text', { 'class': cls, x: tmp.getStartPositionOfChar(i).x, y: y }, m);
        t.textContent = str[i];
      }
      svg.removeChild(tmp);
      orig.style.display = 'none';
    });

    // replay the intro every REPLAY_MS while the title is on screen
    var letters = svg.querySelectorAll('.M'), visible = true;
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(svg);
    setInterval(function () {
      if (!visible || document.hidden || document.documentElement.classList.contains('motion-paused')) return;
      for (var i = 0; i < letters.length; i++) letters[i].style.animation = 'none';
      void svg.getBoundingClientRect();                                   // force reflow so the animation restarts
      for (var k = 0; k < letters.length; k++) letters[k].style.animation = '';
    }, REPLAY_MS);
  }

  (document.fonts && document.fonts.load ? document.fonts.load('150px Michroma').then(function () { return document.fonts.ready; }) : Promise.resolve())
    .then(build, build);
})();

/* Big ZEPHYR / DYNAMICS titles (hero and footer): splits each word into letters so that
   - the P and R can have the same cut-outs as the logo (the inner space opens to the left,
     and the R's stem stands apart), and
   - in the hero, each letter can slide in from the left, blurred and slanted, one after
     another (see .giant .M in style.css). That plays on load and again every 20 seconds.
   The original stretched <text> stays in the markup as the no-JS fallback. */
(function () {
  'use strict';
  var svgs = document.querySelectorAll('.giant svg, .foot__giant svg');
  if (!svgs.length) return;

  var REPLAY_MS = 20000;   // how often the hero intro plays again
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Pieces removed from a letter so it matches the logo. Measured on a 132px Michroma letter
  // with the title's outline, origin at the letter's start on the baseline (up is negative).
  var KEEP = 'M-200,-300H500V200H-200Z ';
  var CUTS = {
    P: 'M-20,-83H36V-54H-20Z',                     // stem removed between the top bar and the middle bar
    R: 'M-20,-83H39V-34.5H31V-56H-20Z'             // same, plus a slit between the stem and the leg
  };

  function build(svg, n) {
    var originals = Array.prototype.slice.call(svg.querySelectorAll('text'));
    var defs = el('defs', {}, svg);
    var layer = el('g', { 'class': 'letters', 'aria-hidden': 'true' }, svg);
    var idx = 0, made = {};

    originals.forEach(function (orig) {
      var str = orig.textContent.trim(), cls = orig.getAttribute('class'), y = orig.getAttribute('y');
      var tmp = el('text', { 'class': cls, x: 0, y: y }, svg);        // unstretched copy, only for measuring
      tmp.textContent = str;
      var cs = getComputedStyle(tmp);
      var gap = parseFloat(cs.letterSpacing) || 0;
      var k = (parseFloat(cs.fontSize) || 132) / 132;                   // cut-outs scale with the letter size
      // Browsers differ on where they put letter-spacing (after each letter, or half each side), so
      // measure the letters unspaced and add the gaps here; each letter is then drawn unspaced at its own spot.
      tmp.style.letterSpacing = '0';
      var x0 = parseFloat(orig.getAttribute('x')) || 0, want = parseFloat(orig.getAttribute('textLength')) || 1000;
      var sx = want / (tmp.getComputedTextLength() + (str.length - 1) * gap);   // fit the row to the width the markup asks for
      var row = el('g', { transform: 'translate(' + x0 + ' 0) scale(' + sx + ' 1)' }, layer);

      for (var i = 0; i < str.length; i++) {
        var ch = str[i];
        var m = el('g', { 'class': 'M' }, row);
        m.style.setProperty('--i', idx++);
        var at = el('g', { transform: 'translate(' + (tmp.getStartPositionOfChar(i).x + i * gap) + ' ' + y + ')' }, m);
        var t = el('text', { 'class': cls, x: 0, y: 0 }, at);
        t.style.letterSpacing = '0';
        t.textContent = ch;
        if (CUTS[ch]) {
          var id = 'zd-cut-' + n + '-' + ch + '-' + cls;
          if (!made[id]) {
            made[id] = true;
            el('path', { 'clip-rule': 'evenodd', d: KEEP + CUTS[ch], transform: 'scale(' + k + ')' }, el('clipPath', { id: id }, defs));
          }
          t.setAttribute('clip-path', 'url(#' + id + ')');
        }
      }
      svg.removeChild(tmp);
      orig.style.display = 'none';
    });
  }

  var built = false;
  function buildAll() {
    if (built) return; built = true;
    Array.prototype.forEach.call(svgs, build);

    // replay the hero intro every REPLAY_MS while the title is on screen
    var hero = document.querySelector('.giant svg');
    if (!hero) return;
    var letters = hero.querySelectorAll('.M'), visible = true;
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(hero);
    setInterval(function () {
      if (!visible || document.hidden || document.documentElement.classList.contains('motion-paused')) return;
      for (var i = 0; i < letters.length; i++) letters[i].style.animation = 'none';
      void hero.getBoundingClientRect();                                  // force reflow so the animation restarts
      for (var k = 0; k < letters.length; k++) letters[k].style.animation = '';
    }, REPLAY_MS);
  }

  (document.fonts && document.fonts.load ? document.fonts.load('150px Michroma').then(function () { return document.fonts.ready; }) : Promise.resolve())
    .then(buildAll, buildAll);
})();

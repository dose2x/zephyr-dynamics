/* Pit wall: a small, fully simulated race (20 cars on a looping circuit).
   One clock drives the timing tower, GPS dots, race pace grid and telemetry. */
(function () {
  'use strict';
  var root = document.querySelector('.wall');
  if (!root) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var B = function (n) { return root.querySelector('[data-bind="' + n + '"]'); };
  var ALL = function (n) { return root.querySelectorAll('[data-bind="' + n + '"]'); };

  var F = 3.8;          // display seconds per real second (21 s real lap reads as ~1:20)
  var TOTAL = 60;       // race distance, laps
  var BASE_LAP = 79.8;  // display lap time, used for gap maths

  var roster = [
    ['ZEP', 1, '#ff5a1f'], ['KAI', 4, '#4aa3ff'], ['MAR', 11, '#4aa3ff'], ['NOV', 16, '#2ecc71'], ['DEL', 22, '#2ecc71'],
    ['ORT', 27, '#f1c40f'], ['SAN', 31, '#f1c40f'], ['HAR', 44, '#e74c3c'], ['BRO', 55, '#e74c3c'], ['VAL', 63, '#b07cff'],
    ['QUI', 7, '#b07cff'], ['TAN', 14, '#1abc9c'], ['ROS', 18, '#1abc9c'], ['FAR', 23, '#dfe6ee'], ['IVE', 33, '#dfe6ee'],
    ['LUN', 38, '#e67e22'], ['PEL', 47, '#e67e22'], ['COR', 77, '#95a5a6'], ['GRE', 81, '#95a5a6'], ['ABE', 99, '#fd79a8']
  ];
  var TYRES = ['S', 'M', 'H'];
  var HEAT_ROWS = 8, HEAT_COLS = 36;
  var FUEL_MAX = 60, FUEL_USABLE = 50;   // tank size and usable stint fuel, litres

  var cars = roster.map(function (r, i) {
    return { i: i, code: r[0], no: r[1], color: r[2], base: i === 0 ? 20.55 : 20.95 + i * 0.045 };
  });
  var zep = cars[0];
  var t = 0, sessBest, sessLap, flag = false, flagEnd = 0, nextFlag = 40, nextMsg = 3, msgIdx = 0, uiClock = 0;

  function reset() {
    sessBest = [1e9, 1e9, 1e9]; sessLap = 1e9;
    cars.forEach(function (c, i) {
      c.p = -i * 0.009; c.mod = (Math.random() - 0.5) * 0.4;
      c.sec = [null, null, null]; c.secCls = ['', '', '']; c.secPB = [1e9, 1e9, 1e9];
      c.last = null; c.lastCls = ''; c.lapPB = 1e9;
      c.tyre = TYRES[i % 3]; c.pit = false; c.pitEnd = 0;
      c.started = false; c.lapN = 0; c.lastSec = 0; c.secStart = 0; c.lapStart = 0;
    });
    zep.fuel = FUEL_MAX; zep.uses = []; zep.use = 3.9;
  }

  function mean(a, n) { var s = a.slice(-n); if (!s.length) return 3.9; return s.reduce(function (x, y) { return x + y; }, 0) / s.length; }

  /* ---------- formatting ---------- */
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function lapFmt(s) { var m = Math.floor(s / 60); return m + ':' + (s - m * 60 < 10 ? '0' : '') + (s - m * 60).toFixed(3); }
  function secFmt(s) { return s.toFixed(3); }
  function clockFmt(s) { s = Math.floor(s); return pad(Math.floor(s / 3600), 2) + ':' + pad(Math.floor(s / 60) % 60, 2) + ':' + pad(s % 60, 2); }

  /* ---------- build UI ---------- */
  var tbody = B('tt'), rows = [];
  cars.forEach(function () {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td class="pos"></td><td><span class="drv"><i></i><span class="code"></span><em></em></span></td><td class="gap"></td>' +
      '<td class="hs s0"></td><td class="hs s1"></td><td class="hs s2"></td><td class="last"></td><td><span class="tyre"></span></td><td class="hs st"></td>';
    tbody.appendChild(tr);
    rows.push({
      tr: tr, pos: tr.querySelector('.pos'), pip: tr.querySelector('.drv i'), code: tr.querySelector('.code'), no: tr.querySelector('em'),
      gap: tr.querySelector('.gap'), s: [tr.querySelector('.s0'), tr.querySelector('.s1'), tr.querySelector('.s2')],
      last: tr.querySelector('.last'), tyre: tr.querySelector('.tyre'), st: tr.querySelector('.st')
    });
  });
  function setText(el, v) { if (el._v !== v) { el._v = v; el.textContent = v; } }
  function setCls(el, v) { if (el._c !== v) { el._c = v; el.className = v; } }

  var heat = [], heatEl = B('pace');
  for (var r = 0; r < HEAT_ROWS; r++) {
    var row = document.createElement('div'); row.className = 'pace__row';
    var lab = document.createElement('span'); lab.textContent = roster[r][0];
    var wrap = document.createElement('div'); wrap.className = 'pace__cells';
    var cells = [];
    for (var k = 0; k < HEAT_COLS; k++) { var c = document.createElement('i'); wrap.appendChild(c); cells.push(c); }
    row.appendChild(lab); row.appendChild(wrap); heatEl.appendChild(row);
    heat.push({ cells: cells, vals: [] });
  }
  function heatColor(d) {
    if (d < 0.25) return '#1fd060'; if (d < 0.9) return '#4fd45e'; if (d < 1.6) return '#a9dc4a';
    if (d < 2.6) return '#f2d03b'; if (d < 4.2) return '#f39c34'; return '#e5483f';
  }
  function paintHeat(i) {
    var h = heat[i];
    for (var k = 0; k < HEAT_COLS; k++) {
      var v = h.vals[k];
      h.cells[k].style.backgroundColor = v === undefined ? 'rgba(120,180,230,.08)' : heatColor(v);
    }
  }
  function seedHeat() {
    for (var i = 0; i < HEAT_ROWS; i++) {
      heat[i].vals = [];
      for (var k = 0; k < HEAT_COLS; k++) heat[i].vals.push(Math.max(0, (Math.random() * 3.2) * (0.6 + i * 0.12)));
      paintHeat(i);
    }
  }
  function pushHeat(i, lt) {
    var h = heat[i]; h.vals.push(Math.max(0, lt - sessLap));
    if (h.vals.length > HEAT_COLS) h.vals.shift();
    paintHeat(i);
  }

  var svgNS = 'http://www.w3.org/2000/svg';
  var path = document.getElementById('gps-path'), plen = path.getTotalLength();
  var dotsG = B('dots'), dots = [], meTag;
  cars.slice().reverse().forEach(function (c) {  // draw ZEP last so it sits on top
    var d = document.createElementNS(svgNS, 'circle');
    d.setAttribute('r', c.i === 0 ? 9 : 5.5); d.setAttribute('fill', c.color);
    d.setAttribute('class', c.i === 0 ? 'car me' : 'car');
    dotsG.appendChild(d); dots[c.i] = d;
  });
  var halo = document.createElementNS(svgNS, 'circle'); halo.setAttribute('r', 9); halo.setAttribute('class', 'halo'); dotsG.appendChild(halo);
  meTag = document.createElementNS(svgNS, 'text'); meTag.setAttribute('class', 'me'); meTag.textContent = 'ZEP'; dotsG.appendChild(meTag);
  var gpsSvg = root.querySelector('.gps');

  /* ---------- messages ---------- */
  var MSGS = [
    'DRS ENABLED',
    'CAR 01 (ZEP) NEW SITE LIVE. SECTOR 3 PURPLE',
    'FIXED PRICE CONFIRMED. NO SURPRISE INVOICES',
    'CAR 07 (QUI) LAP DELETED. TRACK LIMITS',
    'NO DISCOVERY PHASE DETECTED',
    'CAR 12 (TAN) AND CAR 33 (IVE) INCIDENT NOTED. NO FURTHER ACTION',
    'SCOPE CREEP DETECTED. NEUTRALISED',
    'CAR 01 (ZEP) BOX BOX. ASSISTANT APP FITTED',
    'RAIN RISK LOW. HOSTING UNAFFECTED',
    'CAR 44 (HAR) FIVE SECOND PENALTY. JARGON'
  ];
  var msgList = B('msgs');
  function addMsg(text) {
    var li = document.createElement('li');
    var tm = document.createElement('time'); tm.textContent = clockFmt(t * F);
    li.appendChild(tm); li.appendChild(document.createTextNode(text));
    msgList.insertBefore(li, msgList.firstChild);
    while (msgList.children.length > 7) msgList.removeChild(msgList.lastChild);
  }

  /* ---------- simulation ---------- */
  function step(dt) {
    t += dt;
    var flagF = flag ? 0.62 : 1, maxP = -9;
    cars.forEach(function (c) {
      var v = 1 / (c.base + c.mod) * flagF * (c.pit ? 0.5 : 1);
      var dp = v * dt * (1 + (Math.random() - 0.5) * 0.02);
      c.p += dp;
      if (c === zep && c.p > 0) zep.fuel = Math.max(0, zep.fuel - zep.use * dp * (c.pit ? 0.1 : 1));
      if (c.p > maxP) maxP = c.p;
      if (c.p < 0) return;
      if (c.pit && c.p > c.pitEnd) { c.pit = false; if (c === zep) zep.fuel = FUEL_MAX; c.tyre = TYRES[(TYRES.indexOf(c.tyre) + 1 + (Math.random() < .5 ? 1 : 0)) % 3]; }
      var lap = Math.floor(c.p), sec = Math.floor((c.p - lap) * 3);
      if (!c.started) { c.started = true; c.lapN = lap; c.lastSec = sec; c.secStart = t; c.lapStart = t; return; }
      if (lap === c.lapN && sec === c.lastSec) return;

      var prev = c.lastSec, st = (t - c.secStart) * F;
      var cls = st < sessBest[prev] ? 'pu' : (st < c.secPB[prev] ? 'gr' : 'ye');
      if (st < sessBest[prev]) sessBest[prev] = st;
      if (st < c.secPB[prev]) c.secPB[prev] = st;
      c.sec[prev] = st; c.secCls[prev] = cls; c.secStart = t;

      if (prev === 2) {                       // crossed the line
        var lt = (t - c.lapStart) * F;
        c.lastCls = lt < sessLap ? 'pu' : (lt < c.lapPB ? 'gr' : 'ye');
        if (lt < sessLap) sessLap = lt;
        if (lt < c.lapPB) c.lapPB = lt;
        c.last = lt; c.lapStart = t;
        c.mod = (Math.random() - 0.5) * 0.45;
        if (c.i < HEAT_ROWS) pushHeat(c.i, lt);
        if (c === zep) {
          zep.uses.push(zep.use); if (zep.uses.length > 10) zep.uses.shift();
          zep.use = 3.7 + Math.random() * 0.5;
          if (!c.pit && zep.fuel < 2.4 * mean(zep.uses, 10)) { c.pit = true; c.pitEnd = c.p + 0.28; addMsg('CAR 01 (ZEP) BOX BOX. FUEL AND TYRES'); }
        } else if (!c.pit && lap > 2 && Math.random() < 0.035) { c.pit = true; c.pitEnd = c.p + 0.28; }
      }
      c.lapN = lap; c.lastSec = sec;
    });

    // yellow-flag windows
    if (!flag && t > nextFlag) { flag = true; flagEnd = t + 7; addMsg('YELLOW FLAG SECTOR 2. TRACK CLEAR SOON'); }
    else if (flag && t > flagEnd) { flag = false; nextFlag = t + 35 + Math.random() * 30; addMsg('TRACK CLEAR'); }

    // race restart
    if (Math.floor(maxP) + 1 > TOTAL) { addMsg('CHEQUERED FLAG. NEW SESSION'); reset(); t = 0; nextFlag = 40; }

    // message ticker
    if (t > nextMsg) { addMsg(MSGS[msgIdx++ % MSGS.length]); nextMsg = t + 4.5 + Math.random() * 3; }
  }

  /* ---------- telemetry ---------- */
  var N = 240, tSpeed = [], tThr = [], tBrk = [], vNow = 120, vPrev = 120, teleAcc = 0;
  var CORNERS = [0.07, 0.19, 0.31, 0.45, 0.58, 0.7, 0.84];
  function profile(s) {
    var v = 318;
    CORNERS.forEach(function (c, k) { var x = (s - c) / 0.03; v -= (190 + 40 * Math.sin(k * 2.1)) * Math.exp(-x * x); });
    return Math.max(82, v);
  }
  function gearOf(v) { var g = 1; [80, 118, 158, 198, 238, 272, 300].forEach(function (b) { if (v > b) g++; }); return g; }
  for (var q = 0; q < N; q++) { tSpeed.push(150); tThr.push(60); tBrk.push(0); }
  var teleOut = { speed: B('t-speed'), thr: B('t-thr'), brk: B('t-brk') };
  var hudSpeed2 = B('speed2'), hudThr = B('thr'), hudBrk = B('brk'), hudDrs = B('drs');

  function telemetry(dt) {
    var s = ((zep.p % 1) + 1) % 1;
    var target = profile(s) * (flag ? 0.82 : 1);
    vPrev = vNow; vNow += (target - vNow) * Math.min(1, dt * 12);
    var dv = (vNow - vPrev) / Math.max(dt, 0.001);
    var brk = dv < -55 ? Math.min(100, -dv / 2.6) : 0;
    var thr = brk > 0 ? 0 : (vNow > 292 ? 100 : Math.max(0, Math.min(100, 28 + dv * 1.3 + vNow * 0.12)));
    teleAcc += dt;
    if (teleAcc > 1 / 30) {
      teleAcc = 0;
      tSpeed.push(vNow); tThr.push(thr); tBrk.push(brk);
      tSpeed.shift(); tThr.shift(); tBrk.shift();
      var a = '', b = '', c = '';
      for (var i = 0; i < N; i++) {
        var x = (i * 300 / (N - 1)).toFixed(1);
        a += x + ',' + (4 + 64 * (1 - (tSpeed[i] - 60) / 290)).toFixed(1) + ' ';
        b += x + ',' + (78 + 30 * (1 - tThr[i] / 100)).toFixed(1) + ' ';
        c += x + ',' + (114 + 30 * (1 - tBrk[i] / 100)).toFixed(1) + ' ';
      }
      teleOut.speed.setAttribute('points', a); teleOut.thr.setAttribute('points', b); teleOut.brk.setAttribute('points', c);
    }
    var sp = Math.round(vNow);
    setText(hudSpeed2, sp);
    setText(hudThr, Math.round(thr)); setText(hudBrk, Math.round(brk));
    var drs = !flag && vNow > 255 && (s < 0.12 || (s > 0.36 && s < 0.5));
    hudDrs.classList.toggle('on', drs);
  }

  /* ---------- render ---------- */
  var flagChip = B('flag'), lapChip = B('lap'), localChip = B('local'), sessChip = B('session');
  var wx = { track: B('track'), air: B('air'), hum: B('hum'), wind: B('wind'), rain: B('rain') };

  function renderDots() {
    cars.forEach(function (c) {
      var u = (((c.p % 1) + 1) % 1) * plen, pt = path.getPointAtLength(u);
      dots[c.i].setAttribute('cx', pt.x.toFixed(1)); dots[c.i].setAttribute('cy', pt.y.toFixed(1));
      if (c.i === 0) {
        halo.setAttribute('cx', pt.x.toFixed(1)); halo.setAttribute('cy', pt.y.toFixed(1));
        meTag.setAttribute('x', (pt.x + 14).toFixed(1)); meTag.setAttribute('y', (pt.y - 10).toFixed(1));
      }
    });
  }

  function renderTable() {
    var sorted = cars.slice().sort(function (a, b) { return b.p - a.p; });
    var lead = sorted[0].p;
    sorted.forEach(function (c, i) {
      var R = rows[i];
      setText(R.pos, i + 1);
      R.pip.style.background = c.color;
      setText(R.code, c.code); setText(R.no, String(c.no));
      var gp = (lead - c.p) * BASE_LAP;
      setText(R.gap, i === 0 ? 'LEADER' : (gp > BASE_LAP ? '+' + Math.floor(gp / BASE_LAP) + ' LAP' : '+' + gp.toFixed(3)));
      for (var k = 0; k < 3; k++) {
        setText(R.s[k], c.sec[k] === null ? '' : secFmt(c.sec[k]));
        setCls(R.s[k], 'hs s' + k + ' ' + c.secCls[k]);
      }
      setText(R.last, c.last === null ? '' : lapFmt(c.last));
      setCls(R.last, 'last ' + c.lastCls);
      setText(R.tyre, c.tyre); setCls(R.tyre, 'tyre ' + c.tyre);
      setText(R.st, c.pit ? 'PIT' : 'ON TRACK'); setCls(R.st, 'hs st' + (c.pit ? ' pit' : ''));
      R.tr.classList.toggle('me', c === zep);
    });
    setText(lapChip, Math.min(TOTAL, Math.floor(lead) + 1 < 1 ? 1 : Math.floor(lead) + 1));
  }

  var fb = {};
  ['f-lap', 'f-fill', 'f-lvl', 'f-race', 'f-stint', 'f-rl', 'f-ra', 'f-rw', 'f-pw', 'f-pt', 'f-n0', 'f-n1', 'f-n2', 'f-t0', 'f-t1', 'f-t2'].forEach(function (n) { fb[n] = B(n); });
  [0, 1, 2].forEach(function (k) { ['a', 'l', 's', 'r'].forEach(function (x) { fb['f-' + k + x] = B('f-' + k + x); }); });

  function renderFuel() {
    var lapNow = Math.max(1, Math.floor(zep.p) + 1);
    var fuel = zep.fuel, pct = fuel / FUEL_MAX * 100;
    var lastUse = zep.uses.length ? zep.uses[zep.uses.length - 1] : zep.use;
    var a5 = mean(zep.uses, 5), a10 = mean(zep.uses, 10);
    var worst = zep.uses.length ? Math.max.apply(null, zep.uses) : zep.use;
    var toGo = Math.max(0, TOTAL - lapNow + 1);
    setText(fb['f-lap'], lapNow);
    fb['f-fill'].style.width = pct.toFixed(1) + '%';
    setCls(fb['f-fill'], 'fuel__fill' + (pct < 18 ? ' low' : pct < 35 ? ' mid' : ''));
    setText(fb['f-lvl'], fuel.toFixed(1) + ' L (' + Math.round(pct) + '%)');
    setText(fb['f-race'], (toGo * a10).toFixed(1));
    var sec = Math.round(fuel / a10 * BASE_LAP);
    setText(fb['f-stint'], Math.floor(sec / 60) + ':' + pad(sec % 60, 2));
    [lastUse, a5, a10].forEach(function (u, k) {
      setText(fb['f-' + k + 'a'], u.toFixed(2));
      setText(fb['f-' + k + 'l'], (fuel / u).toFixed(2));
      setText(fb['f-' + k + 's'], (FUEL_USABLE / u).toFixed(2));
      setText(fb['f-' + k + 'r'], Math.max(0, toGo * u - fuel).toFixed(2));
    });
    var n = Math.max(2, Math.floor(FUEL_USABLE / a5));
    [0, 1, 2].forEach(function (k) {
      setText(fb['f-n' + k], (n + k) + ' LAPS');
      setText(fb['f-t' + k], (FUEL_USABLE / (n + k)).toFixed(2));
    });
    var rl = fuel / lastUse, ra = fuel / a10, rw = fuel / worst;
    setText(fb['f-rl'], rl.toFixed(1)); setText(fb['f-ra'], ra.toFixed(1)); setText(fb['f-rw'], rw.toFixed(1));
    var wa = lapNow + Math.floor(Math.min(rl, rw)), wb = lapNow + Math.floor(Math.max(rl, rw));
    setText(fb['f-pw'], wa + '–' + wb);
    setText(fb['f-pt'], clockFmt(t * F + (wa - lapNow) * BASE_LAP).slice(0, 5) + ' - ' + clockFmt(t * F + (wb - lapNow) * BASE_LAP).slice(0, 5));
  }

  function renderUI() {
    renderTable(); renderFuel();
    setText(flagChip, flag ? 'YELLOW · SECTOR 2' : 'TRACK CLEAR');
    flagChip.classList.toggle('is-yellow', flag);
    gpsSvg.classList.toggle('yellow', flag);
    setText(sessChip, clockFmt(t * F));
    setText(localChip, new Date().toLocaleTimeString('en-GB'));
    setText(wx.track, (30.5 + Math.sin(t / 9) * 0.6).toFixed(1));
    setText(wx.air, (24.1 + Math.sin(t / 13) * 0.3).toFixed(1));
    setText(wx.hum, Math.round(54 + Math.sin(t / 11) * 2));
    setText(wx.wind, (2.4 + Math.sin(t / 7) * 0.8).toFixed(1));
    setText(wx.rain, Math.max(0, Math.round(8 + Math.sin(t / 17) * 6)));
  }

  /* ---------- run ---------- */
  reset(); seedHeat();
  [1, 2, 3, 4].forEach(function (n) { addMsg(MSGS[MSGS.length - n]); });

  if (reduce) {                       // static snapshot, no loop
    for (var s = 0; s < 1700; s++) step(0.05);
    for (var f = 0; f < 120; f++) telemetry(1 / 30);
    renderDots(); renderUI(); return;
  }

  var running = false, last = null, uiAcc = 0;
  function frame(now) {
    if (!running) return;
    if (last === null) last = now;
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    step(dt); telemetry(dt); renderDots();
    uiAcc += dt;
    if (uiAcc > 0.25) { uiAcc = 0; renderUI(); }
    requestAnimationFrame(frame);
  }
  for (var w = 0; w < 400; w++) { step(0.05); telemetry(0.05); }   // warm start so the board is already populated
  renderDots(); renderUI();

  new IntersectionObserver(function (e) {
    var vis = e[0].isIntersecting;
    if (vis && !running) { running = true; last = null; requestAnimationFrame(frame); }
    else if (!vis) running = false;
  }).observe(root);
})();

/* Runs before first paint: marks the page as scripted, and restores the visitor's motion choice
   (their saved Pause button state, or the OS "reduce motion" setting) so nothing flashes into motion. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  try { if (localStorage.getItem('zd-motion') === 'paused') root.classList.add('motion-paused'); } catch (e) {}
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('motion-paused');
})();

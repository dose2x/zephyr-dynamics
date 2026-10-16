/* Looping video band. Plays one YouTube clip silently, from data-start to data-end, and loops it.
   Loads the YouTube player only when the band is near the screen, pauses it when scrolled away,
   and leaves the still thumbnail in place for reduced motion or if autoplay is blocked.
   To use an MP4 later, swap the <div data-yt ...> for a <video autoplay muted loop playsinline> and delete this file. */
(function () {
  'use strict';
  var band = document.querySelector('.loop');
  var host = band && band.querySelector('[data-yt]');
  if (!host) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var id = host.getAttribute('data-yt');
  var start = +host.getAttribute('data-start') || 0;
  var end = +host.getAttribute('data-end') || 0;
  var player = null, ready = false, onScreen = false, started = false;

  function sync() {
    if (!ready) return;
    if (onScreen && !document.hidden) player.playVideo(); else player.pauseVideo();
  }

  function build() {
    player = new YT.Player(host, {
      host: 'https://www.youtube-nocookie.com',
      videoId: id,
      playerVars: {
        start: start, end: end, autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0,
        modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1, cc_load_policy: 0
      },
      events: {
        onReady: function (e) { ready = true; e.target.mute(); sync(); },
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.PLAYING) band.classList.add('is-playing');
          if (e.data === YT.PlayerState.ENDED) { e.target.seekTo(start, true); e.target.playVideo(); }  // loop the clip, not the whole video
        }
      }
    });
  }

  function load() {
    if (started) return; started = true;
    window.onYouTubeIframeAPIReady = build;
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  new IntersectionObserver(function (e) {
    onScreen = e[0].isIntersecting;
    if (onScreen) load();
    sync();
  }, { rootMargin: '300px 0px' }).observe(band);
  document.addEventListener('visibilitychange', sync);
})();

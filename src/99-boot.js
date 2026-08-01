/* Boot: pick up the last player if there is one, otherwise ask who is playing.
   Also the tablet niceties — fullscreen on first touch, keep the screen awake. */
(function () {
  'use strict';

  /* -------------------------------------------------------- fullscreen */
  G.toggleFullscreen = function () {
    var el = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
      }
    } catch (e) { /* desktop browsers may refuse; harmless */ }
  };

  var askedFullscreen = false;
  function firstTouch() {
    G.resumeAudio();
    if (!askedFullscreen) {
      askedFullscreen = true;
      // Only on touch devices: on a laptop, forcing fullscreen is rude.
      if (matchMedia('(pointer: coarse)').matches && !document.fullscreenElement) G.toggleFullscreen();
    }
    keepAwake();
  }
  window.addEventListener('pointerdown', firstTouch, { once: false, passive: true });

  /* --------------------------------------------------------- wake lock */
  var lock = null;
  function keepAwake() {
    if (lock || !navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) {
      lock = l;
      l.addEventListener('release', function () { lock = null; });
    }).catch(function () { lock = null; });
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) keepAwake();
  });

  /* ------------------------------------------------------- speech warmup */
  // Android needs the voice list to be requested once before it is populated.
  if (window.speechSynthesis) { try { speechSynthesis.getVoices(); } catch (e) {} }

  /* ---------------------------------------------------------------- go */
  var last = G.accounts.last();
  if (last && G.accounts.byId(last)) {
    var a = G.accounts.byId(last);
    if (a.secret) {
      // Someone was playing here: still ask for the secret, siblings share tablets.
      G.start('segreto', { id: a.id });
    } else {
      G.accounts.login(a.id);
      G.start('giungla');
    }
  } else {
    G.start('accesso');
  }
})();

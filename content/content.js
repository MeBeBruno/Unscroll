(() => {
  'use strict';

  const {
    convertShortsUrl,
    isShortsVideoUrl,
    isBareShortsFeedUrl
  } = globalThis.YouTubeShortsRedirector;

  const INTERACTIVE_SUB_CONTROLS = new Set([
    'BUTTON',
    'INPUT',
    'SELECT',
    'TEXTAREA',
    'YT-ICON-BUTTON',
    'TP-YT-PAPER-ICON-BUTTON'
  ]);

  let lastRedirectTarget = null;
  let lastRedirectTimestamp = 0;

  function pausePlayingVideos() {
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
      try {
        video.pause();
        video.muted = true;
      } catch {
        // Ignorieren, falls das Video-Element noch nicht initialisiert ist
      }
    }
  }

  function performNavigation(targetUrl, shouldReplaceHistory) {
    const now = Date.now();
    if (lastRedirectTarget === targetUrl && now - lastRedirectTimestamp < 400) {
      return;
    }

    lastRedirectTarget = targetUrl;
    lastRedirectTimestamp = now;

    pausePlayingVideos();

    if (shouldReplaceHistory) {
      window.location.replace(targetUrl);
    } else {
      window.location.assign(targetUrl);
    }
  }

  function isOnShortsRoute() {
    const currentUrl = window.location.href;
    return isShortsVideoUrl(currentUrl) || isBareShortsFeedUrl(currentUrl);
  }

  function redirectIfCurrentPageIsShorts() {
    const targetUrl = convertShortsUrl(window.location.href);
    if (!targetUrl || targetUrl === window.location.href) {
      return;
    }
    performNavigation(targetUrl, true);
  }

  function findTargetAnchor(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (!(node instanceof Element)) {
        continue;
      }

      if (node.tagName === 'A') {
        return node;
      }

      // Klicks auf Drei-Punkte-Menüs, "Später ansehen" o. Ä. innerhalb einer Karte durchlassen
      if (
        INTERACTIVE_SUB_CONTROLS.has(node.tagName) ||
        node.getAttribute('role') === 'button'
      ) {
        return null;
      }
    }
    return null;
  }

  function handleClickCapture(event) {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    // Modifier-Klicks (neuer Tab/Fenster) nicht abfangen -> webRequest übernimmt im neuen Tab
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const anchor = findTargetAnchor(event);
    if (!anchor || anchor.hasAttribute('download')) {
      return;
    }

    if (anchor.target && anchor.target !== '_self') {
      return;
    }

    const rawHref = anchor.getAttribute('href');
    if (!rawHref) {
      return;
    }

    const targetUrl = convertShortsUrl(rawHref, window.location.origin);
    if (!targetUrl) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    // Wenn wir von Startseite/Suche kommen: assign() erhält die vorherige Seite im Verlauf.
    // Wenn wir bereits auf /shorts sind: replace() vermeidet History-Loops.
    performNavigation(targetUrl, isOnShortsRoute());
  }

  function handleYouTubeNavigateStart(event) {
    const currentTarget = convertShortsUrl(window.location.href);
    if (currentTarget) {
      performNavigation(currentTarget, true);
      return;
    }

    const detailUrl = event && event.detail && event.detail.url;
    if (typeof detailUrl !== 'string') {
      return;
    }

    const nextTarget = convertShortsUrl(detailUrl, window.location.origin);
    if (!nextTarget) {
      return;
    }

    performNavigation(nextTarget, isOnShortsRoute());
  }

  // Sofort-Prüfung bei document_start
  redirectIfCurrentPageIsShorts();

  document.addEventListener('click', handleClickCapture, true);
  window.addEventListener('yt-navigate-start', handleYouTubeNavigateStart, true);
  window.addEventListener('yt-navigate-finish', redirectIfCurrentPageIsShorts, true);
  window.addEventListener('state-navigateend', redirectIfCurrentPageIsShorts, true);
  window.addEventListener('popstate', redirectIfCurrentPageIsShorts, true);

  // Back/Forward-Cache (bfcache) abfangen
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      lastRedirectTarget = null;
      redirectIfCurrentPageIsShorts();
    }
  });
})();
(() => {
  'use strict';

  const { convertShortsUrl } = globalThis.YouTubeShortsRedirector;

  const YOUTUBE_MAIN_FRAME_PATTERNS = [
    '*://youtube.com/*',
    '*://www.youtube.com/*',
    '*://m.youtube.com/*'
  ];

  const YOUTUBE_HOST_FILTERS = [
    { hostEquals: 'youtube.com' },
    { hostEquals: 'www.youtube.com' },
    { hostEquals: 'm.youtube.com' }
  ];

  const REDIRECT_DEBOUNCE_MS = 400;
  const recentTabRedirects = new Map();

  // Schicht 1: Direkte Navigationen, externe Links, neue Tabs, Mittelklicks, Reloads
  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.method && details.method !== 'GET') {
        return {};
      }

      const redirectUrl = convertShortsUrl(details.url);
      if (!redirectUrl || redirectUrl === details.url) {
        return {};
      }

      return { redirectUrl };
    },
    {
      urls: YOUTUBE_MAIN_FRAME_PATTERNS,
      types: ['main_frame']
    },
    ['blocking']
  );

  // Schicht 2: YouTube-SPA-Navigationen via history.pushState / replaceState
  browser.webNavigation.onHistoryStateUpdated.addListener(
    (details) => {
      if (details.frameId !== 0) {
        return;
      }

      const redirectUrl = convertShortsUrl(details.url);
      if (!redirectUrl || redirectUrl === details.url) {
        return;
      }

      const now = Date.now();
      const lastEntry = recentTabRedirects.get(details.tabId);
      if (
        lastEntry &&
        lastEntry.url === redirectUrl &&
        now - lastEntry.timestamp < REDIRECT_DEBOUNCE_MS
      ) {
        return;
      }

      recentTabRedirects.set(details.tabId, { url: redirectUrl, timestamp: now });

      // loadReplace: true verhindert die Zurück-Button-Falle in Firefox
      browser.tabs
        .update(details.tabId, { url: redirectUrl, loadReplace: true })
        .catch(() => {});
    },
    { url: YOUTUBE_HOST_FILTERS }
  );

  browser.tabs.onRemoved.addListener((tabId) => {
    recentTabRedirects.delete(tabId);
  });
})();
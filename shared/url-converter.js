(() => {
  'use strict';

  const ALLOWED_HOSTNAMES = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com'
  ]);

  // Exakt 11-stellige Base64URL-Video-ID direkt unter /shorts/ (optionaler Trailing Slash).
  // Case-insensitive für "/shorts/", die erfasste Video-ID behält aber ihre exakte Groß-/Kleinschreibung.
  const SHORTS_VIDEO_PATH_REGEX = /^\/shorts\/([A-Za-z0-9_-]{11})(?:\/)?$/i;
  const BARE_SHORTS_PATH_REGEX = /^\/shorts(?:\/)?$/i;

  function parseAllowedYouTubeUrl(rawUrl, baseUrl) {
    if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
      return null;
    }

    let parsedUrl;
    try {
      parsedUrl = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    } catch {
      return null;
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }

    if (!ALLOWED_HOSTNAMES.has(parsedUrl.hostname.toLowerCase())) {
      return null;
    }

    return parsedUrl;
  }

  function convertShortsUrl(rawUrl, baseUrl) {
    const parsedUrl = parseAllowedYouTubeUrl(rawUrl, baseUrl);
    if (!parsedUrl) {
      return null;
    }

    const match = SHORTS_VIDEO_PATH_REGEX.exec(parsedUrl.pathname);
    if (!match) {
      return null;
    }

    const videoId = match[1];
    const targetUrl = new URL(parsedUrl.origin);
    targetUrl.pathname = '/watch';

    const orderedParams = new URLSearchParams();
    orderedParams.set('v', videoId);

    for (const [key, value] of parsedUrl.searchParams.entries()) {
      if (key.toLowerCase() === 'v') {
        continue;
      }
      orderedParams.append(key, value);
    }

    targetUrl.search = orderedParams.toString();
    targetUrl.hash = parsedUrl.hash;

    return targetUrl.toString();
  }

  function isShortsVideoUrl(rawUrl, baseUrl) {
    return convertShortsUrl(rawUrl, baseUrl) !== null;
  }

  function isBareShortsFeedUrl(rawUrl, baseUrl) {
    const parsedUrl = parseAllowedYouTubeUrl(rawUrl, baseUrl);
    if (!parsedUrl) {
      return false;
    }
    return BARE_SHORTS_PATH_REGEX.test(parsedUrl.pathname);
  }

  globalThis.YouTubeShortsRedirector = Object.freeze({
    convertShortsUrl,
    isShortsVideoUrl,
    isBareShortsFeedUrl
  });
})();
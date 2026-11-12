(() => {
  'use strict';

  const Shared = globalThis.FrameColorShared;
  if (!Shared || !Shared.claimRuntimeGuard('__frameColorContentGuard__')) {
    return;
  }

  const LOCAL_CACHE_KEY = '__ag_frame_color_cache__';
  const LEGACY_CACHE_KEYS = ['__ag_pwa_frame_color_v12__', '__ag_pwa_frame_color_v11__'];
  const IFRAME_ORIGIN = 'https://antigravity.static.usercontent.goog';

  // Exact Antigravity top header ("Antigravity" title bar) colors for the 4 standard presets:
  const LIGHT_DEFAULT_COLOR = '#fafafa'; // rgb(250, 250, 250)
  const LIGHT_STRONG_COLOR  = '#f3f3f3'; // rgb(243, 243, 243)
  const DARK_DEFAULT_COLOR  = '#111114'; // rgb(17, 17, 20)
  const DARK_STRONG_COLOR   = '#121216'; // rgb(18, 18, 22)

  let tornDown = false;
  let activeColor = Shared.DEFAULT_COLOR;
  let lastSyncedStorageColor = '';

  let hasIframeReport = false;
  let lastIframeDisplayColor = '';
  let lastIframeBaseColor = '';

  function readCachedColor() {
    try {
      const direct = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (Shared.isValidHexColor(direct)) {
        return direct.toLowerCase();
      }
      for (const legacyKey of LEGACY_CACHE_KEYS) {
        const legacy = window.localStorage.getItem(legacyKey);
        if (Shared.isValidHexColor(legacy)) {
          const normalized = legacy.toLowerCase();
          window.localStorage.setItem(LOCAL_CACHE_KEY, normalized);
          window.localStorage.removeItem(legacyKey);
          return normalized;
        }
      }
    } catch (_) {}
    return null;
  }

  function isStrongContrastFromStorage() {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.endsWith('.jetski.contrast')) {
          return window.localStorage.getItem(k) === '2';
        }
      }
    } catch (_) {}
    return false;
  }

  function mapThemeAndContrastToColor(isDark, isStrong) {
    if (isDark) {
      return isStrong ? DARK_STRONG_COLOR : DARK_DEFAULT_COLOR;
    }
    return isStrong ? LIGHT_STRONG_COLOR : LIGHT_DEFAULT_COLOR;
  }

  function detectFallbackHostColor() {
    const cached = readCachedColor();
    if (cached) return cached;

    const isStrong = isStrongContrastFromStorage();
    if (document.body && (document.body.classList.contains('dark-theme') || document.body.classList.contains('dark'))) {
      return mapThemeAndContrastToColor(true, isStrong);
    }

    try {
      const bcsp = window.localStorage.getItem('bcsp');
      if (bcsp === 'dark') return mapThemeAndContrastToColor(true, isStrong);
      if (bcsp === 'light') return mapThemeAndContrastToColor(false, isStrong);
    } catch (_) {}

    return mapThemeAndContrastToColor(false, isStrong);
  }

  function syncBaseColorToStorage(baseColor) {
    if (!Shared.isValidHexColor(baseColor)) return;
    const normalized = baseColor.toLowerCase();

    try {
      window.localStorage.setItem(LOCAL_CACHE_KEY, normalized);
    } catch (_) {}

    if (normalized === lastSyncedStorageColor) {
      return;
    }
    if (!Shared.isContextValid() || !chrome.storage || !chrome.storage.sync) {
      return;
    }

    lastSyncedStorageColor = normalized;
    try {
      chrome.storage.sync.get({ [Shared.COLOR_KEY]: '' }, (items) => {
        if (!Shared.isContextValid() || !items) return;
        if (items[Shared.COLOR_KEY] !== normalized) {
          chrome.storage.sync.set({ [Shared.COLOR_KEY]: normalized });
        }
      });
    } catch (_) {}
  }

  function requestIframeColors() {
    if (!Shared.isContextValid()) return;
    try {
      const iframes = document.querySelectorAll('iframe');
      for (const frame of iframes) {
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ __agFrameExtRequest: true }, '*');
        }
      }
    } catch (_) {}
  }

  function refreshColor() {
    if (!Shared.isContextValid()) {
      teardown();
      return;
    }

    // Clear live iframe lock if the child UI iframe was unmounted (e.g. navigated back to picker)
    if (hasIframeReport && document.body && !document.querySelector('iframe')) {
      hasIframeReport = false;
    }

    if (hasIframeReport && lastIframeDisplayColor && lastIframeBaseColor) {
      activeColor = lastIframeDisplayColor;
      syncBaseColorToStorage(lastIframeBaseColor);
    } else {
      activeColor = detectFallbackHostColor();
    }

    Shared.applyThemeColorMeta(activeColor);
  }

  // Apply startup color immediately at document_start to prevent any title bar flash
  activeColor = detectFallbackHostColor();
  Shared.applyThemeColorMeta(activeColor);

  const observer = new MutationObserver(refreshColor);

  function onWindowMessage(event) {
    if (tornDown) return;
    if (!Shared.isContextValid()) {
      teardown();
      return;
    }
    if (event.origin !== IFRAME_ORIGIN) return;
    if (event.data && event.data.__agFrameExt === true) {
      event.stopImmediatePropagation();
      const { displayColor, baseColor } = event.data;
      if (!Shared.isValidHexColor(displayColor) || !Shared.isValidHexColor(baseColor)) {
        return;
      }
      hasIframeReport = true;
      lastIframeDisplayColor = displayColor.toLowerCase();
      lastIframeBaseColor = baseColor.toLowerCase();
      refreshColor();
    }
  }

  function teardown() {
    if (tornDown) return;
    tornDown = true;
    try {
      observer.disconnect();
    } catch (_) {}
    window.removeEventListener('message', onWindowMessage, true);
    window.removeEventListener('storage', refreshColor);
  }

  window.addEventListener('message', onWindowMessage, true);
  window.addEventListener('storage', refreshColor);

  function startObserver() {
    if (!document.documentElement || !Shared.isContextValid()) return;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content', 'name', 'media', 'class', 'src']
    });
    refreshColor();
    requestIframeColors();
  }

  if (document.documentElement) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  }

  window.addEventListener('load', () => {
    refreshColor();
    requestIframeColors();
  });
})();

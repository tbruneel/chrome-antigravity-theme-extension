(() => {
  'use strict';

  const MODE_KEY = 'frameMode';
  const COLOR_KEY = 'frameColor';
  const LOCAL_CACHE_KEY = '__ag_pwa_frame_color_v12__';
  const LEGACY_CACHE_KEY = '__ag_pwa_frame_color_v11__';
  const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

  // Exact Antigravity top header ("Antigravity" title bar) colors for the 4 standard presets:
  const LIGHT_DEFAULT_COLOR = '#fafafa'; // rgb(250, 250, 250)
  const LIGHT_STRONG_COLOR  = '#f3f3f3'; // rgb(243, 243, 243)
  const DARK_DEFAULT_COLOR  = '#111114'; // rgb(17, 17, 20)
  const DARK_STRONG_COLOR   = '#121216'; // rgb(18, 18, 22)

  let tornDown = false;

  function isContextValid() {
    if (tornDown) return false;
    try {
      return typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  if (isContextValid()) {
    if (window.__agTopContentRuntimeId === chrome.runtime.id) {
      return;
    }
    window.__agTopContentRuntimeId = chrome.runtime.id;
  }

  let currentMode = 'auto';
  let manualColor = LIGHT_DEFAULT_COLOR;
  let activeColor = LIGHT_DEFAULT_COLOR;
  let hasIframeReport = false;
  let lastIframeDisplayColor = '';
  let lastIframeBaseColor = '';

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
    // 1. Prefer cached exact baseColor from the live UI iframe (supports all 4 presets + custom themes)
    try {
      const cached = window.localStorage.getItem(LOCAL_CACHE_KEY) || window.localStorage.getItem(LEGACY_CACHE_KEY);
      if (cached && HEX_COLOR_RE.test(cached)) {
        return cached.toLowerCase();
      }
    } catch (_) {}

    const isStrong = isStrongContrastFromStorage();

    // 2. First-run fallback before the iframe has reported once
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

  activeColor = detectFallbackHostColor();

  let applying = false;

  function applyFrameColor(color) {
    if (applying || !color || !isContextValid()) return;
    applying = true;
    try {
      const targetRoot = document.head || document.documentElement;
      if (!targetRoot) return;

      const metas = document.querySelectorAll('meta[name="theme-color"]');
      if (metas.length === 0) {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        meta.setAttribute('content', color);
        targetRoot.appendChild(meta);
      } else {
        metas.forEach((meta, index) => {
          if (index === 0) {
            if (meta.getAttribute('content') !== color) {
              meta.setAttribute('content', color);
            }
            if (meta.hasAttribute('media')) {
              meta.removeAttribute('media');
            }
          } else {
            meta.remove();
          }
        });
      }
    } finally {
      applying = false;
    }
  }

  function cacheBaseColorLocally(color) {
    if (!color || !HEX_COLOR_RE.test(color)) return;
    try {
      window.localStorage.setItem(LOCAL_CACHE_KEY, color.toLowerCase());
    } catch (_) {}
  }

  function handleLiveIframeColors(displayColor, baseColor) {
    if (!isContextValid()) {
      teardown();
      return;
    }
    if (!displayColor || !HEX_COLOR_RE.test(displayColor)) return;
    if (!baseColor || !HEX_COLOR_RE.test(baseColor)) return;

    hasIframeReport = true;
    lastIframeDisplayColor = displayColor.toLowerCase();
    lastIframeBaseColor = baseColor.toLowerCase();
    cacheBaseColorLocally(lastIframeBaseColor);

    if (currentMode === 'auto') {
      activeColor = lastIframeDisplayColor;
      applyFrameColor(activeColor);
    }
  }

  function requestIframeColors() {
    if (!isContextValid()) return;
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
    if (!isContextValid()) {
      teardown();
      return;
    }

    if (currentMode === 'manual') {
      activeColor = manualColor;
      cacheBaseColorLocally(activeColor);
      applyFrameColor(activeColor);
      return;
    }

    // If the child UI iframe was unmounted (e.g. navigated back to instance picker), clear live iframe lock
    if (hasIframeReport && document.body && !document.querySelector('iframe')) {
      hasIframeReport = false;
    }

    if (hasIframeReport && lastIframeDisplayColor) {
      activeColor = lastIframeDisplayColor;
    } else {
      activeColor = detectFallbackHostColor();
    }

    applyFrameColor(activeColor);
  }

  // Apply startup color immediately at document_start to prevent any title bar flash
  applyFrameColor(activeColor);

  const observer = new MutationObserver(() => {
    if (!isContextValid()) {
      teardown();
      return;
    }
    refreshColor();
  });

  function onWindowMessage(event) {
    if (tornDown) return;
    if (event.origin !== 'https://antigravity.static.usercontent.goog') return;
    if (event.data && event.data.__agFrameExt === true) {
      event.stopImmediatePropagation();
      handleLiveIframeColors(event.data.displayColor, event.data.baseColor);
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
    if (!document.documentElement || !isContextValid()) return;
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

  try {
    if (isContextValid() && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (!isContextValid()) {
          teardown();
          return;
        }
        if (msg && msg.type === 'AG_APPLY_FRAME_COLOR') {
          handleLiveIframeColors(msg.displayColor, msg.baseColor);
        }
      });
    }

    if (isContextValid() && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get({ [MODE_KEY]: 'auto', [COLOR_KEY]: LIGHT_DEFAULT_COLOR }, (items) => {
        if (!isContextValid() || !items) return;
        currentMode = items[MODE_KEY] === 'manual' ? 'manual' : 'auto';
        if (items[COLOR_KEY] && HEX_COLOR_RE.test(items[COLOR_KEY])) {
          manualColor = items[COLOR_KEY].toLowerCase();
        }
        refreshColor();
        if (currentMode === 'auto') {
          requestIframeColors();
        }
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (!isContextValid()) {
          teardown();
          return;
        }
        if (area === 'sync') {
          if (changes[MODE_KEY]) {
            currentMode = changes[MODE_KEY].newValue === 'manual' ? 'manual' : 'auto';
          }
          if (changes[COLOR_KEY] && changes[COLOR_KEY].newValue && HEX_COLOR_RE.test(changes[COLOR_KEY].newValue)) {
            manualColor = changes[COLOR_KEY].newValue.toLowerCase();
          }
          refreshColor();
          if (currentMode === 'auto') {
            requestIframeColors();
          }
        }
      });
    }
  } catch (_) {}
})();

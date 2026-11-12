(() => {
  'use strict';

  const MODE_KEY = 'frameMode';
  const COLOR_KEY = 'frameColor';
  const LOCAL_CACHE_KEY = '__ag_pwa_frame_color_v6__';

  // Exact Antigravity top header ("Antigravity" title bar) colors for all 4 combinations:
  const LIGHT_DEFAULT_COLOR = '#fafafa'; // rgb(250, 250, 250)
  const LIGHT_STRONG_COLOR  = '#f3f3f3'; // rgb(243, 243, 243)
  const DARK_DEFAULT_COLOR  = '#111114'; // rgb(17, 17, 20)
  const DARK_STRONG_COLOR   = '#121216'; // rgb(18, 18, 22)

  let currentMode = 'auto';
  let manualColor = LIGHT_DEFAULT_COLOR;
  let activeColor = LIGHT_DEFAULT_COLOR;

  function rgbToHex(rgbStr) {
    if (!rgbStr) return null;
    const m = rgbStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) < 0.95) return null; // Ignore translucent modal backdrops/scrims
    const r = Math.min(255, Math.max(0, parseInt(m[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(m[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(m[3], 10)));
    const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
    return {
      hex: '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join(''),
      isDark: luminance < 128
    };
  }

  function isStrongContrastFromStorage() {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.endsWith('.jetski.contrast')) {
          return window.localStorage.getItem(k) === '1';
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

  function detectThemeColorFromStorage() {
    const isStrong = isStrongContrastFromStorage();
    try {
      const cached = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (cached && /^#[0-9a-fA-F]{6}$/.test(cached)) {
        const lower = cached.toLowerCase();
        const isCachedDark = (lower === DARK_DEFAULT_COLOR || lower === DARK_STRONG_COLOR);
        return mapThemeAndContrastToColor(isCachedDark, isStrong);
      }

      const bcsp = window.localStorage.getItem('bcsp');
      if (bcsp === 'dark') return mapThemeAndContrastToColor(true, isStrong);
      if (bcsp === 'light') return mapThemeAndContrastToColor(false, isStrong);

      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && /theme|color.?scheme|appearance/i.test(k) && k !== LOCAL_CACHE_KEY) {
          const v = String(window.localStorage.getItem(k) || '').toLowerCase();
          if (v.includes('dark')) return mapThemeAndContrastToColor(true, isStrong);
          if (v.includes('light')) return mapThemeAndContrastToColor(false, isStrong);
        }
      }
    } catch (_) {}
    return mapThemeAndContrastToColor(false, isStrong);
  }

  function sampleExactPaletteAtPoint(x, y) {
    try {
      const elements = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
      for (const startEl of elements) {
        let el = startEl;
        while (el && el !== document.documentElement) {
          const parsed = rgbToHex(window.getComputedStyle(el).backgroundColor);
          if (
            parsed && (
              parsed.hex === LIGHT_DEFAULT_COLOR ||
              parsed.hex === LIGHT_STRONG_COLOR ||
              parsed.hex === DARK_DEFAULT_COLOR ||
              parsed.hex === DARK_STRONG_COLOR
            )
          ) {
            return parsed.hex;
          }
          el = el.parentElement;
        }
      }
    } catch (_) {}
    return null;
  }

  function detectThemeColorFromDom() {
    if (!document.body) return null;

    // 1. Walk all elements under the top header bar (piercing through any open modal backdrop/scrim)
    // to find the exact rendered header surface color (#fafafa, #f3f3f3, #111114, or #121216)
    const exactMatch =
      sampleExactPaletteAtPoint(200, 12) ||
      sampleExactPaletteAtPoint(16, 12) ||
      sampleExactPaletteAtPoint(16, 200);
    if (exactMatch) {
      return exactMatch;
    }

    // 2. Fallback: determine Light vs Dark from DOM classes/attributes or inner canvas color,
    // and combine with stored contrast (1 = Strong, 2 = Default).
    const isStrong = isStrongContrastFromStorage();

    if (
      document.body.classList.contains('dark-theme') ||
      document.body.classList.contains('dark') ||
      document.documentElement.classList.contains('dark-theme') ||
      document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.body.getAttribute('data-theme') === 'dark'
    ) {
      return mapThemeAndContrastToColor(true, isStrong);
    }

    if (
      document.body.classList.contains('light-theme') ||
      document.body.classList.contains('light') ||
      document.documentElement.classList.contains('light-theme') ||
      document.documentElement.classList.contains('light') ||
      document.documentElement.getAttribute('data-theme') === 'light' ||
      document.body.getAttribute('data-theme') === 'light'
    ) {
      return mapThemeAndContrastToColor(false, isStrong);
    }

    try {
      const bodyParsed = rgbToHex(window.getComputedStyle(document.body).backgroundColor);
      if (bodyParsed) {
        return mapThemeAndContrastToColor(bodyParsed.isDark, isStrong);
      }
    } catch (_) {}

    return null;
  }

  activeColor = detectThemeColorFromStorage();

  let applying = false;

  function applyFrameColor(color) {
    if (applying || !color) return;
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

  function persistDetectedColor(color) {
    try {
      window.localStorage.setItem(LOCAL_CACHE_KEY, color);
    } catch (_) {}
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get({ [COLOR_KEY]: '' }, (items) => {
        if (items[COLOR_KEY] !== color) {
          chrome.storage.sync.set({ [COLOR_KEY]: color });
        }
      });
    }
  }

  function refreshColor() {
    if (currentMode === 'manual') {
      activeColor = manualColor;
      try {
        window.localStorage.setItem(LOCAL_CACHE_KEY, activeColor);
      } catch (_) {}
      applyFrameColor(activeColor);
      return;
    }

    const domColor = detectThemeColorFromDom();
    const nextColor = domColor || detectThemeColorFromStorage();
    if (nextColor !== activeColor) {
      activeColor = nextColor;
      persistDetectedColor(activeColor);
    }
    applyFrameColor(activeColor);
  }

  applyFrameColor(activeColor);

  let rafPending = false;
  function scheduleRefresh() {
    if (rafPending) return;
    rafPending = true;
    window.requestAnimationFrame(() => {
      rafPending = false;
      refreshColor();
    });
  }

  const observer = new MutationObserver(() => {
    scheduleRefresh();
  });

  function startObserver() {
    if (!document.documentElement) return;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content', 'name', 'media', 'class', 'style', 'data-theme']
    });
    refreshColor();
  }

  if (document.documentElement) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  }

  window.addEventListener('load', () => {
    refreshColor();
    setTimeout(refreshColor, 300);
    setTimeout(refreshColor, 1000);
  });

  window.addEventListener('storage', refreshColor);
  window.addEventListener('click', () => {
    setTimeout(refreshColor, 20);
    setTimeout(refreshColor, 100);
    setTimeout(refreshColor, 300);
  }, true);

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ [MODE_KEY]: 'auto', [COLOR_KEY]: LIGHT_DEFAULT_COLOR }, (items) => {
      currentMode = items[MODE_KEY] === 'manual' ? 'manual' : 'auto';
      if (items[COLOR_KEY] && /^#[0-9a-fA-F]{6}$/.test(items[COLOR_KEY])) {
        manualColor = items[COLOR_KEY].toLowerCase();
      }
      refreshColor();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        if (changes[MODE_KEY]) {
          currentMode = changes[MODE_KEY].newValue === 'manual' ? 'manual' : 'auto';
        }
        if (changes[COLOR_KEY] && changes[COLOR_KEY].newValue && /^#[0-9a-fA-F]{6}$/.test(changes[COLOR_KEY].newValue)) {
          manualColor = changes[COLOR_KEY].newValue.toLowerCase();
        }
        refreshColor();
      }
    });
  }
})();

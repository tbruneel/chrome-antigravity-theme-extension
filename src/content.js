(() => {
  'use strict';

  const MODE_KEY = 'frameMode';
  const COLOR_KEY = 'frameColor';
  const LOCAL_CACHE_KEY = '__ag_pwa_frame_color_v3__';
  const LIGHT_COLOR = '#fafafa';
  const DARK_COLOR = '#1f1f1f';

  let currentMode = 'auto';
  let manualColor = LIGHT_COLOR;
  let activeColor = LIGHT_COLOR;

  function rgbToHex(rgbStr) {
    if (!rgbStr) return null;
    const m = rgbStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    const r = Math.min(255, Math.max(0, parseInt(m[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(m[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(m[3], 10)));
    const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
    return {
      hex: '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join(''),
      isDark: luminance < 128
    };
  }

  function detectThemeColorFromStorage() {
    try {
      const cached = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (cached && /^#[0-9a-fA-F]{6}$/.test(cached)) {
        return cached.toLowerCase();
      }
      const bcsp = window.localStorage.getItem('bcsp');
      if (bcsp === 'dark') return DARK_COLOR;
      if (bcsp === 'light') return LIGHT_COLOR;

      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && /theme|color.?scheme|appearance/i.test(k) && k !== LOCAL_CACHE_KEY) {
          const v = String(window.localStorage.getItem(k) || '').toLowerCase();
          if (v.includes('dark')) return DARK_COLOR;
          if (v.includes('light')) return LIGHT_COLOR;
        }
      }
    } catch (_) {}
    return LIGHT_COLOR;
  }

  function detectThemeColorFromDom() {
    if (!document.body) return null;

    if (
      document.body.classList.contains('dark-theme') ||
      document.body.classList.contains('dark') ||
      document.documentElement.classList.contains('dark-theme') ||
      document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.body.getAttribute('data-theme') === 'dark'
    ) {
      return DARK_COLOR;
    }

    if (
      document.body.classList.contains('light-theme') ||
      document.body.classList.contains('light') ||
      document.documentElement.classList.contains('light-theme') ||
      document.documentElement.classList.contains('light') ||
      document.documentElement.getAttribute('data-theme') === 'light' ||
      document.body.getAttribute('data-theme') === 'light'
    ) {
      return LIGHT_COLOR;
    }

    try {
      const candidates = [
        document.querySelector('header'),
        document.querySelector('[role="banner"]'),
        document.querySelector('nav'),
        document.querySelector('main'),
        document.body,
        document.documentElement
      ];
      for (const el of candidates) {
        if (!el) continue;
        const parsed = rgbToHex(window.getComputedStyle(el).backgroundColor);
        if (parsed) {
          return parsed.isDark ? DARK_COLOR : LIGHT_COLOR;
        }
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

  const observer = new MutationObserver(() => {
    refreshColor();
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
    setTimeout(refreshColor, 500);
    setTimeout(refreshColor, 1500);
  });

  window.addEventListener('storage', refreshColor);

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ [MODE_KEY]: 'auto', [COLOR_KEY]: LIGHT_COLOR }, (items) => {
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

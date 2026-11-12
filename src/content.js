(() => {
  'use strict';

  const MODE_KEY = 'frameMode';
  const COLOR_KEY = 'frameColor';
  const LOCAL_CACHE_KEY = '__ag_pwa_frame_color_v11__';

  // Exact Antigravity top header ("Antigravity" title bar) colors for all 4 combinations:
  const LIGHT_DEFAULT_COLOR = '#fafafa'; // rgb(250, 250, 250)
  const LIGHT_STRONG_COLOR  = '#f3f3f3'; // rgb(243, 243, 243)
  const DARK_DEFAULT_COLOR  = '#111114'; // rgb(17, 17, 20)
  const DARK_STRONG_COLOR   = '#121216'; // rgb(18, 18, 22)

  // Exact dimmed header colors when the Settings / Appearance overlay is open (30% black scrim):
  const OVERLAY_MAP = {
    [LIGHT_DEFAULT_COLOR]: '#afafaf', // rgb(175, 175, 175)
    [LIGHT_STRONG_COLOR]:  '#aaaaaa', // rgb(170, 170, 170)
    [DARK_DEFAULT_COLOR]:  '#0c0c0e', // rgb(12, 12, 14)
    [DARK_STRONG_COLOR]:   '#0d0d0f'  // rgb(13, 13, 15)
  };

  const VALID_PALETTE = new Set([
    LIGHT_DEFAULT_COLOR,
    LIGHT_STRONG_COLOR,
    DARK_DEFAULT_COLOR,
    DARK_STRONG_COLOR
  ]);

  let currentMode = 'auto';
  let manualColor = LIGHT_DEFAULT_COLOR;
  let activeColor = LIGHT_DEFAULT_COLOR;
  let tornDown = false;

  function isContextValid() {
    if (tornDown) return false;
    try {
      return typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  function parseEffectiveRgba(el) {
    if (!el || el === document.documentElement) return null;
    try {
      const style = window.getComputedStyle(el);
      const rgbStr = style.backgroundColor;
      if (!rgbStr) return null;
      const m = rgbStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
      if (!m) return null;
      const bgAlpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
      if (bgAlpha <= 0) return null;

      // Also factor in element opacity (e.g., Material .cdk-overlay-backdrop with background:#000 and opacity:0.3)
      const elOpacity = style.opacity !== undefined && style.opacity !== '' ? parseFloat(style.opacity) : 1;
      const a = Math.min(1, Math.max(0, bgAlpha * (isNaN(elOpacity) ? 1 : elOpacity)));
      if (a <= 0) return null;

      const r = Math.min(255, Math.max(0, parseInt(m[1], 10)));
      const g = Math.min(255, Math.max(0, parseInt(m[2], 10)));
      const b = Math.min(255, Math.max(0, parseInt(m[3], 10)));
      const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
      return {
        r,
        g,
        b,
        a,
        hex: '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join(''),
        isDark: luminance < 128
      };
    } catch (_) {
      return null;
    }
  }

  function rgbObjToHex(r, g, b) {
    const clamp = (v) => Math.min(255, Math.max(0, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
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

  function detectThemeColorFromStorage() {
    const isStrong = isStrongContrastFromStorage();
    try {
      const cached = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (cached && VALID_PALETTE.has(cached.toLowerCase())) {
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

  function isSettingsModalOpen() {
    try {
      // Check for open dialog / modal / backdrop elements in the DOM
      const dialogSelectors = [
        '[role="dialog"]',
        '[aria-modal="true"]',
        'dialog[open]',
        '.cdk-overlay-backdrop-showing',
        '[data-state="open"]'
      ];
      for (const sel of dialogSelectors) {
        const nodes = document.querySelectorAll(sel);
        for (const node of nodes) {
          const rect = node.getBoundingClientRect();
          if (rect.width > 200 && rect.height > 200) {
            return true;
          }
        }
      }

      // Also check if any full-viewport fixed/absolute backdrop element is covering the top header bar
      const topEls = document.elementsFromPoint ? document.elementsFromPoint(200, 12) : [];
      for (const el of topEls) {
        if (!el || el === document.body || el === document.documentElement) continue;
        const parsed = parseEffectiveRgba(el);
        if (parsed && VALID_PALETTE.has(parsed.hex) && parsed.a >= 0.99) {
          // Reached the un-covered header bar itself first, so no backdrop is above it
          break;
        }
        const style = window.getComputedStyle(el);
        if (
          (style.position === 'fixed' || style.position === 'absolute') &&
          el.getBoundingClientRect().width >= window.innerWidth * 0.8 &&
          el.getBoundingClientRect().height >= window.innerHeight * 0.8
        ) {
          if ((parsed && parsed.a < 0.99) || (style.backdropFilter && style.backdropFilter !== 'none')) {
            return true;
          }
        }
      }
    } catch (_) {}
    return false;
  }

  function collectLayersAtPoint(x, y) {
    const layers = [];
    const seen = new Set();
    try {
      const elements = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
      for (const startEl of elements) {
        let el = startEl;
        while (el && el !== document.documentElement) {
          if (!seen.has(el)) {
            seen.add(el);
            const parsed = parseEffectiveRgba(el);
            if (parsed) {
              layers.push(parsed);
            }
          }
          el = el.parentElement;
        }
      }
    } catch (_) {}
    return layers;
  }

  function detectThemeColorsFromDom() {
    if (!document.body) return null;

    const modalOpen = isSettingsModalOpen();

    // 1. Inspect the layer stack at the top header bar (200, 12) or (16, 12)
    const points = [
      [200, 12],
      [16, 12],
      [16, 200]
    ];

    for (const [x, y] of points) {
      const layers = collectLayersAtPoint(x, y);
      let overlay = null;
      for (const layer of layers) {
        if (layer.a < 0.99 && !overlay) {
          overlay = layer;
          continue;
        }
        if (layer.a >= 0.99 && VALID_PALETTE.has(layer.hex)) {
          const baseHex = layer.hex;
          if (overlay) {
            const r = (overlay.r * overlay.a) + (layer.r * (1 - overlay.a));
            const g = (overlay.g * overlay.a) + (layer.g * (1 - overlay.a));
            const b = (overlay.b * overlay.a) + (layer.b * (1 - overlay.a));
            return {
              displayColor: rgbObjToHex(r, g, b),
              baseColor: baseHex
            };
          }
          return {
            displayColor: modalOpen ? (OVERLAY_MAP[baseHex] || baseHex) : baseHex,
            baseColor: baseHex
          };
        }
      }
    }

    // 2. Fallback during early page load before the header/sidebar mounts:
    const isStrong = isStrongContrastFromStorage();
    let baseColor = null;

    if (
      document.body.classList.contains('dark-theme') ||
      document.body.classList.contains('dark') ||
      document.documentElement.classList.contains('dark-theme') ||
      document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.body.getAttribute('data-theme') === 'dark'
    ) {
      baseColor = mapThemeAndContrastToColor(true, isStrong);
    } else if (
      document.body.classList.contains('light-theme') ||
      document.body.classList.contains('light') ||
      document.documentElement.classList.contains('light-theme') ||
      document.documentElement.classList.contains('light') ||
      document.documentElement.getAttribute('data-theme') === 'light' ||
      document.body.getAttribute('data-theme') === 'light'
    ) {
      baseColor = mapThemeAndContrastToColor(false, isStrong);
    } else {
      try {
        const bodyParsed = parseEffectiveRgba(document.body);
        if (bodyParsed) {
          baseColor = mapThemeAndContrastToColor(bodyParsed.isDark, isStrong);
        }
      } catch (_) {}
    }

    if (baseColor) {
      return {
        displayColor: modalOpen ? (OVERLAY_MAP[baseColor] || baseColor) : baseColor,
        baseColor: baseColor
      };
    }

    return null;
  }

  activeColor = detectThemeColorFromStorage();

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

  let lastPersistedBaseColor = '';

  function persistDetectedColor(color) {
    if (!color || !VALID_PALETTE.has(color) || color === lastPersistedBaseColor || !isContextValid()) return;
    lastPersistedBaseColor = color;
    try {
      window.localStorage.setItem(LOCAL_CACHE_KEY, color);
    } catch (_) {}
    try {
      if (isContextValid() && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ [COLOR_KEY]: color });
      }
    } catch (_) {}
  }

  const observer = new MutationObserver(() => {
    scheduleRefresh();
  });

  let heartbeatId = null;

  function teardown() {
    if (tornDown) return;
    tornDown = true;
    try {
      observer.disconnect();
    } catch (_) {}
    if (heartbeatId !== null) {
      clearInterval(heartbeatId);
      heartbeatId = null;
    }
    window.removeEventListener('storage', refreshColor);
    window.removeEventListener('pointerdown', onUserInteraction, true);
    window.removeEventListener('pointerup', onUserInteraction, true);
    window.removeEventListener('click', onUserInteraction, true);
    window.removeEventListener('keydown', onUserInteraction, true);
    window.removeEventListener('keyup', onUserInteraction, true);
  }

  function refreshColor() {
    if (!isContextValid()) {
      teardown();
      return;
    }
    if (currentMode === 'manual') {
      activeColor = manualColor;
      try {
        window.localStorage.setItem(LOCAL_CACHE_KEY, activeColor);
      } catch (_) {}
      applyFrameColor(activeColor);
      return;
    }

    const domResult = detectThemeColorsFromDom();
    const nextDisplayColor = domResult ? domResult.displayColor : detectThemeColorFromStorage();
    const nextBaseColor = domResult ? domResult.baseColor : nextDisplayColor;

    if (nextBaseColor) {
      persistDetectedColor(nextBaseColor);
    }
    if (nextDisplayColor !== activeColor) {
      activeColor = nextDisplayColor;
    }
    applyFrameColor(activeColor);
  }

  applyFrameColor(activeColor);

  let rafPending = false;
  function scheduleRefresh() {
    if (rafPending || !isContextValid()) return;
    rafPending = true;
    window.requestAnimationFrame(() => {
      rafPending = false;
      refreshColor();
    });
  }

  function startObserver() {
    if (!document.documentElement || !isContextValid()) return;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content', 'name', 'media', 'class', 'style', 'data-theme', 'open', 'aria-hidden', 'data-state']
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

  // Poll briefly after any pointer/click/key interaction so modal open/close & theme/contrast switches update in real time
  function onUserInteraction() {
    if (!isContextValid()) {
      teardown();
      return;
    }
    refreshColor();
    setTimeout(refreshColor, 16);
    setTimeout(refreshColor, 50);
    setTimeout(refreshColor, 120);
    setTimeout(refreshColor, 250);
    setTimeout(refreshColor, 500);
  }

  window.addEventListener('pointerdown', onUserInteraction, true);
  window.addEventListener('pointerup', onUserInteraction, true);
  window.addEventListener('click', onUserInteraction, true);
  window.addEventListener('keydown', onUserInteraction, true);
  window.addEventListener('keyup', onUserInteraction, true);

  // Lightweight 250ms heartbeat while page is visible to guarantee sync; stops automatically if extension is reloaded
  heartbeatId = setInterval(() => {
    if (!isContextValid()) {
      teardown();
      return;
    }
    if (!document.hidden && currentMode === 'auto') {
      refreshColor();
    }
  }, 250);

  try {
    if (isContextValid() && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get({ [MODE_KEY]: 'auto', [COLOR_KEY]: LIGHT_DEFAULT_COLOR }, (items) => {
        if (!isContextValid() || !items) return;
        currentMode = items[MODE_KEY] === 'manual' ? 'manual' : 'auto';
        if (items[COLOR_KEY] && /^#[0-9a-fA-F]{6}$/.test(items[COLOR_KEY])) {
          manualColor = items[COLOR_KEY].toLowerCase();
        }
        refreshColor();
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (!isContextValid()) return;
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
  } catch (_) {}
})();

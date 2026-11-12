(() => {
  'use strict';

  if (window.location.hostname !== 'antigravity.static.usercontent.goog') {
    return;
  }

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
    if (window.__agIframeObserverRuntimeId === chrome.runtime.id) {
      return;
    }
    window.__agIframeObserverRuntimeId = chrome.runtime.id;
  }

  // Reusable 1x1 offscreen canvas to resolve any CSS Color 4 value (#hex, rgb, oklab, color(srgb ...))
  let colorCtx = null;
  function getColorContext() {
    if (colorCtx) return colorCtx;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      colorCtx = canvas.getContext('2d', { willReadFrequently: true });
    } catch (_) {
      colorCtx = null;
    }
    return colorCtx;
  }

  function rgbToHex(r, g, b) {
    const clamp = (v) => Math.min(255, Math.max(0, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  function resolveOpaqueRgb(cssColor) {
    if (!cssColor) return null;
    const trimmed = cssColor.trim();
    if (!trimmed || trimmed === 'transparent' || trimmed === 'rgba(0, 0, 0, 0)' || trimmed.startsWith('var(')) {
      return null;
    }

    const hex6 = trimmed.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (hex6) {
      return [parseInt(hex6[1], 16), parseInt(hex6[2], 16), parseInt(hex6[3], 16)];
    }

    const rgbMatch = trimmed.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgbMatch) {
      return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
    }

    const ctx = getColorContext();
    if (!ctx) return null;
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0)';
      ctx.fillStyle = trimmed;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      if (data[3] === 0) return null;
      return [data[0], data[1], data[2]];
    } catch (_) {
      return null;
    }
  }

  function parseCssColorWithAlpha(cssColor) {
    if (!cssColor) return null;
    const trimmed = cssColor.trim();
    if (!trimmed || trimmed === 'transparent' || trimmed === 'rgba(0, 0, 0, 0)') {
      return null;
    }

    // 1. Standard rgb() / rgba() (comma or space separated)
    const rgbaMatch = trimmed.match(
      /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i
    );
    if (rgbaMatch) {
      let a = 1;
      if (rgbaMatch[4] !== undefined) {
        a = rgbaMatch[4].endsWith('%') ? parseFloat(rgbaMatch[4]) / 100 : parseFloat(rgbaMatch[4]);
      }
      if (isNaN(a) || a <= 0) return null;
      return {
        r: parseFloat(rgbaMatch[1]),
        g: parseFloat(rgbaMatch[2]),
        b: parseFloat(rgbaMatch[3]),
        a: Math.min(1, Math.max(0, a))
      };
    }

    // 2. CSS Color 4 functional syntax with `/ alpha`, e.g. `oklab(0 0 0 / 0.3)` or `color(srgb 0 0 0 / 0.25)`
    const slashMatch = trimmed.match(/^(.*)\/\s*([\d.]+%?)\s*\)$/);
    if (slashMatch) {
      const alphaRaw = slashMatch[2];
      const a = alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw);
      if (isNaN(a) || a <= 0) return null;
      const opaqueExpr = slashMatch[1].trim() + ')';
      const rgb = resolveOpaqueRgb(opaqueExpr);
      if (!rgb) return null;
      return {
        r: rgb[0],
        g: rgb[1],
        b: rgb[2],
        a: Math.min(1, Math.max(0, a))
      };
    }

    // 3. Opaque CSS color
    const rgb = resolveOpaqueRgb(trimmed);
    if (!rgb) return null;
    return { r: rgb[0], g: rgb[1], b: rgb[2], a: 1 };
  }

  function blendOverlayOntoBase(baseRgb, overlay) {
    const a = overlay.a;
    const r = (overlay.r * a) + (baseRgb[0] * (1 - a));
    const g = (overlay.g * a) + (baseRgb[1] * (1 - a));
    const b = (overlay.b * a) + (baseRgb[2] * (1 - a));
    return rgbToHex(r, g, b);
  }

  function resolveBaseShellRgb() {
    try {
      const shellEl = document.querySelector('.agy-shell');
      if (shellEl) {
        const shellBg = window.getComputedStyle(shellEl).backgroundColor;
        const rgb = resolveOpaqueRgb(shellBg);
        if (rgb) return rgb;
      }

      if (document.documentElement) {
        const inlineShell = document.documentElement.style.getPropertyValue('--shell');
        if (inlineShell) {
          const rgb = resolveOpaqueRgb(inlineShell);
          if (rgb) return rgb;
        }
      }
    } catch (_) {}
    return null;
  }

  function detectActiveOverlay() {
    try {
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      if (vw <= 0 || vh <= 0) return null;

      // 1. Settings / Appearance modal (.settings-modal-backdrop)
      const settingsBackdrops = document.querySelectorAll('.settings-modal-backdrop');
      for (const bd of settingsBackdrops) {
        if (
          bd.getAttribute('aria-hidden') === 'true' ||
          bd.classList.contains('animate-modalFadeOut') ||
          bd.classList.contains('pointer-events-none')
        ) {
          continue;
        }
        const style = window.getComputedStyle(bd);
        if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
          continue;
        }

        // In narrow / full-screen mode (`p-0`), `.settings-modal-container` covers the top edge directly
        const container = bd.querySelector('.settings-modal-container');
        if (container) {
          const cRect = container.getBoundingClientRect();
          if (cRect.top <= 1 && cRect.width >= vw - 2 && cRect.height > 100) {
            const cRgb = resolveOpaqueRgb(window.getComputedStyle(container).backgroundColor);
            if (cRgb) {
              return { r: cRgb[0], g: cRgb[1], b: cRgb[2], a: 1 };
            }
          }
        }

        const parsed = parseCssColorWithAlpha(style.backgroundColor);
        return parsed || { r: 0, g: 0, b: 0, a: 0.3 };
      }

      // 2. Generic Base UI modals, drawers, and full-screen overlays
      const otherBackdrops = document.querySelectorAll(
        '[data-testid="modal-backdrop"], .aux-drawer-backdrop, .bg-overlay-default, [data-testid="side-panel-popover"] > div'
      );
      for (const bd of otherBackdrops) {
        if (
          bd.getAttribute('aria-hidden') === 'true' ||
          bd.closest('[aria-hidden="true"]') ||
          bd.hasAttribute('data-ending-style') ||
          bd.classList.contains('animate-modalFadeOut') ||
          bd.classList.contains('pointer-events-none') ||
          bd.style.opacity === '0' ||
          bd.style.pointerEvents === 'none'
        ) {
          continue;
        }
        const style = window.getComputedStyle(bd);
        if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
          continue;
        }
        const rect = bd.getBoundingClientRect();
        if (rect.top <= 2 && rect.width >= vw * 0.8 && rect.height >= 40) {
          const parsed = parseCssColorWithAlpha(style.backgroundColor);
          if (parsed && parsed.a > 0) {
            return parsed;
          }
        }
      }

      // 3. Fallback hit-test at the top header bar for any future modal backdrop covering `.agy-shell`
      if (document.elementsFromPoint) {
        const shellEl = document.querySelector('.agy-shell');
        const sampleX = Math.min(200, Math.floor(vw / 2));
        const topEls = document.elementsFromPoint(sampleX, 8);
        for (const el of topEls) {
          if (!el || el === document.body || el === document.documentElement) continue;
          if (el === shellEl) break;
          if (
            shellEl &&
            shellEl.contains(el) &&
            !el.closest('[data-base-ui-portal], [data-overlay-container]')
          ) {
            // Reached the normal header bar inside `.agy-shell` without hitting an overlay above it
            break;
          }
          if (
            el.getAttribute('aria-hidden') === 'true' ||
            el.closest('[aria-hidden="true"]') ||
            el.hasAttribute('data-ending-style') ||
            el.classList.contains('animate-modalFadeOut') ||
            el.style.opacity === '0'
          ) {
            continue;
          }
          const style = window.getComputedStyle(el);
          if (style.pointerEvents === 'none' || style.display === 'none' || style.visibility === 'hidden') {
            continue;
          }
          const rect = el.getBoundingClientRect();
          if (rect.top <= 2 && rect.width >= vw * 0.8 && rect.height >= vh * 0.8) {
            const parsed = parseCssColorWithAlpha(style.backgroundColor);
            if (parsed && parsed.a >= 0.05 && parsed.a < 0.99) {
              return parsed;
            }
          }
        }
      }
    } catch (_) {}
    return null;
  }

  let lastDisplayColor = '';
  let lastBaseColor = '';

  function computeAndEmit(force) {
    if (tornDown) return;

    const baseRgb = resolveBaseShellRgb();
    if (!baseRgb) return;

    const baseColor = rgbToHex(baseRgb[0], baseRgb[1], baseRgb[2]);
    const overlay = detectActiveOverlay();
    const displayColor = overlay ? blendOverlayOntoBase(baseRgb, overlay) : baseColor;

    if (!force && displayColor === lastDisplayColor && baseColor === lastBaseColor) {
      return;
    }

    lastDisplayColor = displayColor;
    lastBaseColor = baseColor;

    // 1. Direct zero-latency message to the top `antigravity.google.com` frame
    try {
      if (window.top && window.top !== window) {
        window.top.postMessage(
          {
            __agFrameExt: true,
            displayColor,
            baseColor
          },
          'https://antigravity.google.com'
        );
      }
    } catch (_) {}

    // 2. Relay to background service worker to persist baseColor & update manifest redirect rule
    if (isContextValid()) {
      try {
        chrome.runtime.sendMessage(
          {
            type: 'AG_FRAME_COLOR',
            displayColor,
            baseColor
          },
          () => {
            try {
              void chrome.runtime.lastError;
            } catch (_) {}
          }
        );
      } catch (_) {
        teardown();
      }
    } else {
      teardown();
    }
  }

  let rafPending = false;
  function scheduleCheck() {
    if (tornDown) return;
    if (!isContextValid()) {
      teardown();
      return;
    }
    computeAndEmit(false);
    if (!rafPending) {
      rafPending = true;
      window.requestAnimationFrame(() => {
        rafPending = false;
        computeAndEmit(false);
      });
    }
  }

  const observer = new MutationObserver(() => {
    scheduleCheck();
  });

  const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function onParentMessage(event) {
    if (tornDown) return;
    if (event.origin !== 'https://antigravity.google.com') return;
    if (event.data && event.data.__agFrameExtRequest === true) {
      computeAndEmit(true);
    }
  }

  function teardown() {
    if (tornDown) return;
    tornDown = true;
    try {
      observer.disconnect();
    } catch (_) {}
    window.removeEventListener('resize', scheduleCheck);
    window.removeEventListener('message', onParentMessage);
    if (mediaQuery && mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', scheduleCheck);
    }
  }

  function start() {
    if (!document.documentElement || !isContextValid()) return;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'style',
        'class',
        'aria-hidden',
        'data-ending-style',
        'data-agy-theme',
        'open',
        'data-state'
      ]
    });
    computeAndEmit(true);
  }

  if (document.documentElement) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  window.addEventListener('load', () => computeAndEmit(true));
  window.addEventListener('resize', scheduleCheck);
  window.addEventListener('message', onParentMessage);

  if (mediaQuery && mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', scheduleCheck);
  }

  try {
    if (isContextValid() && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (!isContextValid()) {
          teardown();
          return;
        }
        if (msg && msg.type === 'AG_REQUEST_COLOR') {
          computeAndEmit(true);
        }
      });
    }
  } catch (_) {}
})();

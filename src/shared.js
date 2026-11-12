(() => {
  'use strict';

  if (globalThis.FrameColorShared) {
    return;
  }

  const COLOR_KEY = 'frameColor';
  const DEFAULT_COLOR = '#fafafa';
  const RULE_ID = 1;
  const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

  function isValidHexColor(value) {
    return typeof value === 'string' && HEX_COLOR_RE.test(value);
  }

  function normalizeHexColor(value, fallback = DEFAULT_COLOR) {
    return isValidHexColor(value) ? value.toLowerCase() : fallback;
  }

  function isContextValid() {
    try {
      return typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  function claimRuntimeGuard(flagName) {
    if (!isContextValid()) return false;
    if (globalThis[flagName] === chrome.runtime.id) return false;
    globalThis[flagName] = chrome.runtime.id;
    return true;
  }

  function applyThemeColorMeta(color) {
    if (!color || typeof document === 'undefined') return;
    const targetRoot = document.head || document.documentElement;
    if (!targetRoot) return;

    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (
      metas.length === 1 &&
      metas[0].getAttribute('content') === color &&
      !metas[0].hasAttribute('media')
    ) {
      return;
    }

    if (metas.length === 0) {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', color);
      targetRoot.appendChild(meta);
      return;
    }

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

  // Lazy 1x1 offscreen canvas to resolve any CSS Color 4 value (#hex, rgb, oklab, color(srgb ...))
  let colorCtx = null;
  function getColorContext() {
    if (colorCtx) return colorCtx;
    if (typeof document === 'undefined') return null;
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
    if (!cssColor || typeof cssColor !== 'string') return null;
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
    if (!cssColor || typeof cssColor !== 'string') return null;
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

  globalThis.FrameColorShared = Object.freeze({
    COLOR_KEY,
    DEFAULT_COLOR,
    RULE_ID,
    isValidHexColor,
    normalizeHexColor,
    isContextValid,
    claimRuntimeGuard,
    applyThemeColorMeta,
    rgbToHex,
    resolveOpaqueRgb,
    parseCssColorWithAlpha,
    blendOverlayOntoBase
  });
})();

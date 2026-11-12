(() => {
  'use strict';

  if (window.location.hostname !== 'antigravity.static.usercontent.goog') {
    return;
  }

  const Shared = globalThis.FrameColorShared;
  if (!Shared || !Shared.claimRuntimeGuard('__frameColorIframeGuard__')) {
    return;
  }

  const HOST_ORIGIN = 'https://antigravity.google.com';
  let tornDown = false;
  let lastDisplayColor = '';
  let lastBaseColor = '';

  function resolveBaseShellRgb() {
    try {
      const shellEl = document.querySelector('.agy-shell');
      if (shellEl) {
        const rgb = Shared.resolveOpaqueRgb(window.getComputedStyle(shellEl).backgroundColor);
        if (rgb) return rgb;
      }

      if (document.documentElement) {
        const inlineShell = document.documentElement.style.getPropertyValue('--shell');
        if (inlineShell) {
          const rgb = Shared.resolveOpaqueRgb(inlineShell);
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
            const cRgb = Shared.resolveOpaqueRgb(window.getComputedStyle(container).backgroundColor);
            if (cRgb) {
              return { r: cRgb[0], g: cRgb[1], b: cRgb[2], a: 1 };
            }
          }
        }

        return Shared.parseCssColorWithAlpha(style.backgroundColor) || { r: 0, g: 0, b: 0, a: 0.3 };
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
          const parsed = Shared.parseCssColorWithAlpha(style.backgroundColor);
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
            const parsed = Shared.parseCssColorWithAlpha(style.backgroundColor);
            if (parsed && parsed.a >= 0.05 && parsed.a < 0.99) {
              return parsed;
            }
          }
        }
      }
    } catch (_) {}
    return null;
  }

  function computeAndEmit(force) {
    if (tornDown) return;
    if (!Shared.isContextValid()) {
      teardown();
      return;
    }

    const baseRgb = resolveBaseShellRgb();
    if (!baseRgb) return;

    const baseColor = Shared.rgbToHex(baseRgb[0], baseRgb[1], baseRgb[2]);
    const overlay = detectActiveOverlay();
    const displayColor = overlay ? Shared.blendOverlayOntoBase(baseRgb, overlay) : baseColor;

    if (!force && displayColor === lastDisplayColor && baseColor === lastBaseColor) {
      return;
    }

    lastDisplayColor = displayColor;
    lastBaseColor = baseColor;

    try {
      if (window.top && window.top !== window) {
        window.top.postMessage(
          { __agFrameExt: true, displayColor, baseColor },
          HOST_ORIGIN
        );
      }
    } catch (_) {}
  }

  let rafPending = false;
  function scheduleCheck() {
    if (tornDown) return;
    if (!Shared.isContextValid()) {
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

  const observer = new MutationObserver(scheduleCheck);
  const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function onParentMessage(event) {
    if (tornDown) return;
    if (!Shared.isContextValid()) {
      teardown();
      return;
    }
    if (event.origin === HOST_ORIGIN && event.data && event.data.__agFrameExtRequest === true) {
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

  function startObserver() {
    if (!document.documentElement || !Shared.isContextValid()) return;
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
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  }

  window.addEventListener('load', () => computeAndEmit(true));
  window.addEventListener('resize', scheduleCheck);
  window.addEventListener('message', onParentMessage);

  if (mediaQuery && mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', scheduleCheck);
  }
})();

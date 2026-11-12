(() => {
  'use strict';

  const STORAGE_KEY = 'frameColor';
  const LOCAL_CACHE_KEY = '__ag_pwa_frame_color__';
  const DEFAULT_COLOR = '#ffffff';

  let currentColor = DEFAULT_COLOR;
  try {
    const cached = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (cached && /^#[0-9a-fA-F]{6}$/.test(cached)) {
      currentColor = cached;
    }
  } catch (_) {}

  let applying = false;

  function applyFrameColor(color) {
    if (applying) return;
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

  applyFrameColor(currentColor);

  const observer = new MutationObserver(() => {
    applyFrameColor(currentColor);
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content', 'name', 'media']
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      applyFrameColor(currentColor);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['content', 'name', 'media']
      });
    }, { once: true });
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_COLOR }, (items) => {
      const saved = items[STORAGE_KEY];
      if (saved && /^#[0-9a-fA-F]{6}$/.test(saved)) {
        currentColor = saved.toLowerCase();
        try {
          window.localStorage.setItem(LOCAL_CACHE_KEY, currentColor);
        } catch (_) {}
        applyFrameColor(currentColor);
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes[STORAGE_KEY]) {
        const next = changes[STORAGE_KEY].newValue;
        if (next && /^#[0-9a-fA-F]{6}$/.test(next)) {
          currentColor = next.toLowerCase();
          try {
            window.localStorage.setItem(LOCAL_CACHE_KEY, currentColor);
          } catch (_) {}
          applyFrameColor(currentColor);
        }
      }
    });
  }
})();

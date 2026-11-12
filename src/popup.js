(() => {
  'use strict';

  const STORAGE_KEY = 'frameColor';
  const DEFAULT_COLOR = '#ffffff';

  const colorPicker = document.getElementById('colorPicker');
  const hexInput = document.getElementById('hexInput');
  const swatches = document.querySelectorAll('.swatch');

  function setColor(hex, persist = true) {
    const normalized = hex.toLowerCase();
    colorPicker.value = normalized;
    hexInput.value = normalized;
    if (persist && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ [STORAGE_KEY]: normalized });
    }
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_COLOR }, (items) => {
      const saved = items[STORAGE_KEY];
      if (saved && /^#[0-9a-fA-F]{6}$/.test(saved)) {
        setColor(saved, false);
      }
    });
  }

  colorPicker.addEventListener('input', () => {
    setColor(colorPicker.value, true);
  });

  hexInput.addEventListener('input', () => {
    let val = hexInput.value.trim();
    if (!val.startsWith('#')) {
      val = '#' + val;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setColor(val, true);
    }
  });

  swatches.forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = btn.getAttribute('data-color');
      if (c) setColor(c, true);
    });
  });
})();

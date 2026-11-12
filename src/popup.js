(() => {
  'use strict';

  const MODE_KEY = 'frameMode';
  const COLOR_KEY = 'frameColor';
  const DEFAULT_COLOR = '#fafafa';

  const autoBtn = document.getElementById('autoBtn');
  const colorPicker = document.getElementById('colorPicker');
  const hexInput = document.getElementById('hexInput');
  const swatches = document.querySelectorAll('.swatch');

  function updateUi(mode, hex) {
    const normalized = (hex && /^#[0-9a-fA-F]{6}$/.test(hex)) ? hex.toLowerCase() : DEFAULT_COLOR;
    colorPicker.value = normalized;
    hexInput.value = normalized;
    if (mode === 'manual') {
      autoBtn.classList.remove('active');
    } else {
      autoBtn.classList.add('active');
    }
  }

  function setManualColor(hex) {
    const normalized = hex.toLowerCase();
    updateUi('manual', normalized);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ [MODE_KEY]: 'manual', [COLOR_KEY]: normalized });
    }
  }

  function setAutoMode() {
    autoBtn.classList.add('active');
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ [MODE_KEY]: 'auto' });
    }
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ [MODE_KEY]: 'auto', [COLOR_KEY]: DEFAULT_COLOR }, (items) => {
      updateUi(items[MODE_KEY], items[COLOR_KEY]);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        chrome.storage.sync.get({ [MODE_KEY]: 'auto', [COLOR_KEY]: DEFAULT_COLOR }, (items) => {
          updateUi(items[MODE_KEY], items[COLOR_KEY]);
        });
      }
    });
  }

  autoBtn.addEventListener('click', () => {
    setAutoMode();
  });

  colorPicker.addEventListener('input', () => {
    setManualColor(colorPicker.value);
  });

  hexInput.addEventListener('input', () => {
    let val = hexInput.value.trim();
    if (!val.startsWith('#')) {
      val = '#' + val;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setManualColor(val);
    }
  });

  swatches.forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = btn.getAttribute('data-color');
      if (c) setManualColor(c);
    });
  });
})();

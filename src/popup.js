(() => {
  'use strict';

  const Shared = globalThis.FrameColorShared;
  if (!Shared) return;

  const autoBtn = document.getElementById('autoBtn');
  const colorPicker = document.getElementById('colorPicker');
  const hexInput = document.getElementById('hexInput');
  const swatches = document.querySelectorAll('.swatch');

  let lastValidColor = Shared.DEFAULT_COLOR;

  function updateUi(mode, hex) {
    const normalized = Shared.normalizeHexColor(hex, Shared.DEFAULT_COLOR);
    lastValidColor = normalized;
    colorPicker.value = normalized;
    hexInput.value = normalized;

    const isManual = mode === 'manual';
    autoBtn.classList.toggle('active', !isManual);

    swatches.forEach((btn) => {
      const swatchColor = (btn.getAttribute('data-color') || '').toLowerCase();
      btn.classList.toggle('active', isManual && swatchColor === normalized);
    });
  }

  function syncFromStorage() {
    if (!Shared.isContextValid() || !chrome.storage || !chrome.storage.sync) return;
    chrome.storage.sync.get(
      { [Shared.MODE_KEY]: 'auto', [Shared.COLOR_KEY]: Shared.DEFAULT_COLOR },
      (items) => {
        if (!items) return;
        updateUi(items[Shared.MODE_KEY], items[Shared.COLOR_KEY]);
      }
    );
  }

  function setManualColor(hex) {
    const normalized = Shared.normalizeHexColor(hex, lastValidColor);
    updateUi('manual', normalized);
    if (Shared.isContextValid() && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({
        [Shared.MODE_KEY]: 'manual',
        [Shared.COLOR_KEY]: normalized
      });
    }
  }

  function setAutoMode() {
    updateUi('auto', lastValidColor);
    if (Shared.isContextValid() && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ [Shared.MODE_KEY]: 'auto' });
    }
  }

  if (Shared.isContextValid() && chrome.storage && chrome.storage.sync) {
    syncFromStorage();
    chrome.storage.onChanged.addListener((_changes, area) => {
      if (area === 'sync') {
        syncFromStorage();
      }
    });
  }

  autoBtn.addEventListener('click', setAutoMode);

  colorPicker.addEventListener('input', () => {
    setManualColor(colorPicker.value);
  });

  hexInput.addEventListener('input', () => {
    let val = hexInput.value.trim();
    if (!val.startsWith('#')) {
      val = '#' + val;
    }
    if (Shared.isValidHexColor(val)) {
      setManualColor(val);
    }
  });

  hexInput.addEventListener('blur', () => {
    hexInput.value = lastValidColor;
  });

  swatches.forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = btn.getAttribute('data-color');
      if (c) setManualColor(c);
    });
  });
})();

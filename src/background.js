'use strict';

const MODE_KEY = 'frameMode';
const STORAGE_KEY = 'frameColor';
const DEFAULT_COLOR = '#fafafa';
const RULE_ID = 1;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function buildManifestDataUrl(color) {
  const manifest = {
    short_name: 'Antigravity',
    name: 'Google Antigravity',
    description: 'Google Antigravity is our agentic development platform, allowing anyone to build in the agent-first era.',
    icons: [
      {
        src: 'https://www.gstatic.com/antigravity/logos/antigravity-icon__full-color.png',
        type: 'image/png',
        sizes: '540x540 any'
      }
    ],
    start_url: 'https://antigravity.google.com/',
    background_color: color,
    theme_color: color,
    display: 'standalone'
  };
  return 'data:application/manifest+json;charset=utf-8,' + encodeURIComponent(JSON.stringify(manifest));
}

function updateManifestRedirectRule(color) {
  const validColor = (color && HEX_COLOR_RE.test(color)) ? color.toLowerCase() : DEFAULT_COLOR;
  const redirectUrl = buildManifestDataUrl(validColor);

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [
      {
        id: RULE_ID,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { url: redirectUrl }
        },
        condition: {
          urlFilter: 'https://antigravity.google.com/assets/manifest.json*',
          resourceTypes: ['other', 'xmlhttprequest', 'sub_frame', 'main_frame']
        }
      }
    ]
  });
}

function syncRuleFromStorage() {
  chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_COLOR }, (items) => {
    updateManifestRedirectRule(items[STORAGE_KEY]);
  });
}

function reinjectOpenAntigravityTabs() {
  if (!chrome.scripting || !chrome.tabs) return;
  try {
    chrome.tabs.query({ url: 'https://antigravity.google.com/*' }, (tabs) => {
      void chrome.runtime.lastError;
      if (!Array.isArray(tabs)) return;
      for (const tab of tabs) {
        if (!tab || typeof tab.id !== 'number') continue;
        chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: [0] },
          files: ['src/content.js']
        }).catch(() => {});
        chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['src/iframe-observer.js']
        }).catch(() => {});
      }
    });
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => {
  syncRuleFromStorage();
  reinjectOpenAntigravityTabs();
});

chrome.runtime.onStartup.addListener(syncRuleFromStorage);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[STORAGE_KEY]) {
    updateManifestRedirectRule(changes[STORAGE_KEY].newValue);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== 'AG_FRAME_COLOR') return;

  const displayColor = (message.displayColor && HEX_COLOR_RE.test(message.displayColor))
    ? message.displayColor.toLowerCase()
    : null;
  const baseColor = (message.baseColor && HEX_COLOR_RE.test(message.baseColor))
    ? message.baseColor.toLowerCase()
    : null;

  if (!displayColor || !baseColor) return;

  // Forward live color update to the top frame of the originating tab
  if (sender && sender.tab && typeof sender.tab.id === 'number') {
    try {
      chrome.tabs.sendMessage(
        sender.tab.id,
        {
          type: 'AG_APPLY_FRAME_COLOR',
          displayColor,
          baseColor
        },
        { frameId: 0 },
        () => {
          void chrome.runtime.lastError;
        }
      );
    } catch (_) {}
  }

  // Persist baseColor for next launch splash / manifest when in Auto mode
  chrome.storage.sync.get({ [MODE_KEY]: 'auto', [STORAGE_KEY]: DEFAULT_COLOR }, (items) => {
    void chrome.runtime.lastError;
    if (items && items[MODE_KEY] !== 'manual' && items[STORAGE_KEY] !== baseColor) {
      chrome.storage.sync.set({ [STORAGE_KEY]: baseColor });
    }
  });
});

syncRuleFromStorage();

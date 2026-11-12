'use strict';

importScripts('./shared.js');

const Shared = globalThis.FrameColorShared;

const APP_CONFIG = {
  tabUrlPattern: 'https://antigravity.google.com/*',
  manifestUrlFilter: 'https://antigravity.google.com/assets/manifest.json*',
  injectionTargets: [
    { allFrames: false, files: ['src/shared.js', 'src/content.js'] },
    { allFrames: true, files: ['src/shared.js', 'src/iframe-observer.js'] }
  ],
  buildManifest(color) {
    return {
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
  }
};

function buildManifestDataUrl(color) {
  const manifest = APP_CONFIG.buildManifest(color);
  return 'data:application/manifest+json;charset=utf-8,' + encodeURIComponent(JSON.stringify(manifest));
}

function updateManifestRedirectRule(color) {
  const validColor = Shared.normalizeHexColor(color, Shared.DEFAULT_COLOR);
  const redirectUrl = buildManifestDataUrl(validColor);

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [Shared.RULE_ID],
    addRules: [
      {
        id: Shared.RULE_ID,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { url: redirectUrl }
        },
        condition: {
          urlFilter: APP_CONFIG.manifestUrlFilter,
          resourceTypes: ['other', 'xmlhttprequest', 'sub_frame', 'main_frame']
        }
      }
    ]
  });
}

function syncRuleFromStorage() {
  chrome.storage.sync.get({ [Shared.COLOR_KEY]: Shared.DEFAULT_COLOR }, (items) => {
    void chrome.runtime.lastError;
    if (items) {
      updateManifestRedirectRule(items[Shared.COLOR_KEY]);
    }
  });
}

function reinjectOpenTabs() {
  if (!chrome.scripting || !chrome.tabs) return;
  try {
    chrome.tabs.query({ url: APP_CONFIG.tabUrlPattern }, (tabs) => {
      void chrome.runtime.lastError;
      if (!Array.isArray(tabs)) return;
      for (const tab of tabs) {
        if (!tab || typeof tab.id !== 'number') continue;
        for (const target of APP_CONFIG.injectionTargets) {
          const scriptTarget = target.allFrames
            ? { tabId: tab.id, allFrames: true }
            : { tabId: tab.id, frameIds: [0] };
          chrome.scripting.executeScript({
            target: scriptTarget,
            files: target.files
          }).catch(() => {});
        }
      }
    });
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => {
  syncRuleFromStorage();
  reinjectOpenTabs();
});

chrome.runtime.onStartup.addListener(syncRuleFromStorage);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[Shared.COLOR_KEY]) {
    updateManifestRedirectRule(changes[Shared.COLOR_KEY].newValue);
  }
});

syncRuleFromStorage();

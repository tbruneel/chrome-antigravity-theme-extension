'use strict';

const STORAGE_KEY = 'frameColor';
const DEFAULT_COLOR = '#fafafa';
const RULE_ID = 1;

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
  const validColor = (color && /^#[0-9a-fA-F]{6}$/.test(color)) ? color.toLowerCase() : DEFAULT_COLOR;
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

chrome.runtime.onInstalled.addListener(syncRuleFromStorage);
chrome.runtime.onStartup.addListener(syncRuleFromStorage);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[STORAGE_KEY]) {
    updateManifestRedirectRule(changes[STORAGE_KEY].newValue);
  }
});

syncRuleFromStorage();

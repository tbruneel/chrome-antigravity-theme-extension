# Google Chrome Remote Antigravity Extension (`google-chrome-remote-antigravity-extension`)

A lightweight Manifest V3 Chrome extension whose sole purpose is to set and lock the window frame (title bar) color of the **Google Antigravity Remote Control** Chrome Web App (`https://antigravity.google.com/`).

---

## Background

By default, `https://antigravity.google.com/` serves `<meta name="theme-color" content="#1f1f1f">` in its HTML `<head>` and `"theme_color": "#1f1f1f"` in `/assets/manifest.json`, causing Chrome to render the standalone PWA window with a dark (`#1f1f1f`) title bar even when the web interface is in light mode.

Because Chromium gives the live DOM's `<meta name="theme-color">` priority over the web app manifest's `theme_color`, this extension runs at `document_start` to override `<meta name="theme-color">` to `#fafafa` (`rgb(250, 250, 250)`) by default—or any custom hex color selected in the extension popup—and locks it via a `MutationObserver`.

---

## Repository Structure

```text
google-chrome-remote-antigravity-extension/
├── .agents/
│   └── rules/
│       └── rules-git.md            # Git commit identity rules
├── src/
│   ├── background.js               # declarativeNetRequest redirect for /assets/manifest.json
│   ├── content.js                  # document_start theme-color override & MutationObserver
│   ├── popup.css                   # Extension popup styles
│   ├── popup.html                  # Extension popup markup
│   └── popup.js                    # Color picker, hex input & preset swatches
├── manifest.json                   # Chrome Extension Manifest V3
├── readme.md                       # Documentation (Markdown source)
└── readme.md.html                  # Documentation (Standalone HTML)
```

---

## Installation (Unpacked Extension)

1. Open `chrome://extensions/` in Google Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select `D:\Development\google-chrome-remote-antigravity-extension`.
4. Open the **Google Antigravity** web app (`https://antigravity.google.com/`) — the window frame defaults to `#fafafa` (`rgb(250, 250, 250)`) and can be customized at any time via the extension icon in the title bar.

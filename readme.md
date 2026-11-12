# Google Chrome Remote Antigravity Extension (`google-chrome-remote-antigravity-extension`)

A lightweight Manifest V3 Chrome extension whose sole purpose is to set and lock the window frame (title bar) color of the **Google Antigravity Remote Control** Chrome Web App (`https://antigravity.google.com/`).

---

## Background

By default, `https://antigravity.google.com/` serves `<meta name="theme-color" content="#1f1f1f">` in its HTML `<head>` and `"theme_color": "#1f1f1f"` in `/assets/manifest.json`, causing Chrome to render the standalone PWA window with a mismatched `#1f1f1f` title bar regardless of the selected theme or contrast mode.

In **Auto (Match App Theme)** mode (enabled by default), the extension automatically detects the active Antigravity theme and contrast level—by sampling the outer shell surface right below the title bar and reading `localStorage` (`*.jetski.contrast`)—and sets `<meta name="theme-color">` and the manifest `theme_color` / `background_color` to the exact matching surface color:

| Theme | Contrast | RGB | Hex |
| :--- | :--- | :--- | :--- |
| **Light** | Default Contrast | `rgb(250, 250, 250)` | `#fafafa` |
| **Light** | Strong Contrast | `rgb(243, 243, 243)` | `#f3f3f3` |
| **Dark** | Default Contrast | `rgb(17, 17, 20)` | `#111114` |
| **Dark** | Strong Contrast | `rgb(18, 18, 22)` | `#121216` |

You can also switch to manual mode at any time via the extension popup to pick a custom hex color or select one of the 4 preset swatches.

---

## Repository Structure

```text
google-chrome-remote-antigravity-extension/
├── .agents/
│   └── rules/
│       └── rules-git.md            # Git commit identity rules
├── src/
│   ├── background.js               # declarativeNetRequest redirect for /assets/manifest.json
│   ├── content.js                  # document_start theme-color auto-detection & MutationObserver
│   ├── popup.css                   # Extension popup styles
│   ├── popup.html                  # Extension popup markup
│   └── popup.js                    # Auto mode toggle, color picker, hex input & preset swatches
├── manifest.json                   # Chrome Extension Manifest V3
├── readme.md                       # Documentation (Markdown source)
└── readme.md.html                  # Documentation (Standalone HTML)
```

---

## Installation (Unpacked Extension)

1. Open `chrome://extensions/` in Google Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select `D:\Development\google-chrome-remote-antigravity-extension`.
4. Open the **Google Antigravity** web app (`https://antigravity.google.com/`) — the window frame automatically matches your active Light/Dark + Default/Strong contrast theme (`#fafafa`, `#f3f3f3`, `#111114`, or `#121216`), or can be overridden via the extension icon in the title bar.

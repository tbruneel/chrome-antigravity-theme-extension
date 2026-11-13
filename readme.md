# Title Bar Theme for Google Antigravity (`chrome-extension-theme-for-antigravity`)

A zero-configuration Manifest V3 Chrome extension that automatically synchronizes the window frame (title bar) and launch splash color of the **Google Antigravity Remote Control** Chrome Web App (`https://antigravity.google.com/`).

---

## Background

By default, `https://antigravity.google.com/` serves `<meta name="theme-color" content="#1f1f1f">` in its outer HTML `<head>` and `"theme_color": "#1f1f1f"` in `/assets/manifest.json`, while rendering the actual Antigravity UI inside a full-screen cross-origin child `<iframe>` (`https://antigravity.static.usercontent.goog/*`). As a result, Chrome renders the standalone PWA window with a static `#1f1f1f` title bar regardless of your selected theme, contrast mode, or active modal overlays.

This extension observes `.agy-shell` (`--shell`) and active modal backdrops (`.settings-modal-backdrop`, `[data-testid="modal-backdrop"]`, `.aux-drawer-backdrop`) directly inside the UI iframe in real time, and automatically updates `<meta name="theme-color">` and the manifest `theme_color` / `background_color`:

| Theme | Contrast | Base Header Color | Settings / Modal Open (`30%` Scrim) |
| :--- | :--- | :--- | :--- |
| **Light** | Default Contrast | `#fafafa` (`rgb(250, 250, 250)`) | `#afafaf` (`rgb(175, 175, 175)`) |
| **Light** | Strong Contrast | `#f3f3f3` (`rgb(243, 243, 243)`) | `#aaaaaa` (`rgb(170, 170, 170)`) |
| **Dark** | Default Contrast | `#111114` (`rgb(17, 17, 20)`) | `#0c0c0e` (`rgb(12, 12, 14)`) |
| **Dark** | Strong Contrast | `#121216` (`rgb(18, 18, 22)`) | `#0d0d0f` (`rgb(13, 13, 15)`) |

Custom theme presets and custom background colors configured in **Settings → Appearance** are also resolved automatically from `--shell` and alpha-blended in real time whenever a modal overlay opens or closes.

---

## Repository Structure

```text
chrome-extension-theme-for-antigravity/
├── .agents/
│   └── rules/
│       └── rules-git.md            # Git commit identity rules
├── icons/
│   ├── icon16.png                  # Extension toolbar / management icons
│   ├── icon48.png
│   └── icon128.png                 # Chrome Web Store listing icon
├── store/
│   └── screenshot-1280x800.png     # Chrome Web Store listing screenshot (24-bit PNG)
├── src/
│   ├── background.js               # Manifest redirect rule & live tab re-injection on reload
│   ├── content.js                  # Top-frame <meta name="theme-color"> lock & storage sync
│   ├── iframe-observer.js          # Real-time --shell & Settings/modal overlay observer in UI iframe
│   └── shared.js                   # Shared constants, hex validation, color blending & DOM helpers
├── build.ps1                       # Packages CWS-ready .zip bundle into dist\ (forward-slash entries)
├── manifest.json                   # Chrome Extension Manifest V3
├── privacy.md                      # Chrome Web Store privacy policy
├── readme.md                       # Documentation (Markdown source)
└── readme.md.html                  # Documentation (Standalone HTML)
```

---

## Packaging & Deployment

### Chrome Web Store Packaging (`.zip`)

Run `.\build.ps1` to produce `dist\chrome-extension-theme-for-antigravity-v<version>.zip` with `manifest.json` at the root and forward-slash (`/`) entry paths ready for upload in the Chrome Web Store Developer Dashboard.

### Automated Provisioning (`powershell-software-installer`)

Chrome Web Store Extension ID: `gffpamdcddmdbeljekjlpaknpmjlglni` (configured in `powershell-software-installer\manifest.psd1` under `winget_google_antigravity_remote_control`), so [`winget_google_antigravity_remote_control.ps1`](../powershell-software-installer/readme.md) installs both the Antigravity Chrome PWA and this extension automatically via Chrome Enterprise Policy (`HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionSettings`, mode `normal_installed`).

### Local Development (Unpacked Extension)

1. Open `chrome://extensions/` in Google Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select `D:\Development\chrome-extension-theme-for-antigravity` (or click **Reload (`↻`)** if already loaded).
4. Open the **Google Antigravity** web app (`https://antigravity.google.com/`) — the window frame automatically matches your active theme, contrast level, and modal overlays in real time.

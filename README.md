# Mendix Lens

**Mendix Lens** is a Chrome extension that helps you inspect Mendix apps directly in the browser. It adds a small overlay to any page where Mendix is running (`window.mx` is defined). Click the overlay to see the current page name and, when you hover over widgets, their **name** (e.g. from `mx-name-*`), **data Mendix ID**, **element ID**, **row/item index** (for list/grid rows), **widget type** (Data grid, List view, Link, etc.), **extra CSS classes**, **tag name**, and **disabled state**. You can drag the overlay, collapse it to a compact “i” circle, copy its contents with a triple-click, and use Shift+right-click to pin a red highlight on an element. The extension runs only on Mendix apps; on other sites it does nothing and logs nothing.

## Installation

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder (`Mendix_Lens`).
4. The Mendix Lens icon appears in the toolbar (informational only; the overlay is injected automatically).

## Usage

1. Open a Mendix app (or any page where `mx` is defined).
2. The overlay is injected automatically when the page is ready. If `mx` loads asynchronously, the extension waits briefly and injects when it appears.
3. On non-Mendix pages the extension does nothing and produces no console output.

## Structure

```
Mendix_Lens/
├── manifest.json
├── content.js
├── MendixLensCore.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

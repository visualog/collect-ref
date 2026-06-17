# Iconsclub Offline Clone

This is a standalone, offline-capable app icon browser inspired by `iconsclub.vercel.app`.

Runtime dependencies are local:

- `index.html`
- `assets/index-i4XtprWd.css`
- `assets/offline-app.js`
- `data/apps.json`
- `assets/icons/*.jpg`
- `sw.js`

The app does not call Supabase, Vercel API routes, Google Fonts, Apple CDN, or the original site at runtime. App metadata and 5,000 local 1024px icon images are stored locally.

## Run

```sh
python3 -m http.server 3014 --bind 127.0.0.1
```

Open:

```txt
http://127.0.0.1:3014/
```

The service worker caches the app after first load, so the same browser can reopen it without internet while served from the same origin.

## Filters

The toolbar includes local visual filters:

- Dominant color family
- Text-like icons
- 3D/image-like icons

Color is based on local pixel analysis. Text and 3D filters are lightweight heuristics based on edge density, color variety, and luminance variance, so they are useful for browsing but not a formal computer-vision classification.

## Rebuild Data

`scripts/build-offline-data.mjs` can rebuild `data/apps.json` and icons from `data/apps-raw.json` if you provide a fresh raw export. When Apple CDN is reachable, it downloads real icons; otherwise it generates local SVG placeholders.

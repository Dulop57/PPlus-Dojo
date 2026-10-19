# Instructions for Codex tasks in P+ Dojo

Read `README.md` and inspect the current branch, status, and remotes before
working. The user's current instructions take precedence.

## Scope and local owner notes

- The same frontend supports the website and standalone Windows app. Electron
  is the active native product; the Rust browser launcher is a legacy option.
- `docs/` contains ignored owner notes, retained only on the original machine.
  When present, read `docs/PROJECT-STATUS.md` for its handoff and relevant detailed
  notes before changing builds, study content, or production releases. A fresh
  clone uses the README instead. Do not publish owner notes.
- Keep configured `desktop.config.json`, credentials, raw game inputs,
  `public/data`, `public/study`, build outputs, `.tools`, and `artifacts` local.
  Do not delete needed game inputs/datasets or overwrite configured services
  with public examples as cleanup.

## Compatibility and access control

- `FLASHCARD-STATS.md` is the active stat selection; apply it with
  `npm run study:select`. Keep stat/card IDs stable for the same logical card.
- Preserve review history, offline study, separate guest/per-UID IndexedDB
  databases, durable sync queues, and review deduplication. Changed answers
  refresh cards; removed cards retain saved records/history.
- RAM preload is optional, remembered per device, and off by default. Browser
  disk downloads and RAM preload are separate features.
- Keep `firebase/firestore.rules` owner-only UID access and payload validation.
  Never replace them with public test rules. Use your own services for testing.
- Extracted game data remains unverified. Preserve status notices and attribution.
  App tests and successful packaging do not establish game accuracy.

## Builds and verification

- Use the preparation/build commands in the README. After changing selection,
  card generation, or references, regenerate study catalogs before rebuilding
  either client. `build:ui` reuses data and does not regenerate catalogs.
- Run relevant unit/browser and TypeScript checks for behavioral changes. A
  documentation edit does not require a full dataset or installer build.
- Live Firebase tests deliberately create external accounts/records. Do not run
  them routinely. Actual Windows auto-install validation is distinct from
  intercepted fixture tests.
- Source ZIP exports contain committed Git files only. Commit reviewed changes
  before `npm run package:source`; do not reintroduce recursive directory copies.

## Publishing

- Source, website deployment, and Windows releases are separate operations.
  Publishing source does not update installed/offline clients.
- For owner production work, preserve the configured Cloudflare Pages project
  and the separate Windows release repository. Consult the local owner notes
  when available and keep them accurate after releases.
- Keep `/` as the web service worker's precached homepage. Cloudflare redirects
  `/index.html`, which breaks Chromium offline navigation if cached directly.
- Version releases consistently across root/desktop metadata and lockfiles.
  Check free disk space before installer builds. Publish installer, blockmap,
  and `latest.yml` together; run `desktop:verify-release` first.
- Keep the MIT license, third-party notices, and required upstream credits.
  Artwork/branding redistribution permissions remain unverified.

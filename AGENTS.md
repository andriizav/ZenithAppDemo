# AGENTS.md

## Project overview

ZenithApp — personal productivity SPA (PWA) deployed on Vercel. Vanilla JS, no framework, no build step. UI language is **Ukrainian**.

## Architecture

Two independent frontends sharing the same visual design:

| Variant | Entry point | Notes |
|---------|-------------|-------|
| Desktop | `index.html` → `js/main.js` | Loads modules via `loadScriptsInOrder()`, serves from root |
| Mobile | `mobile/app-view.html` → `mobile/js/main.js` | Standalone copy; `mobile/index.html` redirects: wide screen → iframe preview, narrow → `app-view.html` directly |

**Modules** (loaded as separate `<script>` tags, ordered by `js/main.js`):

- `js/app.js` — tabs, theme, motivational quotes, tab switching
- `js/bookmarks.js` — XBEL bookmark parsing/rendering
- `tasks/` — Eisenhower quadrant tasks (drag-drop, repeat, subtasks)
- `habits/` — habit tracker (cards, statistics, reminders, modals)
- `timer/` — countdown timer with sounds
- `notes/` — rich text notes (Quill CDN, lazy-loaded on first open)
- `gist/` — Gist-based sync for all data (notes, habits, tasks, timer) + cross-tab coordination
- `login/` — entry screen styles and sound
- `shared/delete-modal.js` — shared confirmation modal

**Data flow**: All state lives in `localStorage`. Sync to GitHub Gist is optional (user-configured). Conflict resolution uses `lastModified` timestamps (see `gist/sync-base.js`).

## Verify changes

No build step or test framework. Use `node --check <file>` to verify JS syntax:

```bash
node --check tasks/tasks.js
node --check notes/events.js
node --check habits/habits.js
node --check mobile/tasks/tasks.js
node --check mobile/notes/events.js
node --check gist/tasks-storage.js
node --check gist/tab-coordinator.js
```

## Local development

Start a static server (no build):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. For mobile variant: `http://localhost:8000/mobile/`.

**Service Workers**: Both `sw.js` (desktop) and `mobile/sw.js` use network-first caching. During development, disable SW in Chrome DevTools → Application → Service Workers to avoid stale cache issues. The mobile SW has its own cache version (`CACHE_VERSION` in `mobile/sw.js`).

## Key conventions

- **Script loading**: `loadOneScript()` in `js/main.js` uses `async=false` with DOM anchor positions for parallel download + ordered execution. Never break this order.
- **Lazy modules**: Notes are lazy-loaded on first tab open (`ensureNotesLoaded()`). All other modules are loaded eagerly at startup.
- **Theme**: CSS custom properties in `:root` (dark default) and `:root[data-theme="light"]`. Stored in `localStorage` under `app_theme` (desktop) or `app_theme_mobile` (mobile).
- **Icons**: Centralized in `js/icons.js` (root) — use `ICON(name, size)` helper. All icons are Lucide-style SVGs. Mobile loads it via `../js/icons.js`.
- **ID format**: Task IDs: `t_<base36>_<random>`. Note IDs: `n_<base36>_<random>`.
- **Tabs config**: Defined in `CONFIG.tabs` and `CONFIG.specialTabs` in `js/main.js`. Special tabs load their own modules; others use `js/bookmarks.js` for XBEL rendering.
- **Cross-tab sync**: `gist/tab-coordinator.js` elects a single leader tab for Gist operations. Other tabs react to `localStorage` storage events.

## Gotchas

- Desktop and mobile codebases are **largely duplicated** (not shared via imports). Changes to shared logic (tasks, habits, etc.) often need to be applied in both places.
- `shared/habits-quotes.js` is loaded by both variants (mobile refs `../shared/habits-quotes.js`).
- `mobile/` directory has its own `sw.js`, `js/main.js`, `js/app.js`, etc. — these are separate files, not wrappers.
- `gist/` modules are shared between desktop and mobile via relative paths (`../gist/` from mobile).
- Core desktop scripts live in `js/` (`main.js`, `app.js`, `bookmarks.js`, `icons.js`); core desktop styles live in `css/` (`main.css`, `modals.css`, `gradient-button.css`). Mobile mirrors this with `mobile/js/` and its own `mobile/css/`. `mobile/scripts/` holds Python build utilities (`extract.py`, `gen_sounds.py`, `gen_success_sound.py`); root `scripts/` holds Node syntax-check utilities (`check-habits-syntax.js`, `check-mobile-habits-syntax.js`). Root-level demo/preview HTML lives in `demos/`.
- Bookmarks data is in `bookmarks/` as `.xbel` files (XML Bookmark Exchange Language).
- `login/login.js` contains `crypto.subtle` helpers with a pure-JS fallback.
- Light theme CSS is inlined in `index.html` `<style>` blocks AND in separate CSS files — some duplication.
- Commit messages in this repo are minimal (single characters or short descriptions). Follow existing style.

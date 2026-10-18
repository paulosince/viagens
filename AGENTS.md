# Project Workflow

- This repository is published directly to `origin/main` after relevant checks pass.
- Before publishing, inspect the diff, commit the intended project changes, synchronize with `origin/main`, resolve conflicts without discarding remote or user work, rerun checks, and push.
- Paulo has approved direct pushes to `main` for this project. Platform-level authentication or safety prompts may still require confirmation.
- Keep UI transitions CSS-driven, preserve stable/reactive DOM behavior, and save from application state rather than scraping rendered HTML.
- For each published app-shell change, bump the Service Worker's CACHE_NAME and update versioned asset URLs in index.html and APP_SHELL when those files change. The PWA auto-update manager requires a changed sw.js to detect a new release.

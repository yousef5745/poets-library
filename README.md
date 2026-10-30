# حكايا: site (Phase 1)

Static site with no build step. It runs on GitHub Pages as is, using hash routing (`#/story/antara`), so it needs no SPA fallback.
It is Arabic and right-to-left, and ready for more languages: UI strings live in `i18n/ar.js` and story text lives in `content/`.

## Run locally
    cd /workspace/poetstories-site && python3 -m http.server 8765
    open http://localhost:8765/

## Tests
- `node tests/validate.mjs`: graph check. Every node is reachable, there are no dead ends, and every ending is used.
- `python3 tests/play.py`: plays Antara end to end in the real reader with three choice strategies.
- `python3 tests/guest.py`: as a guest, chapters 1 and 2 play and then the subscribe prompt appears.
- `python3 tests/shots.py`: takes screenshots at 390, 768 and 1280 into `shots/`.

To test premium chapters on localhost only, run `localStorage.ps_dev_premium = '1'`. The site ignores this anywhere else.

## Layout
- `config.js`: the only file with keys, and only public values (PLACEHOLDERS: Supabase URL and anon key, Lemon Squeezy store and variant IDs).
- `css/tokens.css`: design tokens for the v2 «الورّاق» look, plus the v1 night palette for the reader.
- `js/engine.js`: story engine logic ported from the game. `js/pages/reader.js` is the reader UI.
- `js/auth.js`: Supabase Auth. Google is on. Facebook, X and email (magic link) are coded but switched off in `config.js`.
- `js/pay.js`: Lemon Squeezy checkout overlay. It passes `checkout[custom][user_id]` for the webhook.
- `js/access.js`: free and premium rule (the first 2 chapters are free). From Phase 2 the real gate is Supabase RLS.
- `content/catalog.js` and `content/antara.js`: library metadata and the Antara story. They move to Supabase in Phase 2.

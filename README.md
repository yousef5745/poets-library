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

## Character poses and expressions (sprite per line)
The reader can switch a character's picture on any line. In `stories-src/<id>.story`:

    @chars abla = عبلة | abla | sad:abla_sad | happy:abla_happy | angry:abla_angry   # per character
    @poses antara1 = angry:antara1_angry | proud:antara1_proud                      # per base image
    @poses antara_old = angry:antara_old_angry

    show abla=l:sad          # enter already in a pose
    abla(happy): line        # this line only; the standing pose comes back on the next line
    pose abla=angry hero=proud   # change the standing pose without a line (n = neutral)

Lookup for a line: the character's own `@chars` expression, then `@poses` for the base image in
use (for the hero that is the outfit `@looks` or the chapter look `@herochap`, so each outfit can
have its own poses), then the base image. Images are `assets/img/<name>.webp`. `node tests/validate.mjs`
fails on a missing image or an undefined pose name. A speaker leans in a little on every line and a
new pose cross-fades in. Rebuild with `python3 tools/build_story.py <id>`.

## Reader (v5)
The scene fills the screen (cover) and the text panel sits over it at a fixed height
(`--panel-h` in `css/reader.css`). Tapping anywhere outside the bars and the choices continues; the
first tap on a line that is still appearing shows it whole. `tests/v5_shots.py` plays chapter 1 at
390x844, 800x1280 and 1280x800, checks the panel height stays the same, and writes `shots/v5-*.png`.

## Installable app (PWA)
`manifest.webmanifest` + `sw.js` make حكايا installable from GitHub Pages (scope `/poets-library/`).
`sw.js` is generated: run `python3 tools/build_sw.py` after changing any site file, so the cache
version changes and old caches are removed. Code and stories are network-first (fresh after a
deploy, cached offline), images, fonts and audio cache-first; Supabase, Lemon Squeezy, Google sign-in
and auth return URLs are never cached. «ثبّت التطبيق» (library and footer) uses the browser prompt on
Android/desktop and shows a Share > Add to Home Screen hint on iPhone Safari. Check: `python3 tests/pwa.py`.

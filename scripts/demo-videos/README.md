# Machina wow-reel pipeline

Three Playwright recordings driving the live Machina platform at
80.79.5.173:5092, stitched with the same ffmpeg title-card/caption
composite pipeline as `guestkit/`, `Ironwolf/`, and `ZyAIQAAgent/`'s
`scripts/demo-videos/`.

## Requirements

- `playwright` (symlinked `node_modules` — see below) with the `chrome` channel installed
- `ffmpeg` (needs `overlay`/`fade`/`concat` filters — captions are pre-rendered PNGs)
- `python3` (small float arithmetic in `build.sh`)
- A live Machina platform (`MACH_URL`, default `https://80.79.5.173:5092`)

`node_modules` here is a symlink to a sibling project's `dashboard-react/node_modules`
(gitignored, not committed) — point it at any checkout with `playwright` installed.

## Recording

```bash
node render-cards.mjs
node seg01-login.mjs                # -> raw/seg01-login/*.webm
node seg02-dashboard-console.mjs    # dashboard tour + a VM's live serial console
node seg03-cinema-wall.mjs          # Machina Cinema full-screen console
./build.sh                          # -> out/machina-wow-reel.mp4 (+ linkedin-1080p copy)
```

Override the target host/credentials with `MACH_URL` / `MACH_USER` / `MACH_PASS`
env vars (see `lib.mjs`).

Each seg script prints `mark()` timestamps measured from process start — NOT
from when `recordVideo` actually starts (chromium.launch() overhead varies
per run, anywhere from under a second to several seconds on a loaded host).
Before picking `extract_clip` offsets in `build.sh`, translate marks to
video-relative time: `offset = last_mark - actual_video_duration`, then
subtract that offset from every mark in that segment. Always spot-check the
resulting frame with a direct `ffmpeg -ss <t> -frames:v 1` dump before
trusting an offset — a wrong one lands on a fade/black frame or the wrong
screen entirely.

The Machina platform's own dashboard has a "Back to Platform" bridge page
that sometimes appears after login instead of the real dashboard — `lib.mjs`
handles this defensively (`openLoggedIn` retries the click up to 5 times).

## Publishing

Not committed here (binary, and per-run): upload the built MP4 to YouTube
and copy it locally, following the same convention as prior demo videos
(public visibility, title cards + captions, copy under `~/Desktop/`).

# Machina wow-reel pipeline

Playwright recordings against the live Machina platform, stitched with ffmpeg
title-card/caption composites. Live client runbook: [`CLIENT_DEMO.md`](CLIENT_DEMO.md).

## Requirements

- `playwright` (symlinked `node_modules`) with the `chrome` channel installed
- `ffmpeg` (overlay/fade/concat) · `python3`
- Live Machina (`MACH_URL`, default tunnel `https://127.0.0.1:15092`)

```bash
# Prefer SSH tunnel (avoids PAM rate limits):
ssh -f -N -L 15092:127.0.0.1:5092 sus@212.8.248.187
export MACH_URL=https://127.0.0.1:15092 MACH_USER=sus MACH_PASS=max
export MACH_LINUX_VM=chrome-e2e-vm MACH_WINDOWS_VM=win10-msedge
```

## Recording

```bash
node render-cards.mjs
rm -rf raw/seg01-login raw/seg02-dashboard-console raw/seg03-cinema-wall
node seg01-login.mjs                # -> raw/seg01-login/*.webm
node seg02-dashboard-console.mjs    # Mission Control + Linux VM
node seg03-cinema-wall.mjs          # Cinema Linux + Windows + Live Wall
./build.sh                          # -> out/machina-wow-reel.mp4 (+ linkedin-1080p)
cp out/machina-wow-reel*.mp4 ~/Desktop/
```

Each seg script prints `mark()` timestamps from process start — NOT from when
`recordVideo` starts. Translate to video-relative time before editing
`extract_clip` offsets in `build.sh`: `offset = last_mark - actual_video_duration`.
Spot-check with `ffmpeg -ss <t> -frames:v 1`.

## Publishing

Upload `out/machina-wow-reel.mp4` with `upload-wow-reel.py` (Zeus OS OAuth token), copy under `~/Desktop/`,
and link from [`docs/CUSTOMER_SITE_READINESS.md`](../../docs/CUSTOMER_SITE_READINESS.md).

Current public cut: https://youtu.be/GYjvbKwUufA

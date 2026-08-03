# Machina live regression (CDP + API)

Page-by-page and API heartbeat sweeps against a deployed Machina host. Scripts under
`archive/` are the historical CDP rounds from the Aug 2026 live bug-hunt; the
maintained entrypoints are `page-sweep.js` and `api-sweep.js`.

## Setup

```bash
cd scripts/regression
npm install
```

Chrome with remote debugging (macOS example):

```bash
./chrome-launch.sh &
# or:
# Google Chrome --user-data-dir=/tmp/machina-chrome-regression \
#   --remote-debugging-port=9222 --ignore-certificate-errors about:blank
```

## Run

```bash
export MACHINA_BASE_URL=https://HOST:5092
export MACHINA_USER=sus
export MACHINA_PASS=max

# API heartbeat
npm run api -- --loops 1

# Interactive ops (power, screenshot, volumes, clone guard, reboot)
npm run ops

# Disk/NIC/rename/linked-clone lifecycle
npm run lifecycle

# CDP UI (classic Pause/Resume, platform tabs, finder, cinema) — needs CDP
./chrome-launch.sh &
npm run ui
npm run ui-settings

# Full page sweep
npm run pages -- --loops 1

# Continuous page sweep
npm run pages -- --forever
```

From repo root:

```bash
make regression-api MACHINA_BASE_URL=https://HOST:5092
make regression-pages MACHINA_BASE_URL=https://HOST:5092
```

## Outputs

Written under `scripts/regression/results/` (gitignored):

- `page-sweep.jsonl` / `page-sweep.log`
- `api-sweep.jsonl` / `api-sweep.log`

## Fixtures

- `fixtures/pages.json` — 130 App routes (classic + platform + OpenStack + K8s)
- `fixtures/known-softs.md` — intermittent short-body hydrates (not hard fails)

Override routes: `MACHINA_PAGES_JSON=/path/to.json` or
`MACHINA_EXTRA_PAGES=/platform/foo,/platform/bar`.

## Pass / fail

| Kind | Meaning |
|------|---------|
| PASS | Body length ≥ 100 and no crash/404 copy |
| SOFT | Short/empty body after wait (hydrate race) |
| FAIL | Crash UI, route not found, or CDP/API exception |

API sweep fails a check on HTTP ≥ 400 or HTML proxy error bodies.
Every 5th API loop also exercises pause/resume on `MACHINA_VM_NAME`
(default `chrome-e2e-vm`).

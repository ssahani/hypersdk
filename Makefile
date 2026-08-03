PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin
DATADIR ?= $(PREFIX)/share
SYSCONFDIR ?= /etc
UNITDIR ?= /usr/lib/systemd/system

CARGO ?= cargo
CARGO_FLAGS ?=

.PHONY: all build release debug clean install uninstall fmt fmt-check lint test web-test web-e2e regression-api regression-ops regression-lifecycle regression-platform regression-infra regression-fleet regression-mission regression-catalog regression-hardware regression-host regression-storage regression-zeus regression-audit regression-volume regression-disk regression-ui regression-ui-settings regression-ui-wizards regression-ui-security regression-ui-k8s-os regression-ui-mission regression-ui-catalog regression-ui-hardware regression-ui-host regression-ui-storage regression-ui-zeus regression-ui-audit regression-ui-volume regression-pages regression-setup check web web-clean start stop restart status deploy run-daemon run-tui help

all: release web ## Build everything (Rust + web)

build: ## Build in debug mode
	$(CARGO) build --workspace $(CARGO_FLAGS)

release: ## Build in release mode
	$(CARGO) build --workspace --release $(CARGO_FLAGS)

debug: build ## Alias for build

clean: web-clean ## Remove all build artifacts
	$(CARGO) clean

fmt: ## Format code
	$(CARGO) fmt --all

fmt-check: ## Check code formatting
	$(CARGO) fmt --all -- --check

lint: ## Run clippy lints
	$(CARGO) clippy --workspace -- -D warnings

test: ## Run Rust + web unit tests
	$(CARGO) test --workspace
	cd web && npm test

web-test: ## Run web unit tests (vitest)
	cd web && npm test

web-e2e: web ## Build web and run Playwright smoke tests
	cd web && npm run test:e2e

regression-setup: ## Install deps for scripts/regression (CDP + API sweeps)
	cd scripts/regression && npm install

LOOPS ?= 1

regression-api: ## Live API heartbeat sweep (MACHINA_BASE_URL / USER / PASS; LOOPS=N)
	cd scripts/regression && npm install --silent && node api-sweep.js --loops $(LOOPS)

regression-ops: ## Live interactive ops (power, screenshot, volumes, clone guard)
	cd scripts/regression && npm install --silent && node ops-interactive.js

regression-lifecycle: ## Live disk/nic/rename/clone lifecycle
	cd scripts/regression && npm install --silent && node ops-lifecycle.js

regression-platform: ## Live platform console/precheck/sync/pause + KubeVirt guard
	cd scripts/regression && npm install --silent && node ops-platform.js

regression-infra: ## Live networks/node/metrics/platform inventory/AI/Zeus firewall reads
	cd scripts/regression && npm install --silent && node ops-infra.js

regression-fleet: ## Live devices/services/catalog/batch power/OpenStack+K8s status
	cd scripts/regression && npm install --silent && node ops-fleet.js

regression-mission: ## Live browse disks/FS/fleet activity/reports/observability/Atlas
	cd scripts/regression && npm install --silent && node ops-mission.js

regression-catalog: ## Live jobs/audit/guest-health/network CRUD/HA/CD-ROM guards
	cd scripts/regression && npm install --silent && node ops-catalog.js

regression-hardware: ## Live hardware inventory/compat/SOC/K8s/send-key
	cd scripts/regression && npm install --silent && node ops-hardware.js

regression-host: ## Live host stats/PCI/USB/secrets CRUD/rightsizing/Zeus firewall
	cd scripts/regression && npm install --silent && node ops-host.js

regression-storage: ## Live health/session + storage/network live inventory + discover
	cd scripts/regression && npm install --silent && node ops-storage.js

regression-zeus: ## Live Zeus firewall deep + API keys/webhooks/nwfilter/cordon
	cd scripts/regression && npm install --silent && node ops-zeus.js

regression-audit: ## Live audit/templates/compliance/simulate/terminal session
	cd scripts/regression && npm install --silent && node ops-audit.js

regression-volume: ## Live volume CRUD + VM console/observability
	cd scripts/regression && npm install --silent && node ops-volume.js

regression-disk: ## Live volume resize/clone + disk attach/detach
	cd scripts/regression && npm install --silent && node ops-disk.js

regression-ui: ## Live CDP UI (Pause/Resume, platform tabs; needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-interactive.js

regression-ui-settings: ## Live CDP settings/nav smoke (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-settings.js

regression-ui-wizards: ## Live CDP create/wizard/OpenStack shells (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-wizards.js

regression-ui-security: ## Live CDP Zeus security/SOC/policy shells (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-security.js

regression-ui-k8s-os: ## Live CDP K8s + OpenStack management shells (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-k8s-os.js

regression-ui-mission: ## Live CDP mission/observability/reports/GPU shells (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-mission.js

regression-ui-catalog: ## Live CDP jobs/audit/snapshots/HA/notifications shells (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-catalog.js

regression-ui-hardware: ## Live CDP VM detail/SOC/AI/K8s hardware shells (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-hardware.js

regression-ui-host: ## Live CDP host/placement/launchpad/rightsizing shells (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-host.js

regression-ui-storage: ## Live CDP storage/networks/backups shells (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-storage.js

regression-ui-zeus: ## Live CDP Zeus deep/API keys/connectivity shells (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-zeus.js

regression-ui-audit: ## Live CDP audit/templates/users/create shells (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-audit.js

regression-ui-volume: ## Live CDP storage volumes/observability/VM console shells (needs Chrome :9222)
	cd scripts/regression && npm install --silent && node ui-volume.js

regression-pages: ## Live CDP page sweep (needs Chrome :9222; LOOPS=N; see scripts/regression/README.md)
	cd scripts/regression && npm install --silent && node page-sweep.js --loops $(LOOPS)

check: ## Run cargo check
	$(CARGO) check --workspace

web: ## Build web frontend
	cd web && npm install && npm run build

web-clean: ## Remove web build artifacts
	rm -rf web/dist web/node_modules

install: ## Install binaries, web UI, config, systemd unit, and mkosi workspace defs
	@test -f target/release/machina-daemon || { echo "Run 'make' or 'make release' first"; exit 1; }
	install -Dm755 target/release/machina-daemon $(DESTDIR)$(BINDIR)/machina-daemon
	install -Dm755 target/release/machina-tui $(DESTDIR)$(BINDIR)/machina
	@if [ "$(INSTALL_PLATFORM)" = "1" ]; then \
		install -Dm755 target/release/machina-controller $(DESTDIR)$(BINDIR)/machina-controller; \
		install -Dm755 target/release/machina-agent $(DESTDIR)$(BINDIR)/machina-agent; \
		install -Dm644 contrib/machina-controller.service $(DESTDIR)$(UNITDIR)/machina-controller.service; \
		install -Dm644 contrib/machina-agent.service $(DESTDIR)$(UNITDIR)/machina-agent.service; \
		install -Dm644 contrib/machina-platform.env $(DESTDIR)/etc/default/machina-platform; \
	fi
	install -Dm644 contrib/machina.toml $(DESTDIR)$(SYSCONFDIR)/machina/config.toml
	install -Dm644 contrib/machina-daemon.service $(DESTDIR)$(UNITDIR)/machina-daemon.service
	@test -f $(DESTDIR)/etc/default/machina-daemon || install -Dm644 contrib/machina-daemon.default $(DESTDIR)/etc/default/machina-daemon
	@if [ -d web/dist ]; then \
		mkdir -p $(DESTDIR)$(DATADIR)/machina/web; \
		cp -r web/dist/* $(DESTDIR)$(DATADIR)/machina/web/; \
		echo "Installed web UI to $(DESTDIR)$(DATADIR)/machina/web"; \
	fi
	@if [ -d contrib/mkosi-defs ]; then \
		for ws in contrib/mkosi-defs/*/; do \
			[ -f "$${ws}mkosi.conf" ] || continue; \
			name=$$(basename "$$ws"); \
			dst=$(DESTDIR)/var/lib/machina/mkosi-defs/$$name; \
			if [ ! -d "$$dst" ]; then \
				mkdir -p "$$dst"; \
				cp -r "$${ws}." "$$dst/"; \
				echo "Installed mkosi workspace: $$name"; \
			else \
				echo "mkosi workspace already exists, skipping: $$name"; \
			fi; \
		done; \
	fi
	systemctl daemon-reload 2>/dev/null || true

uninstall: stop ## Remove installed files and stop service
	systemctl disable machina-daemon 2>/dev/null || true
	rm -f $(DESTDIR)$(BINDIR)/machina-daemon
	rm -f $(DESTDIR)$(BINDIR)/machina
	rm -f $(DESTDIR)$(UNITDIR)/machina-daemon.service
	rm -rf $(DESTDIR)$(DATADIR)/machina
	rm -rf $(DESTDIR)$(SYSCONFDIR)/machina
	systemctl daemon-reload 2>/dev/null || true

start: ## Start the daemon service
	systemctl enable --now machina-daemon

stop: ## Stop the daemon service
	systemctl stop machina-daemon 2>/dev/null || true

restart: ## Restart the daemon service
	systemctl restart machina-daemon

status: ## Show daemon service status
	@systemctl status machina-daemon 2>/dev/null || echo "Service not running"

deploy: install start ## Install and start (run 'make' first to build)
	@echo ""
	@echo "✅ Machina deployed and running"
	@echo "   🌐 Web UI:  https://localhost:5092"
	@echo "   🖥️  TUI:     machina"
	@echo "   🔗 API:     https://localhost:5092/api/v1/health"

run-daemon: build ## Run the daemon (debug)
	$(CARGO) run -p machina-daemon

run-tui: build ## Run the TUI (debug)
	$(CARGO) run -p machina-tui

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  📋 %-13s %s\n", $$1, $$2}'

PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin
DATADIR ?= $(PREFIX)/share
SYSCONFDIR ?= /etc
UNITDIR ?= /usr/lib/systemd/system

CARGO ?= cargo
CARGO_FLAGS ?=

.PHONY: all build release debug clean install uninstall fmt lint test check web web-clean start stop restart status help

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

test: ## Run tests
	$(CARGO) test --workspace

check: ## Run cargo check
	$(CARGO) check --workspace

web: ## Build web frontend
	cd web && npm install && npm run build

web-clean: ## Remove web build artifacts
	rm -rf web/dist web/node_modules

install: ## Install binaries, web UI, config, and systemd unit
	@test -f target/release/virtspawn-daemon || { echo "Run 'make' or 'make release' first"; exit 1; }
	install -Dm755 target/release/virtspawn-daemon $(DESTDIR)$(BINDIR)/virtspawn-daemon
	install -Dm755 target/release/virtspawn-tui $(DESTDIR)$(BINDIR)/virtspawn
	install -Dm644 contrib/virtspawn.toml $(DESTDIR)$(SYSCONFDIR)/virtspawn/config.toml
	install -Dm644 contrib/virtspawn-daemon.service $(DESTDIR)$(UNITDIR)/virtspawn-daemon.service
	@if [ -d web/dist ]; then \
		mkdir -p $(DESTDIR)$(DATADIR)/virtspawn/web; \
		cp -r web/dist/* $(DESTDIR)$(DATADIR)/virtspawn/web/; \
		echo "Installed web UI to $(DESTDIR)$(DATADIR)/virtspawn/web"; \
	fi
	systemctl daemon-reload 2>/dev/null || true

uninstall: stop ## Remove installed files and stop service
	systemctl disable virtspawn-daemon 2>/dev/null || true
	rm -f $(DESTDIR)$(BINDIR)/virtspawn-daemon
	rm -f $(DESTDIR)$(BINDIR)/virtspawn
	rm -f $(DESTDIR)$(UNITDIR)/virtspawn-daemon.service
	rm -rf $(DESTDIR)$(DATADIR)/virtspawn
	rm -rf $(DESTDIR)$(SYSCONFDIR)/virtspawn
	systemctl daemon-reload 2>/dev/null || true

start: ## Start the daemon service
	systemctl enable --now virtspawn-daemon

stop: ## Stop the daemon service
	systemctl stop virtspawn-daemon 2>/dev/null || true

restart: ## Restart the daemon service
	systemctl restart virtspawn-daemon

status: ## Show daemon service status
	@systemctl status virtspawn-daemon 2>/dev/null || echo "Service not running"

deploy: install start ## Install and start (run 'make' first to build)
	@echo ""
	@echo "✅ virtspawn deployed and running"
	@echo "   🌐 Web UI:  http://localhost:5092"
	@echo "   🖥️  TUI:     virtspawn"
	@echo "   🔗 API:     http://localhost:5092/api/v1/health"

run-daemon: build ## Run the daemon (debug)
	$(CARGO) run -p virtspawn-daemon

run-tui: build ## Run the TUI (debug)
	$(CARGO) run -p virtspawn-tui

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

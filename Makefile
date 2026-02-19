PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin
SYSCONFDIR ?= /etc
UNITDIR ?= /usr/lib/systemd/system

CARGO ?= cargo
CARGO_FLAGS ?=

.PHONY: all build release debug clean install uninstall fmt lint test check help

all: build

build: ## Build in debug mode
	$(CARGO) build --workspace $(CARGO_FLAGS)

release: ## Build in release mode
	$(CARGO) build --workspace --release $(CARGO_FLAGS)

debug: build ## Alias for build

clean: ## Remove build artifacts
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

install: ## Install binaries, config, and systemd unit (run 'make release' first)
	@test -f target/release/virtspawn-daemon || { echo "Run 'make release' first"; exit 1; }
	install -Dm755 target/release/virtspawn-daemon $(DESTDIR)$(BINDIR)/virtspawn-daemon
	install -Dm755 target/release/virtspawn-tui $(DESTDIR)$(BINDIR)/virtspawn
	install -Dm644 contrib/virtspawn.toml $(DESTDIR)$(SYSCONFDIR)/virtspawn/config.toml
	install -Dm644 contrib/virtspawn-daemon.service $(DESTDIR)$(UNITDIR)/virtspawn-daemon.service

uninstall: ## Remove installed files
	rm -f $(DESTDIR)$(BINDIR)/virtspawn-daemon
	rm -f $(DESTDIR)$(BINDIR)/virtspawn
	rm -f $(DESTDIR)$(UNITDIR)/virtspawn-daemon.service

run-daemon: build ## Run the daemon (debug)
	$(CARGO) run -p virtspawn-daemon

run-tui: build ## Run the TUI (debug)
	$(CARGO) run -p virtspawn-tui

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

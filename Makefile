.PHONY: all build build-daemon build-ctl build-all clean test test-quick test-short test-verbose bench \
        fmt vet lint lint-fix security check ci \
        docker-build docker-run docker-push \
        install install-daemon install-ctl uninstall \
        release release-snapshot deps deps-update deps-verify vendor \
        run-daemon run-ctl run-debug help version

# ==================================================================================== #
# VARIABLES
# ==================================================================================== #

# Binary names
DAEMON_BINARY=hypervisord
CTL_BINARY=hyperctl
EXPORT_BINARY=hyperexport

# Build directory
BUILD_DIR=build

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod
GOFMT=$(GOCMD) fmt
GOVET=$(GOCMD) vet

# Version information
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo 'dev')
COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
BUILD_TIME := $(shell date -u '+%Y-%m-%d_%H:%M:%S')
GO_VERSION := $(shell go version | cut -d' ' -f3)

# Build flags
LDFLAGS=-ldflags "\
	-s -w \
	-X main.version=$(VERSION) \
	-X main.commit=$(COMMIT) \
	-X main.buildTime=$(BUILD_TIME) \
	-X main.goVersion=$(GO_VERSION)"

# Install paths
INSTALL_PREFIX ?= /usr/local
BIN_DIR=$(INSTALL_PREFIX)/bin
SYSTEMD_DIR=/etc/systemd/system

# Docker parameters
DOCKER_IMAGE ?= hypervisord
DOCKER_TAG ?= $(VERSION)
DOCKER_REGISTRY ?=

# Test parameters
TEST_TIMEOUT ?= 10m
TEST_PARALLEL ?= 4

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

# ==================================================================================== #
# DEVELOPMENT
# ==================================================================================== #

.DEFAULT_GOAL := help

all: clean build test ## Clean, build, and test everything

build: build-daemon build-ctl build-export ## Build all binaries

build-daemon: ## Build hypervisord daemon
	@echo "$(CYAN)🔨 Building $(DAEMON_BINARY)...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY) ./cmd/hypervisord
	@echo "$(GREEN)✅ Build complete: $(BUILD_DIR)/$(DAEMON_BINARY)$(RESET)"

build-ctl: ## Build hyperctl CLI
	@echo "$(CYAN)🔨 Building $(CTL_BINARY)...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY) ./cmd/hyperctl
	@echo "$(GREEN)✅ Build complete: $(BUILD_DIR)/$(CTL_BINARY)$(RESET)"

build-export: ## Build hyperexport interactive CLI
	@echo "$(CYAN)🔨 Building $(EXPORT_BINARY)...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(EXPORT_BINARY) ./cmd/hyperexport
	@echo "$(GREEN)✅ Build complete: $(BUILD_DIR)/$(EXPORT_BINARY)$(RESET)"

# ==================================================================================== #
# TESTING
# ==================================================================================== #

test: ## Run tests with race detector and coverage
	@echo "$(CYAN)🧪 Running tests...$(RESET)"
	$(GOTEST) -v -race -timeout=$(TEST_TIMEOUT) -coverprofile=coverage.out ./...
	@echo "$(GREEN)✅ Tests complete$(RESET)"

test-quick: ## Run tests without race detector (faster)
	@echo "$(CYAN)⚡ Running quick tests...$(RESET)"
	$(GOTEST) -timeout=$(TEST_TIMEOUT) -coverprofile=coverage.out ./...
	@echo "$(GREEN)✅ Quick tests complete$(RESET)"

test-short: ## Run only short tests
	@echo "$(CYAN)⏱️  Running short tests...$(RESET)"
	$(GOTEST) -short -timeout=1m ./...
	@echo "$(GREEN)✅ Short tests complete$(RESET)"

test-verbose: ## Run tests with verbose output
	@echo "$(CYAN)🔍 Running verbose tests...$(RESET)"
	$(GOTEST) -v -race -timeout=$(TEST_TIMEOUT) ./...

test-coverage: test ## Show detailed test coverage
	@echo "$(CYAN)📊 Test coverage:$(RESET)"
	@$(GOCMD) tool cover -func=coverage.out | tail -1

test-coverage-html: test ## Open test coverage in browser
	@echo "$(CYAN)📊 Opening test coverage in browser...$(RESET)"
	@$(GOCMD) tool cover -html=coverage.out

bench: ## Run benchmarks
	@echo "$(CYAN)⚡ Running benchmarks...$(RESET)"
	$(GOTEST) -bench=. -benchmem -run=^$$ ./...
	@echo "$(GREEN)✅ Benchmarks complete$(RESET)"

bench-compare: ## Run benchmarks and save for comparison
	@echo "$(CYAN)⚡ Running benchmarks...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	$(GOTEST) -bench=. -benchmem -run=^$$ ./... | tee $(BUILD_DIR)/bench.txt
	@echo "$(GREEN)✅ Benchmarks saved to $(BUILD_DIR)/bench.txt$(RESET)"

# ==================================================================================== #
# CODE QUALITY
# ==================================================================================== #

fmt: ## Format code
	@echo "$(CYAN)🎨 Formatting code...$(RESET)"
	@$(GOFMT) ./...
	@echo "$(GREEN)✅ Format complete$(RESET)"

fmt-check: ## Check if code is formatted
	@echo "$(CYAN)🎨 Checking code formatting...$(RESET)"
	@test -z "$$(gofmt -l .)" || (echo "$(RED)❌ Code is not formatted. Run 'make fmt'$(RESET)" && exit 1)
	@echo "$(GREEN)✅ Code is properly formatted$(RESET)"

vet: ## Run go vet
	@echo "$(CYAN)🔍 Running go vet...$(RESET)"
	@$(GOVET) ./...
	@echo "$(GREEN)✅ Vet complete$(RESET)"

lint: ## Run golangci-lint
	@echo "$(CYAN)🔍 Running linter...$(RESET)"
	@which golangci-lint > /dev/null || (echo "$(YELLOW)⚠️  golangci-lint not found. Install from https://golangci-lint.run/usage/install/$(RESET)"; exit 1)
	@golangci-lint run ./... --timeout=5m
	@echo "$(GREEN)✅ Lint complete$(RESET)"

lint-fix: ## Run golangci-lint with auto-fix
	@echo "$(CYAN)🔧 Running linter with auto-fix...$(RESET)"
	@which golangci-lint > /dev/null || (echo "$(YELLOW)⚠️  golangci-lint not found. Install from https://golangci-lint.run/usage/install/$(RESET)"; exit 1)
	@golangci-lint run ./... --fix --timeout=5m
	@echo "$(GREEN)✅ Lint with auto-fix complete$(RESET)"

security: ## Run security checks with gosec
	@echo "$(CYAN)🔒 Running security checks...$(RESET)"
	@which gosec > /dev/null || (echo "$(YELLOW)⚠️  gosec not found. Install: go install github.com/securego/gosec/v2/cmd/gosec@latest$(RESET)"; exit 1)
	@gosec -quiet ./...
	@echo "$(GREEN)✅ Security check complete$(RESET)"

staticcheck: ## Run staticcheck
	@echo "$(CYAN)🔍 Running staticcheck...$(RESET)"
	@which staticcheck > /dev/null || (echo "$(YELLOW)⚠️  staticcheck not found. Install: go install honnef.co/go/tools/cmd/staticcheck@latest$(RESET)"; exit 1)
	@staticcheck ./...
	@echo "$(GREEN)✅ Staticcheck complete$(RESET)"

check: fmt-check vet lint test ## Run all checks (format, vet, lint, test)
	@echo "$(GREEN)✅ All checks passed!$(RESET)"

ci: check security ## Run all CI checks
	@echo "$(GREEN)✅ All CI checks passed!$(RESET)"

# ==================================================================================== #
# DEPENDENCIES
# ==================================================================================== #

deps: ## Download dependencies
	@echo "$(CYAN)📥 Downloading dependencies...$(RESET)"
	@$(GOMOD) download
	@$(GOMOD) tidy
	@echo "$(GREEN)✅ Dependencies downloaded$(RESET)"

deps-update: ## Update dependencies
	@echo "$(CYAN)🔄 Updating dependencies...$(RESET)"
	@$(GOGET) -u ./...
	@$(GOMOD) tidy
	@echo "$(GREEN)✅ Dependencies updated$(RESET)"

deps-verify: ## Verify dependencies
	@echo "$(CYAN)🔍 Verifying dependencies...$(RESET)"
	@$(GOMOD) verify
	@echo "$(GREEN)✅ Dependencies verified$(RESET)"

deps-graph: ## Show dependency graph
	@echo "$(CYAN)📊 Dependency graph:$(RESET)"
	@go mod graph

deps-why: ## Explain why a dependency is needed (usage: make deps-why PKG=package/name)
	@$(GOMOD) why $(PKG)

vendor: ## Vendor dependencies
	@echo "$(CYAN)📦 Vendoring dependencies...$(RESET)"
	@$(GOMOD) vendor
	@echo "$(GREEN)✅ Dependencies vendored$(RESET)"

vuln-check: ## Check for known vulnerabilities (requires govulncheck)
	@echo "$(CYAN)🔍 Checking for vulnerabilities...$(RESET)"
	@which govulncheck > /dev/null || (echo "$(YELLOW)⚠️  govulncheck not found. Install: go install golang.org/x/vuln/cmd/govulncheck@latest$(RESET)"; exit 1)
	@govulncheck ./...
	@echo "$(GREEN)✅ Vulnerability check complete$(RESET)"

# ==================================================================================== #
# BUILD VARIANTS
# ==================================================================================== #

build-linux: ## Build for Linux (amd64)
	@echo "$(CYAN)🔨 Building for Linux (amd64)...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	@GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-linux-amd64 ./cmd/hypervisord
	@GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-linux-amd64 ./cmd/hyperctl
	@echo "$(GREEN)✅ Linux builds complete$(RESET)"

build-all: ## Build for all platforms
	@echo "$(CYAN)🔨 Building for all platforms...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	@echo "Building Linux binaries..."
	@GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-linux-amd64 ./cmd/hypervisord
	@GOOS=linux GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-linux-arm64 ./cmd/hypervisord
	@GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-linux-amd64 ./cmd/hyperctl
	@GOOS=linux GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-linux-arm64 ./cmd/hyperctl
	@echo "Building macOS binaries..."
	@GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-darwin-amd64 ./cmd/hypervisord
	@GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-darwin-arm64 ./cmd/hypervisord
	@GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-darwin-amd64 ./cmd/hyperctl
	@GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-darwin-arm64 ./cmd/hyperctl
	@echo "Building Windows binaries..."
	@GOOS=windows GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-windows-amd64.exe ./cmd/hypervisord
	@GOOS=windows GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-windows-amd64.exe ./cmd/hyperctl
	@echo "$(GREEN)✅ All platform builds complete$(RESET)"
	@ls -lh $(BUILD_DIR)/

build-race: ## Build with race detector enabled
	@echo "$(CYAN)🔨 Building with race detector...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	@$(GOBUILD) $(LDFLAGS) -race -o $(BUILD_DIR)/$(DAEMON_BINARY)-race ./cmd/hypervisord
	@echo "$(GREEN)✅ Race build complete$(RESET)"

# ==================================================================================== #
# RELEASE
# ==================================================================================== #

release: clean ## Build release binaries with checksums
	@echo "$(CYAN)📦 Building release $(VERSION)...$(RESET)"
	@$(MAKE) build-all
	@echo "$(CYAN)🔐 Generating checksums...$(RESET)"
	@cd $(BUILD_DIR) && sha256sum * > SHA256SUMS
	@echo "$(GREEN)✅ Release $(VERSION) complete$(RESET)"
	@echo "$(CYAN)📋 Release artifacts:$(RESET)"
	@ls -lh $(BUILD_DIR)/

release-snapshot: ## Build snapshot release (no git tag required)
	@echo "$(CYAN)📦 Building snapshot release...$(RESET)"
	@VERSION=snapshot-$(COMMIT)-$(shell date +%Y%m%d%H%M%S) $(MAKE) release

# ==================================================================================== #
# DOCKER
# ==================================================================================== #

docker-build: ## Build Docker image
	@echo "$(CYAN)🐳 Building Docker image...$(RESET)"
	@docker build \
		--build-arg VERSION=$(VERSION) \
		--build-arg COMMIT=$(COMMIT) \
		--build-arg BUILD_TIME=$(BUILD_TIME) \
		-t $(DOCKER_IMAGE):$(DOCKER_TAG) \
		-t $(DOCKER_IMAGE):latest \
		.
	@echo "$(GREEN)✅ Docker image built: $(DOCKER_IMAGE):$(DOCKER_TAG)$(RESET)"

docker-build-no-cache: ## Build Docker image without cache
	@echo "$(CYAN)🐳 Building Docker image (no cache)...$(RESET)"
	@docker build --no-cache \
		--build-arg VERSION=$(VERSION) \
		--build-arg COMMIT=$(COMMIT) \
		--build-arg BUILD_TIME=$(BUILD_TIME) \
		-t $(DOCKER_IMAGE):$(DOCKER_TAG) \
		-t $(DOCKER_IMAGE):latest \
		.
	@echo "$(GREEN)✅ Docker image built: $(DOCKER_IMAGE):$(DOCKER_TAG)$(RESET)"

docker-run: ## Run Docker container
	@echo "$(CYAN)🐳 Running Docker container...$(RESET)"
	@docker run --rm \
		-e GOVC_URL \
		-e GOVC_USERNAME \
		-e GOVC_PASSWORD \
		-e GOVC_INSECURE \
		-v $(PWD)/exports:/exports \
		-p 8080:8080 \
		$(DOCKER_IMAGE):$(DOCKER_TAG)

docker-push: ## Push Docker image to registry
	@echo "$(CYAN)🐳 Pushing Docker image to registry...$(RESET)"
	@if [ -n "$(DOCKER_REGISTRY)" ]; then \
		docker tag $(DOCKER_IMAGE):$(DOCKER_TAG) $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):$(DOCKER_TAG); \
		docker push $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):$(DOCKER_TAG); \
	else \
		docker push $(DOCKER_IMAGE):$(DOCKER_TAG); \
	fi
	@echo "$(GREEN)✅ Docker image pushed$(RESET)"

docker-shell: ## Run shell in Docker container
	@docker run --rm -it --entrypoint /bin/sh $(DOCKER_IMAGE):$(DOCKER_TAG)

# ==================================================================================== #
# INSTALLATION
# ==================================================================================== #

install: install-daemon install-ctl ## Install all binaries

install-daemon: build-daemon ## Install hypervisord daemon
	@echo "$(CYAN)📦 Installing $(DAEMON_BINARY)...$(RESET)"
	@sudo install -m 755 $(BUILD_DIR)/$(DAEMON_BINARY) $(BIN_DIR)/$(DAEMON_BINARY)
	@sudo install -m 644 systemd/hypervisord.service $(SYSTEMD_DIR)/hypervisord.service
	@echo "$(GREEN)✅ Installed $(DAEMON_BINARY) to $(BIN_DIR)$(RESET)"
	@echo "$(GREEN)✅ Installed systemd service to $(SYSTEMD_DIR)$(RESET)"
	@echo ""
	@echo "$(YELLOW)To enable and start the service:$(RESET)"
	@echo "  sudo systemctl daemon-reload"
	@echo "  sudo systemctl enable hypervisord"
	@echo "  sudo systemctl start hypervisord"

install-ctl: build-ctl ## Install hyperctl CLI
	@echo "$(CYAN)📦 Installing $(CTL_BINARY)...$(RESET)"
	@sudo install -m 755 $(BUILD_DIR)/$(CTL_BINARY) $(BIN_DIR)/$(CTL_BINARY)
	@echo "$(GREEN)✅ Installed $(CTL_BINARY) to $(BIN_DIR)$(RESET)"

uninstall: ## Uninstall all binaries and services
	@echo "$(CYAN)🗑️  Uninstalling...$(RESET)"
	@sudo systemctl stop hypervisord 2>/dev/null || true
	@sudo systemctl disable hypervisord 2>/dev/null || true
	@sudo rm -f $(BIN_DIR)/$(DAEMON_BINARY)
	@sudo rm -f $(BIN_DIR)/$(CTL_BINARY)
	@sudo rm -f $(BIN_DIR)/$(EXPORT_BINARY)
	@sudo rm -f $(SYSTEMD_DIR)/hypervisord.service
	@sudo systemctl daemon-reload
	@echo "$(GREEN)✅ Uninstall complete$(RESET)"

# ==================================================================================== #
# CLEANUP
# ==================================================================================== #

clean: ## Clean build artifacts
	@echo "$(CYAN)🧹 Cleaning...$(RESET)"
	@$(GOCLEAN)
	@rm -rf $(BUILD_DIR)
	@rm -f coverage.out
	@echo "$(GREEN)✅ Clean complete$(RESET)"

clean-all: clean ## Deep clean (including vendor and cache)
	@echo "$(CYAN)🧹 Deep cleaning...$(RESET)"
	@rm -rf vendor/
	@$(GOCLEAN) -cache -testcache -modcache
	@echo "$(GREEN)✅ Deep clean complete$(RESET)"

# ==================================================================================== #
# RUN
# ==================================================================================== #

run-daemon: build-daemon ## Build and run hypervisord
	@echo "$(CYAN)🚀 Running $(DAEMON_BINARY)...$(RESET)"
	@$(BUILD_DIR)/$(DAEMON_BINARY)

run-ctl: build-ctl ## Build and run hyperctl
	@echo "$(CYAN)🚀 Running $(CTL_BINARY)...$(RESET)"
	@$(BUILD_DIR)/$(CTL_BINARY)

run-debug: build-daemon ## Build and run with debug logging
	@echo "$(CYAN)🐛 Running $(DAEMON_BINARY) in debug mode...$(RESET)"
	@LOG_LEVEL=debug $(BUILD_DIR)/$(DAEMON_BINARY)

run-race: build-race ## Build with race detector and run
	@echo "$(CYAN)🏃 Running with race detector...$(RESET)"
	@$(BUILD_DIR)/$(DAEMON_BINARY)-race

# ==================================================================================== #
# UTILITIES
# ==================================================================================== #

version: ## Show version information
	@echo "$(CYAN)Version:$(RESET)     $(VERSION)"
	@echo "$(CYAN)Commit:$(RESET)      $(COMMIT)"
	@echo "$(CYAN)Build time:$(RESET)  $(BUILD_TIME)"
	@echo "$(CYAN)Go version:$(RESET)  $(GO_VERSION)"

info: version ## Show build information
	@echo ""
	@echo "$(CYAN)Build directory:$(RESET) $(BUILD_DIR)"
	@echo "$(CYAN)Install prefix:$(RESET)  $(INSTALL_PREFIX)"
	@echo "$(CYAN)Docker image:$(RESET)    $(DOCKER_IMAGE):$(DOCKER_TAG)"

pre-commit: fmt vet lint test ## Run pre-commit checks
	@echo "$(GREEN)✅ Pre-commit checks passed$(RESET)"

todo: ## Show TODO comments in code
	@echo "$(CYAN)📝 TODO items:$(RESET)"
	@grep -r "TODO\|FIXME\|XXX" --include="*.go" --line-number . || echo "No TODO items found"

lines: ## Count lines of code
	@echo "$(CYAN)📊 Lines of code:$(RESET)"
	@find . -name '*.go' -not -path "./vendor/*" | xargs wc -l | tail -1

size: build ## Show binary sizes
	@echo "$(CYAN)📏 Binary sizes:$(RESET)"
	@ls -lh $(BUILD_DIR)/ | grep -v "^d" | awk '{print $$9 ": " $$5}'

test-rpm: ## Test RPM build locally
	@echo "$(CYAN)📦 Testing RPM build...$(RESET)"
	@./test_rpmbuild.sh

watch: ## Watch for changes and rebuild (requires entr)
	@which entr > /dev/null || (echo "$(RED)❌ entr not found. Install with: apt install entr$(RESET)"; exit 1)
	@echo "$(CYAN)👀 Watching for changes...$(RESET)"
	@find . -name '*.go' | entr -c make build

help: ## Show this help
	@echo ""
	@echo "$(CYAN)╔════════════════════════════════════════════════════════════════╗$(RESET)"
	@echo "$(CYAN)║$(RESET)  $(YELLOW)HyperSDK - Makefile Help$(RESET)                                  $(CYAN)║$(RESET)"
	@echo "$(CYAN)╚════════════════════════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "$(YELLOW)Components:$(RESET)"
	@echo "  $(DAEMON_BINARY)  - Go daemon for multi-cloud VM export"
	@echo "  $(CTL_BINARY)     - Control CLI for managing exports"
	@echo "  $(EXPORT_BINARY)  - Interactive CLI for manual VM exports"
	@echo ""
	@echo "$(YELLOW)Available targets:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-22s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Examples:$(RESET)"
	@echo "  make build          # Build all binaries"
	@echo "  make test           # Run tests with coverage"
	@echo "  make check          # Run all quality checks"
	@echo "  make ci             # Run all CI checks"
	@echo "  make release        # Build release artifacts"
	@echo ""
	@echo "$(YELLOW)Current version:$(RESET) $(VERSION)"
	@echo ""

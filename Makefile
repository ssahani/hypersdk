.PHONY: all build build-daemon build-ctl build-all clean test fmt vet lint docker-build docker-run help install install-daemon install-ctl

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

# Build flags
LDFLAGS=-ldflags "-s -w -X main.version=$(shell git describe --tags --always --dirty 2>/dev/null || echo 'dev')"

# Install paths
INSTALL_PREFIX=/usr/local
BIN_DIR=$(INSTALL_PREFIX)/bin
SYSTEMD_DIR=/etc/systemd/system

# Docker parameters
DOCKER_IMAGE=hypervisord
DOCKER_TAG=latest

all: clean build

build: build-daemon build-ctl build-export ## Build all binaries

build-daemon: ## Build hypervisord daemon
	@echo "🔨 Building $(DAEMON_BINARY)..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY) ./cmd/hypervisord
	@echo "✅ Build complete: $(BUILD_DIR)/$(DAEMON_BINARY)"

build-ctl: ## Build hyperctl CLI
	@echo "🔨 Building $(CTL_BINARY)..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY) ./cmd/hyperctl
	@echo "✅ Build complete: $(BUILD_DIR)/$(CTL_BINARY)"

build-export: ## Build hyperexport interactive CLI
	@echo "🔨 Building $(EXPORT_BINARY)..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(EXPORT_BINARY) ./cmd/hyperexport
	@echo "✅ Build complete: $(BUILD_DIR)/$(EXPORT_BINARY)"

build-linux: ## Build for Linux
	@echo "🔨 Building for Linux (amd64)..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-linux-amd64 ./cmd/hypervisord
	GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-linux-amd64 ./cmd/hyperctl
	@echo "✅ Linux builds complete"

build-all: ## Build for all platforms
	@echo "🔨 Building for all platforms..."
	@mkdir -p $(BUILD_DIR)
	# Linux
	GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-linux-amd64 ./cmd/hypervisord
	GOOS=linux GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-linux-arm64 ./cmd/hypervisord
	GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-linux-amd64 ./cmd/hyperctl
	GOOS=linux GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-linux-arm64 ./cmd/hyperctl
	# macOS
	GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-darwin-amd64 ./cmd/hypervisord
	GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-darwin-arm64 ./cmd/hypervisord
	GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-darwin-amd64 ./cmd/hyperctl
	GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-darwin-arm64 ./cmd/hyperctl
	# Windows
	GOOS=windows GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(DAEMON_BINARY)-windows-amd64.exe ./cmd/hypervisord
	GOOS=windows GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(CTL_BINARY)-windows-amd64.exe ./cmd/hyperctl
	@echo "✅ All builds complete"

install: install-daemon install-ctl ## Install all binaries

install-daemon: build-daemon ## Install hypervisord daemon
	@echo "📦 Installing $(DAEMON_BINARY)..."
	@sudo install -m 755 $(BUILD_DIR)/$(DAEMON_BINARY) $(BIN_DIR)/$(DAEMON_BINARY)
	@sudo install -m 644 systemd/hypervisord.service $(SYSTEMD_DIR)/systemd/hypervisord.service
	@echo "✅ Installed $(DAEMON_BINARY) to $(BIN_DIR)"
	@echo "✅ Installed systemd service to $(SYSTEMD_DIR)"
	@echo ""
	@echo "To enable and start the service:"
	@echo "  sudo systemctl daemon-reload"
	@echo "  sudo systemctl enable hypervisord"
	@echo "  sudo systemctl start hypervisord"

install-ctl: build-ctl ## Install hyperctl CLI
	@echo "📦 Installing $(CTL_BINARY)..."
	@sudo install -m 755 $(BUILD_DIR)/$(CTL_BINARY) $(BIN_DIR)/$(CTL_BINARY)
	@echo "✅ Installed $(CTL_BINARY) to $(BIN_DIR)"

uninstall: ## Uninstall all binaries and services
	@echo "🗑️  Uninstalling..."
	@sudo systemctl stop hypervisord 2>/dev/null || true
	@sudo systemctl disable hypervisord 2>/dev/null || true
	@sudo rm -f $(BIN_DIR)/$(DAEMON_BINARY)
	@sudo rm -f $(BIN_DIR)/$(CTL_BINARY)
	@sudo rm -f $(BIN_DIR)/$(EXPORT_BINARY)
	@sudo rm -f $(SYSTEMD_DIR)/systemd/hypervisord.service
	@sudo systemctl daemon-reload
	@echo "✅ Uninstall complete"

clean: ## Clean build artifacts
	@echo "🧹 Cleaning..."
	@$(GOCLEAN)
	@rm -rf $(BUILD_DIR)
	@rm -f coverage.out
	@echo "✅ Clean complete"

test: ## Run tests
	@echo "🧪 Running tests..."
	$(GOTEST) -v -race -coverprofile=coverage.out ./...
	@echo "✅ Tests complete"

test-coverage: test ## Show test coverage
	@echo "📊 Test coverage:"
	$(GOCMD) tool cover -func=coverage.out

test-html: test ## Show test coverage in browser
	@echo "📊 Opening test coverage in browser..."
	$(GOCMD) tool cover -html=coverage.out

fmt: ## Format code
	@echo "🎨 Formatting code..."
	$(GOFMT) ./...
	@echo "✅ Format complete"

vet: ## Run go vet
	@echo "🔍 Running go vet..."
	$(GOVET) ./...
	@echo "✅ Vet complete"

lint: ## Run golangci-lint (requires golangci-lint installed)
	@echo "🔍 Running linter..."
	@which golangci-lint > /dev/null || (echo "❌ golangci-lint not found. Install from https://golangci-lint.run/usage/install/"; exit 1)
	golangci-lint run ./...
	@echo "✅ Lint complete"

deps: ## Download dependencies
	@echo "📥 Downloading dependencies..."
	$(GOMOD) download
	$(GOMOD) tidy
	@echo "✅ Dependencies downloaded"

deps-update: ## Update dependencies
	@echo "🔄 Updating dependencies..."
	$(GOGET) -u ./...
	$(GOMOD) tidy
	@echo "✅ Dependencies updated"

docker-build: ## Build Docker image
	@echo "🐳 Building Docker image..."
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .
	@echo "✅ Docker image built: $(DOCKER_IMAGE):$(DOCKER_TAG)"

docker-run: ## Run Docker container
	@echo "🐳 Running Docker container..."
	docker run --rm \
		-e GOVC_URL \
		-e GOVC_USERNAME \
		-e GOVC_PASSWORD \
		-e GOVC_INSECURE \
		-v $(PWD)/exports:/exports \
		$(DOCKER_IMAGE):$(DOCKER_TAG)

run-daemon: build-daemon ## Build and run hypervisord
	@echo "🚀 Running $(DAEMON_BINARY)..."
	@$(BUILD_DIR)/$(DAEMON_BINARY)

run-ctl: build-ctl ## Build and run hyperctl
	@echo "🚀 Running $(CTL_BINARY)..."
	@$(BUILD_DIR)/$(CTL_BINARY)

run-debug: build-daemon ## Build and run with debug logging
	@echo "🐛 Running $(DAEMON_BINARY) in debug mode..."
	@LOG_LEVEL=debug $(BUILD_DIR)/$(DAEMON_BINARY)

version: ## Show version information
	@echo "hypervisord: $(shell git describe --tags --always --dirty 2>/dev/null || echo 'dev')"
	@echo "Git commit: $(shell git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
	@echo "Build date: $(shell date -u '+%Y-%m-%d %H:%M:%S UTC')"

test-rpm: ## Test RPM build locally
	@echo "📦 Testing RPM build..."
	@./test_rpmbuild.sh

help: ## Show this help
	@echo ""
	@echo "hyper-sdk - Makefile commands:"
	@echo ""
	@echo "Components:"
	@echo "  hypervisord  - Go daemon for vSphere VM export"
	@echo "  hyperctl     - Control CLI for managing conversions"
	@echo "  hyperexport  - Interactive CLI for manual VM exports"
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

.DEFAULT_GOAL := help

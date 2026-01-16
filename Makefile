.PHONY: all build clean test fmt vet lint docker-build docker-run help

# Binary name
BINARY_NAME=hyper2kvm

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
LDFLAGS=-ldflags "-s -w"

# Docker parameters
DOCKER_IMAGE=hyper2kvm
DOCKER_TAG=latest

all: clean build

build: ## Build the binary
	@echo "🔨 Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/hyper2kvm
	@echo "✅ Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

build-linux: ## Build for Linux
	@echo "🔨 Building $(BINARY_NAME) for Linux..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 ./cmd/hyper2kvm
	@echo "✅ Build complete: $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64"

build-all: ## Build for all platforms
	@echo "🔨 Building $(BINARY_NAME) for all platforms..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 ./cmd/hyper2kvm
	GOOS=linux GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64 ./cmd/hyper2kvm
	GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 ./cmd/hyper2kvm
	GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-arm64 ./cmd/hyper2kvm
	GOOS=windows GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe ./cmd/hyper2kvm
	@echo "✅ All builds complete"

install: build ## Install the binary
	@echo "📦 Installing $(BINARY_NAME)..."
	@cp $(BUILD_DIR)/$(BINARY_NAME) $(GOPATH)/bin/
	@echo "✅ Installed to $(GOPATH)/bin/$(BINARY_NAME)"

clean: ## Clean build artifacts
	@echo "🧹 Cleaning..."
	@$(GOCLEAN)
	@rm -rf $(BUILD_DIR)
	@echo "✅ Clean complete"

test: ## Run tests
	@echo "🧪 Running tests..."
	$(GOTEST) -v -race -coverprofile=coverage.out ./...
	@echo "✅ Tests complete"

test-coverage: test ## Show test coverage
	@echo "📊 Test coverage:"
	$(GOCMD) tool cover -func=coverage.out

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

run: build ## Build and run
	@echo "🚀 Running $(BINARY_NAME)..."
	@$(BUILD_DIR)/$(BINARY_NAME)

run-debug: build ## Build and run with debug logging
	@echo "🐛 Running $(BINARY_NAME) in debug mode..."
	@LOG_LEVEL=debug $(BUILD_DIR)/$(BINARY_NAME)

help: ## Show this help
	@echo ""
	@echo "hyper2kvm - Makefile commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

.DEFAULT_GOAL := help

// SPDX-License-Identifier: LGPL-3.0-or-later

package api

import (
	"context"
	"crypto/subtle"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"hypersdk/daemon/auth"
	"hypersdk/daemon/capabilities"
	"hypersdk/daemon/jobs"
	"hypersdk/daemon/metrics"
	"hypersdk/daemon/models"
	"hypersdk/daemon/scheduler"
	"hypersdk/daemon/store"
	"hypersdk/daemon/webhooks"
	"hypersdk/logger"
)

// Config holds the configuration for the enhanced server
type Config struct {
	Webhooks []webhooks.Webhook `yaml:"webhooks" json:"webhooks"`
	Database struct {
		Path string `yaml:"path" json:"path"`
	} `yaml:"database" json:"database"`
	Metrics struct {
		Enabled bool `yaml:"enabled" json:"enabled"`
		Port    int  `yaml:"port" json:"port"`
	} `yaml:"metrics" json:"metrics"`
	Security struct {
		APIKey            string   `yaml:"api_key" json:"-"`                      // API key for authentication
		AllowedOrigins    []string `yaml:"allowed_origins" json:"allowed_origins"` // Allowed WebSocket origins
		MaxRequestSizeMB  int      `yaml:"max_request_size_mb" json:"max_request_size_mb"`
		RateLimitPerMin   int      `yaml:"rate_limit_per_min" json:"rate_limit_per_min"`
		EnableAuth        bool     `yaml:"enable_auth" json:"enable_auth"`
		TrustedProxies    []string `yaml:"trusted_proxies" json:"trusted_proxies"`
		BlockPrivateIPs   bool     `yaml:"block_private_ips" json:"block_private_ips"` // Block private IPs in webhooks
	} `yaml:"security" json:"security"`
}

// EnhancedServer extends the base server with new features
type EnhancedServer struct {
	*Server
	scheduler       *scheduler.Scheduler
	webhookMgr      *webhooks.Manager
	store           store.JobStore
	config          *Config
	wsHub           *WSHub
	statusTicker    *time.Ticker
	shutdownCtx     context.Context
	shutdownCancel  context.CancelFunc
	authMgr         *auth.AuthManager
}

// jobExecutorAdapter adapts jobs.Manager to scheduler.JobExecutor interface
type jobExecutorAdapter struct {
	manager *jobs.Manager
}

func (a *jobExecutorAdapter) SubmitJob(definition models.JobDefinition) error {
	_, err := a.manager.SubmitJob(definition)
	return err
}

// NewEnhancedServer creates a new enhanced API server with all Phase 1 features
func NewEnhancedServer(manager *jobs.Manager, detector *capabilities.Detector, log logger.Logger, addr string, config *Config) (*EnhancedServer, error) {
	// Apply default security settings if not configured
	if config.Security.MaxRequestSizeMB == 0 {
		config.Security.MaxRequestSizeMB = 10 // 10MB default
	}
	if len(config.Security.AllowedOrigins) == 0 {
		// Default to localhost for development
		config.Security.AllowedOrigins = []string{
			"http://localhost:8080",
			"https://localhost:8080",
		}
	}
	if config.Security.BlockPrivateIPs {
		log.Info("webhook private IP blocking enabled")
	}

	// Create base server
	baseServer := NewServer(manager, detector, log, addr)

	// Create shutdown context
	ctx, cancel := context.WithCancel(context.Background())

	es := &EnhancedServer{
		Server:         baseServer,
		config:         config,
		shutdownCtx:    ctx,
		shutdownCancel: cancel,
	}

	// Initialize job store if database path is provided
	if config.Database.Path != "" {
		jobStore, err := store.NewSQLiteStore(config.Database.Path)
		if err != nil {
			log.Error("failed to initialize job store", "error", err)
		} else {
			es.store = jobStore
			log.Info("job persistence enabled", "dbPath", config.Database.Path)
		}
	}

	// Initialize webhook manager if webhooks array exists (even if empty)
	if config.Webhooks != nil {
		es.webhookMgr = webhooks.NewManager(config.Webhooks, log)
		if len(config.Webhooks) > 0 {
			log.Info("webhooks enabled", "count", len(config.Webhooks))
		}
	}

	// Initialize scheduler
	executor := &jobExecutorAdapter{manager: manager}
	es.scheduler = scheduler.NewScheduler(executor, log)
	es.scheduler.Start()
	log.Info("job scheduler enabled")

	// Set build info for metrics
	metrics.SetBuildInfo("0.0.1", "go1.24")

	// Initialize WebSocket hub with shutdown context
	es.wsHub = NewWSHub()
	es.wsHub.SetLogger(log)
	go es.wsHub.Run(es.shutdownCtx)
	es.statusTicker = es.StartStatusBroadcaster(es.shutdownCtx)
	log.Info("websocket support enabled")

	// Initialize authentication manager
	es.authMgr = auth.NewAuthManager()
	log.Info("authentication enabled")

	// Register enhanced routes
	es.registerEnhancedRoutes()

	return es, nil
}

// registerEnhancedRoutes adds new API endpoints for Phase 1 features
func (es *EnhancedServer) registerEnhancedRoutes() {
	mux := http.NewServeMux()

	// Authentication endpoints (no auth required)
	mux.HandleFunc("/api/login", es.handleLogin)
	mux.HandleFunc("/api/logout", es.handleLogout)

	// Copy existing routes from base server
	mux.HandleFunc("/health", es.handleHealth)
	mux.HandleFunc("/status", es.handleStatus)
	mux.HandleFunc("/capabilities", es.handleCapabilities)
	mux.HandleFunc("/jobs/submit", es.handleSubmitJob)
	mux.HandleFunc("/jobs/query", es.handleQueryJobs)
	mux.HandleFunc("/jobs/cancel", es.handleCancelJobs)
	mux.HandleFunc("/jobs/", es.handleGetJob)

	// VM discovery and management
	mux.HandleFunc("/vms/list", es.handleListVMs)
	mux.HandleFunc("/vms/info", es.handleVMInfo)
	mux.HandleFunc("/vms/shutdown", es.handleVMShutdown)
	mux.HandleFunc("/vms/poweroff", es.handleVMPowerOff)
	mux.HandleFunc("/vms/remove-cdrom", es.handleVMRemoveCDROM)

	// Prometheus metrics endpoint
	if es.config.Metrics.Enabled {
		mux.Handle("/metrics", promhttp.Handler())
	}

	// WebSocket endpoint for real-time updates
	mux.HandleFunc("/ws", es.handleWebSocket)

	// Serve web dashboard (static files)
	webDir := filepath.Join(".", "web", "dashboard")
	fileServer := http.FileServer(http.Dir(webDir))
	mux.Handle("/web/dashboard/", http.StripPrefix("/web/dashboard/", fileServer))
	// Redirect root to dashboard
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/web/dashboard/", http.StatusFound)
			return
		}
		http.NotFound(w, r)
	})

	// Schedule management endpoints
	mux.HandleFunc("/schedules", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			es.handleListSchedules(w, r)
		case http.MethodPost:
			es.handleCreateSchedule(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/schedules/stats", es.handleScheduleStats)
	mux.HandleFunc("/schedules/", func(w http.ResponseWriter, r *http.Request) {
		// Handle different operations on specific schedules
		if r.URL.Path == "/schedules/" {
			http.Error(w, "schedule ID required", http.StatusBadRequest)
			return
		}

		// Check for sub-actions
		if strings.HasSuffix(r.URL.Path, "/enable") {
			es.handleEnableSchedule(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/disable") {
			es.handleDisableSchedule(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/trigger") {
			es.handleTriggerSchedule(w, r)
		} else {
			switch r.Method {
			case http.MethodGet:
				es.handleGetSchedule(w, r)
			case http.MethodPut:
				es.handleUpdateSchedule(w, r)
			case http.MethodDelete:
				es.handleDeleteSchedule(w, r)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
		}
	})

	// Webhook management endpoints
	mux.HandleFunc("/webhooks", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			es.handleListWebhooks(w, r)
		case http.MethodPost:
			es.handleAddWebhook(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/webhooks/test", es.handleTestWebhook)
	mux.HandleFunc("/webhooks/", es.handleDeleteWebhook)

	// Update the HTTP server with middleware chain
	handler := es.loggingMiddleware(mux)
	handler = es.requestSizeLimitMiddleware(handler)
	handler = es.authMiddleware(handler)
	es.httpServer.Handler = handler
}

// Shutdown gracefully shuts down the enhanced server
func (es *EnhancedServer) Shutdown(ctx context.Context) error {
	es.logger.Info("shutting down enhanced API server")

	// Cancel shutdown context to stop background goroutines
	if es.shutdownCancel != nil {
		es.shutdownCancel()
	}

	// Stop status broadcaster ticker
	if es.statusTicker != nil {
		es.statusTicker.Stop()
		es.logger.Debug("status broadcaster stopped")
	}

	// Stop scheduler
	if es.scheduler != nil {
		es.scheduler.Stop()
		es.logger.Debug("scheduler stopped")
	}

	// Close WebSocket hub (close all client connections)
	if es.wsHub != nil {
		es.wsHub.Shutdown()
		es.logger.Debug("websocket hub shutdown")
	}

	// Close store
	if es.store != nil {
		if err := es.store.Close(); err != nil {
			es.logger.Error("failed to close job store", "error", err)
		} else {
			es.logger.Debug("job store closed")
		}
	}

	// Shutdown HTTP server with timeout
	es.logger.Info("shutting down HTTP server")
	if err := es.httpServer.Shutdown(ctx); err != nil {
		es.logger.Error("HTTP server shutdown error", "error", err)
		return err
	}

	es.logger.Info("enhanced API server shutdown complete")
	return nil
}

// authMiddleware checks API authentication
func (es *EnhancedServer) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip auth if disabled
		if !es.config.Security.EnableAuth {
			next.ServeHTTP(w, r)
			return
		}

		// Skip auth for health check
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		// Validate server configuration
		if es.config.Security.APIKey == "" {
			es.logger.Error("authentication enabled but API key not configured")
			http.Error(w, "server configuration error", http.StatusInternalServerError)
			return
		}

		// Get API key from header or query parameter
		apiKey := r.Header.Get("X-API-Key")
		if apiKey == "" {
			apiKey = r.Header.Get("Authorization")
			if strings.HasPrefix(apiKey, "Bearer ") {
				apiKey = strings.TrimPrefix(apiKey, "Bearer ")
			}
		}
		if apiKey == "" {
			apiKey = r.URL.Query().Get("api_key")
		}

		// Validate API key using constant-time comparison to prevent timing attacks
		if apiKey == "" || subtle.ConstantTimeCompare([]byte(apiKey), []byte(es.config.Security.APIKey)) != 1 {
			es.logger.Warn("unauthorized API access attempt",
				"remote", r.RemoteAddr,
				"path", r.URL.Path,
				"method", r.Method)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// requestSizeLimitMiddleware limits request body size
func (es *EnhancedServer) requestSizeLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			maxBytes := int64(es.config.Security.MaxRequestSizeMB) * 1024 * 1024
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
		}
		next.ServeHTTP(w, r)
	})
}

// Enhanced middleware with metrics
func (es *EnhancedServer) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Create response writer wrapper to capture status code
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(rw, r)

		duration := time.Since(start).Seconds()

		// Log request
		es.logger.Debug("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rw.statusCode,
			"duration", duration)

		// Record metrics
		metrics.RecordAPIRequest(r.Method, r.URL.Path, http.StatusText(rw.statusCode), duration)
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

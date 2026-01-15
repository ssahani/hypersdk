// SPDX-License-Identifier: LGPL-3.0-or-later

package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"

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
}

// EnhancedServer extends the base server with new features
type EnhancedServer struct {
	*Server
	scheduler  *scheduler.Scheduler
	webhookMgr *webhooks.Manager
	store      store.JobStore
	config     *Config
	wsHub      *WSHub
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
func NewEnhancedServer(manager *jobs.Manager, log logger.Logger, addr string, config *Config) (*EnhancedServer, error) {
	// Create base server
	baseServer := NewServer(manager, log, addr)

	es := &EnhancedServer{
		Server: baseServer,
		config: config,
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

	// Initialize WebSocket hub
	es.wsHub = NewWSHub()
	go es.wsHub.Run()
	es.StartStatusBroadcaster()
	log.Info("websocket support enabled")

	// Register enhanced routes
	es.registerEnhancedRoutes()

	return es, nil
}

// registerEnhancedRoutes adds new API endpoints for Phase 1 features
func (es *EnhancedServer) registerEnhancedRoutes() {
	mux := http.NewServeMux()

	// Copy existing routes from base server
	mux.HandleFunc("/health", es.handleHealth)
	mux.HandleFunc("/status", es.handleStatus)
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

	// Update the HTTP server with new mux
	es.httpServer.Handler = es.loggingMiddleware(mux)
}

// Shutdown gracefully shuts down the enhanced server
func (es *EnhancedServer) Shutdown(ctx context.Context) error {
	es.logger.Info("shutting down enhanced API server")

	// Stop scheduler
	if es.scheduler != nil {
		es.scheduler.Stop()
	}

	// Close store
	if es.store != nil {
		if err := es.store.Close(); err != nil {
			es.logger.Error("failed to close job store", "error", err)
		}
	}

	// Shutdown HTTP server
	return es.httpServer.Shutdown(ctx)
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

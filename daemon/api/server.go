// SPDX-License-Identifier: LGPL-3.0-or-later

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"

	"hyper2kvm-providers/daemon/jobs"
	"hyper2kvm-providers/daemon/models"
	"hyper2kvm-providers/logger"
)

// Server handles HTTP API requests
type Server struct {
	manager    *jobs.Manager
	logger     logger.Logger
	httpServer *http.Server
}

// NewServer creates a new API server
func NewServer(manager *jobs.Manager, log logger.Logger, addr string) *Server {
	s := &Server{
		manager: manager,
		logger:  log,
	}

	mux := http.NewServeMux()

	// Register routes
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/status", s.handleStatus)
	mux.HandleFunc("/jobs/submit", s.handleSubmitJob)
	mux.HandleFunc("/jobs/query", s.handleQueryJobs)
	mux.HandleFunc("/jobs/cancel", s.handleCancelJobs)
	mux.HandleFunc("/jobs/", s.handleGetJob) // /jobs/{id}

	s.httpServer = &http.Server{
		Addr:         addr,
		Handler:      s.loggingMiddleware(mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	return s
}

// Start starts the HTTP server
func (s *Server) Start() error {
	s.logger.Info("starting API server", "addr", s.httpServer.Addr)
	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("shutting down API server")
	return s.httpServer.Shutdown(ctx)
}

// Middleware for logging
func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		s.logger.Debug("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"duration", time.Since(start))
	})
}

// Health check endpoint
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.jsonResponse(w, http.StatusOK, map[string]string{
		"status":    "healthy",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// Get daemon status
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	status := s.manager.GetStatus()
	s.jsonResponse(w, http.StatusOK, status)
}

// Submit job(s) from JSON, YAML, or file
func (s *Server) handleSubmitJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	contentType := r.Header.Get("Content-Type")

	var defs []models.JobDefinition
	var err error

	// Parse based on content type
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.errorResponse(w, http.StatusBadRequest, "failed to read request body: %v", err)
		return
	}

	switch contentType {
	case "application/json":
		err = s.parseJSONJobs(body, &defs)
	case "application/x-yaml", "text/yaml":
		err = s.parseYAMLJobs(body, &defs)
	default:
		// Try JSON first, then YAML
		if err = s.parseJSONJobs(body, &defs); err != nil {
			err = s.parseYAMLJobs(body, &defs)
		}
	}

	if err != nil {
		s.errorResponse(w, http.StatusBadRequest, "failed to parse jobs: %v", err)
		return
	}

	// Submit jobs
	ids, errs := s.manager.SubmitBatch(defs)

	// Build response
	resp := models.SubmitResponse{
		JobIDs:    ids,
		Accepted:  len(ids),
		Rejected:  len(errs),
		Timestamp: time.Now(),
	}

	if len(errs) > 0 {
		resp.Errors = make([]string, len(errs))
		for i, err := range errs {
			resp.Errors[i] = err.Error()
		}
	}

	s.jsonResponse(w, http.StatusOK, resp)
}

// Query jobs
func (s *Server) handleQueryJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.QueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.errorResponse(w, http.StatusBadRequest, "invalid request: %v", err)
		return
	}

	var jobList []*models.Job

	if len(req.JobIDs) > 0 {
		// Get specific jobs
		for _, id := range req.JobIDs {
			job, err := s.manager.GetJob(id)
			if err == nil {
				jobList = append(jobList, job)
			}
		}
	} else if req.All {
		// Get all jobs
		jobList = s.manager.GetAllJobs()
	} else {
		// Filter by status
		jobList = s.manager.ListJobs(req.Status, req.Limit)
	}

	resp := models.QueryResponse{
		Jobs:      jobList,
		Total:     len(jobList),
		Timestamp: time.Now(),
	}

	s.jsonResponse(w, http.StatusOK, resp)
}

// Get specific job by ID
func (s *Server) handleGetJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract job ID from path
	jobID := filepath.Base(r.URL.Path)
	if jobID == "jobs" || jobID == "" {
		s.errorResponse(w, http.StatusBadRequest, "job ID required")
		return
	}

	job, err := s.manager.GetJob(jobID)
	if err != nil {
		s.errorResponse(w, http.StatusNotFound, "job not found: %s", jobID)
		return
	}

	s.jsonResponse(w, http.StatusOK, job)
}

// Cancel jobs
func (s *Server) handleCancelJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.CancelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.errorResponse(w, http.StatusBadRequest, "invalid request: %v", err)
		return
	}

	resp := models.CancelResponse{
		Cancelled: []string{},
		Failed:    []string{},
		Errors:    make(map[string]string),
		Timestamp: time.Now(),
	}

	for _, jobID := range req.JobIDs {
		err := s.manager.CancelJob(jobID)
		if err != nil {
			resp.Failed = append(resp.Failed, jobID)
			resp.Errors[jobID] = err.Error()
		} else {
			resp.Cancelled = append(resp.Cancelled, jobID)
		}
	}

	s.jsonResponse(w, http.StatusOK, resp)
}

// Helper: parse JSON jobs
func (s *Server) parseJSONJobs(data []byte, defs *[]models.JobDefinition) error {
	// Try single job first
	var single models.JobDefinition
	if err := json.Unmarshal(data, &single); err == nil && single.VMPath != "" {
		*defs = append(*defs, single)
		return nil
	}

	// Try batch
	var batch models.BatchJobDefinition
	if err := json.Unmarshal(data, &batch); err == nil && len(batch.Jobs) > 0 {
		*defs = batch.Jobs
		return nil
	}

	// Try array
	var array []models.JobDefinition
	if err := json.Unmarshal(data, &array); err == nil && len(array) > 0 {
		*defs = array
		return nil
	}

	return fmt.Errorf("invalid JSON format")
}

// Helper: parse YAML jobs
func (s *Server) parseYAMLJobs(data []byte, defs *[]models.JobDefinition) error {
	// Try single job first
	var single models.JobDefinition
	if err := yaml.Unmarshal(data, &single); err == nil && single.VMPath != "" {
		*defs = append(*defs, single)
		return nil
	}

	// Try batch
	var batch models.BatchJobDefinition
	if err := yaml.Unmarshal(data, &batch); err == nil && len(batch.Jobs) > 0 {
		*defs = batch.Jobs
		return nil
	}

	// Try array
	var array []models.JobDefinition
	if err := yaml.Unmarshal(data, &array); err == nil && len(array) > 0 {
		*defs = array
		return nil
	}

	return fmt.Errorf("invalid YAML format")
}

// Helper: send JSON response
func (s *Server) jsonResponse(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

// Helper: send error response
func (s *Server) errorResponse(w http.ResponseWriter, statusCode int, format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	s.logger.Warn("api error", "status", statusCode, "message", msg)
	s.jsonResponse(w, statusCode, map[string]string{
		"error":     msg,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// SubmitJobFromFile submits jobs from a YAML or JSON file
func SubmitJobFromFile(apiURL, filePath string) error {
	// Determine content type from extension
	contentType := "application/json"
	ext := filepath.Ext(filePath)
	if ext == ".yaml" || ext == ".yml" {
		contentType = "application/x-yaml"
	}

	// Send request
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer file.Close()

	req, err := http.NewRequest("POST", apiURL+"/jobs/submit", file)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", contentType)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("server error: %s", string(body))
	}

	return nil
}

// SPDX-License-Identifier: LGPL-3.0-or-later

package jobs

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"

	"hypervisor-sdk/config"
	"hypervisor-sdk/daemon/models"
	"hypervisor-sdk/logger"
	"hypervisor-sdk/providers/vsphere"
)

// Manager handles job lifecycle and execution
type Manager struct {
	jobs      map[string]*models.Job
	mu        sync.RWMutex
	logger    logger.Logger
	startTime time.Time
	ctx       context.Context
	cancel    context.CancelFunc
}

// NewManager creates a new job manager
func NewManager(log logger.Logger) *Manager {
	ctx, cancel := context.WithCancel(context.Background())
	return &Manager{
		jobs:      make(map[string]*models.Job),
		logger:    log,
		startTime: time.Now(),
		ctx:       ctx,
		cancel:    cancel,
	}
}

// SubmitJob submits a new job for execution
func (m *Manager) SubmitJob(def models.JobDefinition) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Generate ID if not provided
	if def.ID == "" {
		def.ID = uuid.New().String()
	}

	// Check if job already exists
	if _, exists := m.jobs[def.ID]; exists {
		return "", fmt.Errorf("job with ID %s already exists", def.ID)
	}

	// Create job
	now := time.Now()
	def.CreatedAt = now

	job := &models.Job{
		Definition: def,
		Status:     models.JobStatusPending,
		UpdatedAt:  now,
	}

	m.jobs[def.ID] = job
	m.logger.Info("job submitted", "id", def.ID, "name", def.Name, "vm", def.VMPath)

	// Start job in goroutine
	go m.executeJob(def.ID)

	return def.ID, nil
}

// SubmitBatch submits multiple jobs
func (m *Manager) SubmitBatch(defs []models.JobDefinition) ([]string, []error) {
	ids := make([]string, 0, len(defs))
	errs := make([]error, 0)

	for _, def := range defs {
		id, err := m.SubmitJob(def)
		if err != nil {
			errs = append(errs, err)
		} else {
			ids = append(ids, id)
		}
	}

	return ids, errs
}

// GetJob retrieves a job by ID
func (m *Manager) GetJob(id string) (*models.Job, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	job, exists := m.jobs[id]
	if !exists {
		return nil, fmt.Errorf("job not found: %s", id)
	}

	// Return a copy to avoid race conditions
	jobCopy := *job
	return &jobCopy, nil
}

// ListJobs returns jobs matching the criteria
func (m *Manager) ListJobs(statuses []models.JobStatus, limit int) []*models.Job {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*models.Job

	for _, job := range m.jobs {
		// Filter by status if specified
		if len(statuses) > 0 {
			matched := false
			for _, status := range statuses {
				if job.Status == status {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}

		// Copy job to avoid race conditions
		jobCopy := *job
		result = append(result, &jobCopy)

		// Apply limit
		if limit > 0 && len(result) >= limit {
			break
		}
	}

	return result
}

// GetAllJobs returns all jobs
func (m *Manager) GetAllJobs() []*models.Job {
	return m.ListJobs(nil, 0)
}

// CancelJob cancels a running job
func (m *Manager) CancelJob(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	job, exists := m.jobs[id]
	if !exists {
		return fmt.Errorf("job not found: %s", id)
	}

	if job.Status != models.JobStatusRunning && job.Status != models.JobStatusPending {
		return fmt.Errorf("job %s cannot be cancelled (status: %s)", id, job.Status)
	}

	job.Status = models.JobStatusCancelled
	now := time.Now()
	job.CompletedAt = &now
	job.UpdatedAt = now

	m.logger.Info("job cancelled", "id", id)

	return nil
}

// GetStatus returns daemon status
func (m *Manager) GetStatus() *models.DaemonStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var running, completed, failed int
	for _, job := range m.jobs {
		switch job.Status {
		case models.JobStatusRunning:
			running++
		case models.JobStatusCompleted:
			completed++
		case models.JobStatusFailed:
			failed++
		}
	}

	return &models.DaemonStatus{
		Version:       "0.0.1",
		Uptime:        time.Since(m.startTime).String(),
		TotalJobs:     len(m.jobs),
		RunningJobs:   running,
		CompletedJobs: completed,
		FailedJobs:    failed,
		Timestamp:     time.Now(),
	}
}

// Shutdown gracefully shuts down the manager
func (m *Manager) Shutdown() {
	m.logger.Info("shutting down job manager")
	m.cancel()
}

// executeJob runs a job (called in goroutine)
func (m *Manager) executeJob(jobID string) {
	// Get job
	m.mu.Lock()
	job, exists := m.jobs[jobID]
	if !exists {
		m.mu.Unlock()
		return
	}

	// Update status to running
	job.Status = models.JobStatusRunning
	now := time.Now()
	job.StartedAt = &now
	job.UpdatedAt = now
	job.Progress = &models.JobProgress{
		Phase: "connecting",
	}
	m.mu.Unlock()

	m.logger.Info("job started", "id", jobID, "vm", job.Definition.VMPath)

	// Execute the export
	err := m.runExport(jobID, &job.Definition)

	// Update final status
	m.mu.Lock()
	defer m.mu.Unlock()

	endTime := time.Now()
	job.CompletedAt = &endTime
	job.UpdatedAt = endTime

	if err != nil {
		job.Status = models.JobStatusFailed
		job.Error = err.Error()
		m.logger.Error("job failed", "id", jobID, "error", err)
	} else {
		job.Status = models.JobStatusCompleted
		m.logger.Info("job completed", "id", jobID)
	}
}

// runExport performs the actual VM export
func (m *Manager) runExport(jobID string, def *models.JobDefinition) error {
	// Create config from job definition
	cfg := &config.Config{
		VCenterURL:      def.VCenterURL,
		Username:        def.Username,
		Password:        def.Password,
		Insecure:        def.Insecure,
		Timeout:         5 * time.Minute,
		DownloadWorkers: 4,
		RetryAttempts:   3,
		RetryDelay:      5 * time.Second,
		LogLevel:        "info",
	}

	// Use environment defaults if not specified in job
	if cfg.VCenterURL == "" {
		envCfg := config.FromEnvironment()
		cfg.VCenterURL = envCfg.VCenterURL
		cfg.Username = envCfg.Username
		cfg.Password = envCfg.Password
		cfg.Insecure = envCfg.Insecure
	}

	// Update progress: connecting
	m.updateProgress(jobID, &models.JobProgress{
		Phase: "connecting",
	})

	// Create vSphere client
	ctx := m.ctx
	client, err := vsphere.NewVSphereClient(ctx, cfg, m.logger)
	if err != nil {
		return fmt.Errorf("connect to vSphere: %w", err)
	}
	defer client.Close()

	// Update progress: preparing export
	m.updateProgress(jobID, &models.JobProgress{
		Phase: "preparing",
	})

	// Get VM info
	info, err := client.GetVMInfo(ctx, def.VMPath)
	if err != nil {
		return fmt.Errorf("get VM info: %w", err)
	}

	// Update progress: exporting
	m.updateProgress(jobID, &models.JobProgress{
		Phase:       "exporting",
		TotalFiles:  0, // Will be updated during export
		TotalBytes:  0,
	})

	// Perform export
	opts := def.Options.ToVSphereOptions(def.OutputPath)
	result, err := client.ExportOVF(ctx, def.VMPath, opts)
	if err != nil {
		return fmt.Errorf("export OVF: %w", err)
	}

	// Store result
	m.mu.Lock()
	job := m.jobs[jobID]
	job.Result = &models.JobResult{
		VMName:    info.Name,
		OutputDir: result.OutputDir,
		OVFPath:   result.OVFPath,
		Files:     result.Files,
		TotalSize: result.TotalSize,
		Duration:  result.Duration,
		Success:   true,
	}
	m.mu.Unlock()

	return nil
}

// updateProgress updates job progress (thread-safe)
func (m *Manager) updateProgress(jobID string, progress *models.JobProgress) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if job, exists := m.jobs[jobID]; exists {
		job.Progress = progress
		job.UpdatedAt = time.Now()
	}
}

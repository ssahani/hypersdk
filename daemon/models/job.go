// SPDX-License-Identifier: LGPL-3.0-or-later

package models

import (
	"time"

	"hypervisor-sdk/providers/vsphere"
)

// JobStatus represents the current state of a job
type JobStatus string

const (
	JobStatusPending    JobStatus = "pending"
	JobStatusRunning    JobStatus = "running"
	JobStatusCompleted  JobStatus = "completed"
	JobStatusFailed     JobStatus = "failed"
	JobStatusCancelled  JobStatus = "cancelled"
)

// JobDefinition represents a VM export job from YAML/JSON
type JobDefinition struct {
	ID          string         `json:"id" yaml:"id"`
	Name        string         `json:"name" yaml:"name"`
	VMPath      string         `json:"vm_path" yaml:"vm_path"`
	OutputPath  string         `json:"output_path" yaml:"output_path"`
	Options     *ExportOptions `json:"options,omitempty" yaml:"options,omitempty"`
	VCenterURL  string         `json:"vcenter_url,omitempty" yaml:"vcenter_url,omitempty"`
	Username    string         `json:"username,omitempty" yaml:"username,omitempty"`
	Password    string         `json:"password,omitempty" yaml:"password,omitempty"`
	Insecure    bool           `json:"insecure,omitempty" yaml:"insecure,omitempty"`
	Datacenter  string         `json:"datacenter,omitempty" yaml:"datacenter,omitempty"`
	CreatedAt   time.Time      `json:"created_at" yaml:"created_at"`
}

// ExportOptions represents export configuration
type ExportOptions struct {
	ParallelDownloads      int  `json:"parallel_downloads,omitempty" yaml:"parallel_downloads,omitempty"`
	RemoveCDROM            bool `json:"remove_cdrom,omitempty" yaml:"remove_cdrom,omitempty"`
	ShowIndividualProgress bool `json:"show_individual_progress,omitempty" yaml:"show_individual_progress,omitempty"`
}

// Job represents an active or completed export job
type Job struct {
	Definition JobDefinition  `json:"definition"`
	Status     JobStatus      `json:"status"`
	Progress   *JobProgress   `json:"progress,omitempty"`
	Result     *JobResult     `json:"result,omitempty"`
	Error      string         `json:"error,omitempty"`
	StartedAt  *time.Time     `json:"started_at,omitempty"`
	CompletedAt *time.Time    `json:"completed_at,omitempty"`
	UpdatedAt  time.Time      `json:"updated_at"`
}

// JobProgress tracks the progress of an export
type JobProgress struct {
	Phase              string  `json:"phase"`                // "connecting", "discovering", "exporting"
	CurrentFile        string  `json:"current_file,omitempty"`
	FilesDownloaded    int     `json:"files_downloaded"`
	TotalFiles         int     `json:"total_files"`
	BytesDownloaded    int64   `json:"bytes_downloaded"`
	TotalBytes         int64   `json:"total_bytes"`
	PercentComplete    float64 `json:"percent_complete"`
	EstimatedRemaining string  `json:"estimated_remaining,omitempty"`
}

// JobResult represents the result of a completed job
type JobResult struct {
	VMName      string        `json:"vm_name"`
	OutputDir   string        `json:"output_dir"`
	OVFPath     string        `json:"ovf_path"`
	Files       []string      `json:"files"`
	TotalSize   int64         `json:"total_size"`
	Duration    time.Duration `json:"duration"`
	Success     bool          `json:"success"`
}

// ToVSphereOptions converts ExportOptions to vsphere.ExportOptions
func (eo *ExportOptions) ToVSphereOptions(outputPath string) vsphere.ExportOptions {
	opts := vsphere.DefaultExportOptions()
	opts.OutputPath = outputPath

	if eo != nil {
		if eo.ParallelDownloads > 0 {
			opts.ParallelDownloads = eo.ParallelDownloads
		}
		opts.RemoveCDROM = eo.RemoveCDROM
		opts.ShowIndividualProgress = eo.ShowIndividualProgress
	}

	return opts
}

// BatchJobDefinition represents multiple jobs in a single file
type BatchJobDefinition struct {
	Jobs []JobDefinition `json:"jobs" yaml:"jobs"`
}

// QueryRequest represents a query from h2kvmctl
type QueryRequest struct {
	JobIDs     []string   `json:"job_ids,omitempty"`     // Specific job IDs to query
	Status     []JobStatus `json:"status,omitempty"`      // Filter by status
	All        bool        `json:"all"`                   // Return all jobs
	Limit      int         `json:"limit,omitempty"`       // Limit results
}

// QueryResponse represents the response to a query
type QueryResponse struct {
	Jobs      []*Job    `json:"jobs"`
	Total     int       `json:"total"`
	Timestamp time.Time `json:"timestamp"`
}

// SubmitResponse represents the response to job submission
type SubmitResponse struct {
	JobIDs    []string  `json:"job_ids"`
	Accepted  int       `json:"accepted"`
	Rejected  int       `json:"rejected"`
	Errors    []string  `json:"errors,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// CancelRequest represents a request to cancel jobs
type CancelRequest struct {
	JobIDs []string `json:"job_ids"`
}

// CancelResponse represents the response to a cancel request
type CancelResponse struct {
	Cancelled []string  `json:"cancelled"`
	Failed    []string  `json:"failed"`
	Errors    map[string]string `json:"errors,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// DaemonStatus represents the overall status of the daemon
type DaemonStatus struct {
	Version      string    `json:"version"`
	Uptime       string    `json:"uptime"`
	TotalJobs    int       `json:"total_jobs"`
	RunningJobs  int       `json:"running_jobs"`
	CompletedJobs int      `json:"completed_jobs"`
	FailedJobs   int       `json:"failed_jobs"`
	Timestamp    time.Time `json:"timestamp"`
}

// SPDX-License-Identifier: LGPL-3.0-or-later

package vsphere

import (
	"testing"
)

func TestDefaultExportOptions(t *testing.T) {
	opts := DefaultExportOptions()

	if opts.ParallelDownloads != 3 {
		t.Errorf("Expected default ParallelDownloads 3, got %d", opts.ParallelDownloads)
	}

	if !opts.RemoveCDROM {
		t.Error("Expected RemoveCDROM to be true by default")
	}

	if opts.ShowIndividualProgress {
		t.Error("Expected ShowIndividualProgress to be false by default")
	}

	if !opts.ShowOverallProgress {
		t.Error("Expected ShowOverallProgress to be true by default")
	}

	if opts.Format != "ovf" {
		t.Errorf("Expected default format 'ovf', got '%s'", opts.Format)
	}
}

func TestExportOptionsValidation(t *testing.T) {
	tests := []struct {
		name     string
		parallel int
		wantErr  bool
	}{
		{"valid_parallel_4", 4, false},
		{"valid_parallel_8", 8, false},
		{"valid_parallel_16", 16, false},
		{"invalid_parallel_0", 0, true},
		{"invalid_parallel_negative", -1, true},
		{"invalid_parallel_too_high", 32, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts := DefaultExportOptions()
			opts.ParallelDownloads = tt.parallel
			opts.OutputPath = "/tmp/test-output" // Set required field

			err := opts.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestExportOptionsOutputPath(t *testing.T) {
	opts := DefaultExportOptions()
	opts.OutputPath = "/tmp/test-export"

	if opts.OutputPath != "/tmp/test-export" {
		t.Errorf("Expected OutputPath '/tmp/test-export', got '%s'", opts.OutputPath)
	}
}

func TestExportOptionsFlags(t *testing.T) {
	opts := DefaultExportOptions()

	// Test RemoveCDROM flag
	opts.RemoveCDROM = true
	if !opts.RemoveCDROM {
		t.Error("Failed to set RemoveCDROM to true")
	}

	// Test ShowIndividualProgress flag
	opts.ShowIndividualProgress = true
	if !opts.ShowIndividualProgress {
		t.Error("Failed to set ShowIndividualProgress to true")
	}
}

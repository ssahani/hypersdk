// SPDX-License-Identifier: LGPL-3.0-or-later

package vsphere

import "time"

type ExportOptions struct {
	Format                 string // "ovf" or "ova"
	OutputPath             string
	RemoveCDROM            bool
	ShutdownTimeout        time.Duration
	ParallelDownloads      int
	Validate               bool
	ShowIndividualProgress bool
	ShowOverallProgress    bool
}

func DefaultExportOptions() ExportOptions {
	return ExportOptions{
		Format:                 "ovf",
		RemoveCDROM:            true,
		ShutdownTimeout:        5 * time.Minute,
		ParallelDownloads:      3,
		Validate:               true,
		ShowIndividualProgress: false,
		ShowOverallProgress:    true,
	}
}

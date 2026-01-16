// SPDX-License-Identifier: LGPL-3.0-or-later

package vsphere

import "time"

const (
	defaultDirPerm     = 0755
	leaseWaitTimeout   = 5 * time.Minute
	downloadTimeout    = 2 * time.Hour
)

type VMInfo struct {
	Name       string
	Path       string
	PowerState string
	GuestOS    string
	MemoryMB   int32
	NumCPU     int32
	Storage    int64
}

type ExportResult struct {
	OutputDir string
	OVFPath   string
	Files     []string
	TotalSize int64
	Duration  time.Duration
}

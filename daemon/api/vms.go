// SPDX-License-Identifier: LGPL-3.0-or-later

package api

import (
	"context"
	"net/http"
	"time"

	"hyper2kvm-providers/providers/vsphere"
)

// VMListResponse represents the response for VM listing
type VMListResponse struct {
	VMs       []vsphere.VMInfo `json:"vms"`
	Total     int              `json:"total"`
	Timestamp time.Time        `json:"timestamp"`
}

// Handle VM listing
func (s *Server) handleListVMs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get VMs from vSphere
	vms, err := s.listVMsFromVSphere()
	if err != nil {
		s.errorResponse(w, http.StatusInternalServerError, "failed to list VMs: %v", err)
		return
	}

	resp := VMListResponse{
		VMs:       vms,
		Total:     len(vms),
		Timestamp: time.Now(),
	}

	s.jsonResponse(w, http.StatusOK, resp)
}

// List all VMs from vSphere
func (s *Server) listVMsFromVSphere() ([]vsphere.VMInfo, error) {
	ctx := context.Background()

	// Get vSphere client from manager
	client, err := s.manager.GetVSphereClient()
	if err != nil {
		return nil, err
	}
	defer client.Close()

	// List VMs using client
	vms, err := client.ListVMs(ctx)
	if err != nil {
		return nil, err
	}

	return vms, nil
}

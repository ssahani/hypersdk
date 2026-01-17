// SPDX-License-Identifier: LGPL-3.0-or-later

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/pterm/pterm"

	"hypersdk/config"
	"hypersdk/logger"
	"hypersdk/providers/vsphere"
)

// Styles
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#00ffff")).
			Background(lipgloss.Color("#0066cc")).
			Padding(0, 1)

	selectedStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#00ff00"))

	unselectedStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#888888"))

	infoStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#ffaa00")).
			Italic(true)

	helpStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#666666")).
			Italic(true)

	errorStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#ff0000"))

	successStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#00ff00"))
)

type vmItem struct {
	vm       vsphere.VMInfo
	selected bool
}

type model struct {
	vms           []vmItem
	cursor        int
	height        int
	width         int
	daemonURL      string
	outputDir      string
	autoConvert    bool
	autoImport     bool
	phase          string // "select", "confirm", "run-mode", "export", "convert", "done"
	currentExport  int
	message        string
	err            error
	confirmConvert bool
	confirmImport  bool
	runMode        string // "terminal" or "service"
}

type vmsLoadedMsg struct {
	vms []vsphere.VMInfo
	err error
}

type exportDoneMsg struct {
	index int
	err   error
}

func initialModel(daemonURL, outputDir string, autoConvert, autoImport bool) model {
	return model{
		daemonURL:   daemonURL,
		outputDir:   outputDir,
		autoConvert: autoConvert,
		autoImport:  autoImport,
		phase:       "select",
	}
}

func (m model) Init() tea.Cmd {
	return loadVMs(m.daemonURL)
}

func loadVMs(daemonURL string) tea.Cmd {
	return func() tea.Msg {
		// Check if environment variables are set for direct connection
		if os.Getenv("GOVC_URL") != "" {
			return loadVMsFromEnvironment()
		}

		// Fall back to daemon API
		return loadVMsFromDaemon(daemonURL)
	}
}

func loadVMsFromEnvironment() tea.Msg {
	// Load config from environment
	cfg := config.FromEnvironment()

	// Validate required fields
	if cfg.VCenterURL == "" || cfg.Username == "" || cfg.Password == "" {
		return vmsLoadedMsg{err: fmt.Errorf("missing required environment variables: GOVC_URL, GOVC_USERNAME, GOVC_PASSWORD")}
	}

	// Create logger (quiet for TUI)
	log := logger.New("error")

	// Create vSphere client
	ctx := context.Background()
	client, err := vsphere.NewVSphereClient(ctx, cfg, log)
	if err != nil {
		return vmsLoadedMsg{err: fmt.Errorf("connect to vCenter: %w", err)}
	}
	defer client.Close()

	// List VMs
	vms, err := client.ListVMs(ctx)
	if err != nil {
		return vmsLoadedMsg{err: fmt.Errorf("list VMs: %w", err)}
	}

	return vmsLoadedMsg{vms: vms}
}

func loadVMsFromDaemon(daemonURL string) tea.Msg {
	resp, err := apiRequestWithTimeout(daemonURL+"/vms/list", "GET", "", nil, 180*time.Second)
	if err != nil {
		return vmsLoadedMsg{err: err}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		VMs []vsphere.VMInfo `json:"vms"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return vmsLoadedMsg{err: err}
	}

	return vmsLoadedMsg{vms: result.VMs}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.height = msg.Height
		m.width = msg.Width
		return m, nil

	case vmsLoadedMsg:
		if msg.err != nil {
			m.err = msg.err
			m.phase = "error"
			return m, nil
		}

		if len(msg.vms) == 0 {
			m.err = fmt.Errorf("no VMs found - check daemon connection and vCenter credentials")
			m.phase = "error"
			return m, nil
		}

		m.vms = make([]vmItem, len(msg.vms))
		for i, vm := range msg.vms {
			m.vms[i] = vmItem{vm: vm, selected: false}
		}
		return m, nil

	case tea.KeyMsg:
		switch m.phase {
		case "error":
			if msg.String() == "q" || msg.String() == "ctrl+c" {
				return m, tea.Quit
			}
		case "select":
			return m.handleSelectionKeys(msg)
		case "confirm":
			return m.handleConfirmKeys(msg)
		case "run-mode":
			return m.handleRunModeKeys(msg)
		}

	case exportDoneMsg:
		if msg.err != nil {
			m.err = msg.err
			return m, tea.Quit
		}
		m.currentExport++

		// Check if all exports done
		selectedCount := 0
		for _, item := range m.vms {
			if item.selected {
				selectedCount++
			}
		}

		if m.currentExport >= selectedCount {
			if m.autoConvert {
				m.phase = "convert"
				return m, m.convertAll()
			}
			m.phase = "done"
			return m, tea.Quit
		}

		return m, m.exportNext()
	}

	return m, nil
}

func (m model) handleSelectionKeys(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c", "q":
		return m, tea.Quit

	case "up", "k":
		if m.cursor > 0 {
			m.cursor--
		}

	case "down", "j":
		if m.cursor < len(m.vms)-1 {
			m.cursor++
		}

	case " ":
		if m.cursor < len(m.vms) {
			m.vms[m.cursor].selected = !m.vms[m.cursor].selected
		}

	case "a":
		// Select all
		for i := range m.vms {
			m.vms[i].selected = true
		}

	case "n":
		// Deselect all
		for i := range m.vms {
			m.vms[i].selected = false
		}

	case "enter":
		// Go to confirmation
		selectedCount := 0
		for _, item := range m.vms {
			if item.selected {
				selectedCount++
			}
		}

		if selectedCount == 0 {
			m.message = "No VMs selected!"
			return m, nil
		}

		m.phase = "confirm"
		m.message = ""
		return m, nil
	}

	return m, nil
}

func (m model) handleConfirmKeys(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c", "q":
		return m, tea.Quit

	case "escape", "b":
		// Go back to selection
		m.phase = "select"
		return m, nil

	case "y", "Y":
		// Go to run mode selection
		m.phase = "run-mode"
		return m, nil

	case "n", "N":
		// Cancel and go back
		m.phase = "select"
		m.message = "Migration cancelled"
		return m, nil
	}

	return m, nil
}

func (m model) handleRunModeKeys(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c", "q":
		return m, tea.Quit

	case "escape", "b":
		// Go back to confirmation
		m.phase = "confirm"
		return m, nil

	case "1", "t", "T":
		// Run in terminal (interactive)
		m.runMode = "terminal"
		m.phase = "export"
		m.currentExport = 0
		return m, m.exportNext()

	case "2", "s", "S":
		// Run as systemd service (background)
		m.runMode = "service"
		return m, m.createSystemdService()
	}

	return m, nil
}

func (m model) exportNext() tea.Cmd {
	// Find next selected VM
	exportIndex := 0
	for i, item := range m.vms {
		if item.selected {
			if exportIndex == m.currentExport {
				return m.exportVM(i)
			}
			exportIndex++
		}
	}
	return nil
}

func (m model) exportVM(index int) tea.Cmd {
	return func() tea.Msg {
		vm := m.vms[index].vm

		// Create output directory
		vmOutputDir := filepath.Join(m.outputDir, sanitizeFilename(vm.Name))
		os.MkdirAll(vmOutputDir, 0755)

		// Submit export job
		jobRequest := struct {
			Name       string                 `json:"name"`
			VMPath     string                 `json:"vm_path"`
			OutputPath string                 `json:"output_path"`
			Options    map[string]interface{} `json:"options"`
		}{
			Name:       "export-" + vm.Name,
			VMPath:     vm.Path,
			OutputPath: vmOutputDir,
			Options: map[string]interface{}{
				"parallel_downloads":        8,
				"remove_cdrom":              true,
				"show_individual_progress":  false,
			},
		}

		reqBody, _ := json.Marshal(jobRequest)
		resp, err := apiRequest(m.daemonURL+"/jobs/submit", "POST", "application/json", reqBody)
		if err != nil {
			return exportDoneMsg{index: index, err: err}
		}
		defer resp.Body.Close()

		// Wait for job to complete
		// For now, just mark as done
		// TODO: Poll job status

		return exportDoneMsg{index: index, err: nil}
	}
}

func (m model) convertAll() tea.Cmd {
	return func() tea.Msg {
		for i, item := range m.vms {
			if item.selected {
				vmOutputDir := filepath.Join(m.outputDir, sanitizeFilename(item.vm.Name))

				// Find OVF file
				ovfFiles, err := filepath.Glob(filepath.Join(vmOutputDir, "*.ovf"))
				if err != nil || len(ovfFiles) == 0 {
					// No OVF file, skip
					continue
				}

				ovfFile := ovfFiles[0]

				// Call hyper2kvm to do the migration
				// hyper2kvm -input <ovf-file> -output <output-dir>
				cmd := exec.Command("hyper2kvm",
					"-input", ovfFile,
					"-output", vmOutputDir,
					"-format", "qcow2",
				)

				// Set environment for hyper2kvm if needed
				cmd.Env = append(os.Environ())

				// Run hyper2kvm
				output, err := cmd.CombinedOutput()
				if err != nil {
					return exportDoneMsg{
						index: i,
						err: fmt.Errorf("hyper2kvm failed for %s: %v\nOutput: %s", item.vm.Name, err, string(output)),
					}
				}

				// If auto-import is enabled, also import to libvirt
				if m.autoImport {
					// Find the qcow2 file created by hyper2kvm
					qcow2Files, err := filepath.Glob(filepath.Join(vmOutputDir, "*.qcow2"))
					if err == nil && len(qcow2Files) > 0 {
						qcow2File := qcow2Files[0]

						// Import to libvirt using virt-install
						importCmd := exec.Command("virt-install",
							"--name", item.vm.Name,
							"--import",
							"--disk", qcow2File+",bus=virtio",
							"--memory", fmt.Sprintf("%d", item.vm.MemoryMB),
							"--vcpus", fmt.Sprintf("%d", item.vm.NumCPU),
							"--os-variant", "generic",
							"--network", "bridge=virbr0",
							"--graphics", "vnc",
							"--noautoconsole",
						)

						if err := importCmd.Run(); err != nil {
							// Don't fail the whole process if import fails
							// Just log it
							fmt.Fprintf(os.Stderr, "Warning: Failed to import %s to libvirt: %v\n", item.vm.Name, err)
						}
					}
				}
			}
		}
		return exportDoneMsg{index: -1, err: nil}
	}
}

func (m model) View() string {
	switch m.phase {
	case "error":
		return m.renderError()
	case "select":
		return m.renderSelection()
	case "confirm":
		return m.renderConfirm()
	case "run-mode":
		return m.renderRunMode()
	case "export":
		return m.renderExport()
	case "convert":
		return m.renderConvert()
	case "done":
		return m.renderDone()
	}

	// Show loading message based on connection mode
	if os.Getenv("GOVC_URL") != "" {
		return "Loading VMs from vCenter (direct connection)...\n\n" +
			infoStyle.Render(fmt.Sprintf("vCenter: %s", os.Getenv("GOVC_URL")))
	}
	return "Loading VMs from daemon...\n\n" +
		infoStyle.Render(fmt.Sprintf("Daemon: %s", m.daemonURL))
}

func (m model) renderSelection() string {
	var b strings.Builder

	// Title
	b.WriteString(titleStyle.Render("🚀 Interactive VM Migration Tool"))
	b.WriteString("\n\n")

	if len(m.vms) == 0 {
		b.WriteString(infoStyle.Render("Loading VMs..."))
		return b.String()
	}

	// Selected count
	selectedCount := 0
	for _, item := range m.vms {
		if item.selected {
			selectedCount++
		}
	}

	b.WriteString(infoStyle.Render(fmt.Sprintf("📊 Total VMs: %d | ✅ Selected: %d", len(m.vms), selectedCount)))
	b.WriteString("\n\n")

	// VM list (show window of items)
	start := m.cursor - 10
	if start < 0 {
		start = 0
	}
	end := start + 20
	if end > len(m.vms) {
		end = len(m.vms)
	}

	for i := start; i < end; i++ {
		item := m.vms[i]

		// Cursor indicator
		cursor := "  "
		if m.cursor == i {
			cursor = "▶ "
		}

		// Selection checkbox
		checkbox := "[ ]"
		if item.selected {
			checkbox = "[✓]"
		}

		// VM info
		vmInfo := fmt.Sprintf("%-40s | %s | %d CPU | %.1f GB | %s",
			truncate(item.vm.Name, 40),
			colorPowerState(item.vm.PowerState),
			item.vm.NumCPU,
			float64(item.vm.MemoryMB)/1024,
			formatBytes(item.vm.Storage))

		// Style
		style := unselectedStyle
		if item.selected {
			style = selectedStyle
		}

		line := cursor + checkbox + " " + vmInfo
		if m.cursor == i {
			line = style.Bold(true).Render(line)
		} else {
			line = style.Render(line)
		}

		b.WriteString(line)
		b.WriteString("\n")
	}

	// Help
	b.WriteString("\n")
	b.WriteString(helpStyle.Render("↑/k: up | ↓/j: down | Space: select | a: select all | n: deselect all | Enter: export | q: quit"))

	if m.message != "" {
		b.WriteString("\n\n")
		b.WriteString(infoStyle.Render(m.message))
	}

	return b.String()
}

func (m model) renderConfirm() string {
	var b strings.Builder

	// Title
	b.WriteString(titleStyle.Render("📋 Confirm Migration"))
	b.WriteString("\n\n")

	// Show selected VMs with detailed info
	b.WriteString(infoStyle.Render("Selected VMs for migration:"))
	b.WriteString("\n\n")

	var totalCPUs int32
	var totalMemoryMB int32
	var totalStorage int64

	for _, item := range m.vms {
		if item.selected {
			totalCPUs += item.vm.NumCPU
			totalMemoryMB += item.vm.MemoryMB
			totalStorage += item.vm.Storage

			// VM details box
			vmDetails := fmt.Sprintf(
				"📦 %s\n"+
					"   Path: %s\n"+
					"   Power: %s | CPU: %d | Memory: %.1f GB | Storage: %s\n"+
					"   OS: %s",
				item.vm.Name,
				item.vm.Path,
				item.vm.PowerState,
				item.vm.NumCPU,
				float64(item.vm.MemoryMB)/1024,
				formatBytes(item.vm.Storage),
				item.vm.GuestOS,
			)

			b.WriteString(selectedStyle.Render(vmDetails))
			b.WriteString("\n\n")
		}
	}

	// Summary
	b.WriteString(titleStyle.Render("📊 Migration Summary"))
	b.WriteString("\n\n")

	summary := fmt.Sprintf(
		"Total Resources:\n"+
			"  🖥️  Total CPUs: %d\n"+
			"  💾 Total Memory: %.1f GB\n"+
			"  💿 Total Storage: %s\n",
		totalCPUs,
		float64(totalMemoryMB)/1024,
		formatBytes(totalStorage),
	)
	b.WriteString(infoStyle.Render(summary))
	b.WriteString("\n\n")

	// Export settings
	b.WriteString(titleStyle.Render("⚙️  Export Settings"))
	b.WriteString("\n\n")

	settings := fmt.Sprintf(
		"Output Directory: %s\n"+
			"Auto-convert to qcow2: %s (using hyper2kvm)\n"+
			"Auto-import to libvirt: %s\n",
		m.outputDir,
		boolToYesNo(m.autoConvert),
		boolToYesNo(m.autoImport),
	)
	b.WriteString(infoStyle.Render(settings))
	b.WriteString("\n\n")

	if m.autoConvert {
		b.WriteString(helpStyle.Render("Note: hyper2kvm will convert OVF+VMDK to qcow2 format"))
		b.WriteString("\n\n")
	}

	// Confirmation prompt
	b.WriteString(successStyle.Bold(true).Render("🚀 Start migration?"))
	b.WriteString("\n\n")

	b.WriteString(helpStyle.Render("y: Yes, start migration | n: No, go back | Esc/b: Back to selection | q: Quit"))

	return b.String()
}

func (m model) renderRunMode() string {
	var b strings.Builder

	// Title
	b.WriteString(titleStyle.Render("🔧 Choose Execution Mode"))
	b.WriteString("\n\n")

	// Explanation
	b.WriteString(infoStyle.Render("How would you like to run the migration?"))
	b.WriteString("\n\n")

	// Option 1: Terminal
	b.WriteString(titleStyle.Render("1. Run in Terminal (Interactive)"))
	b.WriteString("\n")
	b.WriteString(infoStyle.Render(
		"  ✓ Watch progress in real-time\n"+
			"  ✓ See immediate feedback\n"+
			"  ✓ Requires keeping terminal open\n"+
			"  ⚠  Terminal must stay active during migration",
	))
	b.WriteString("\n\n")

	// Option 2: Service
	b.WriteString(titleStyle.Render("2. Run as Systemd Service (Background)"))
	b.WriteString("\n")
	b.WriteString(infoStyle.Render(
		"  ✓ Runs in background\n"+
			"  ✓ Can close terminal and come back later\n"+
			"  ✓ Survives SSH disconnections\n"+
			"  ✓ Check status with: journalctl -u vm-migration@<job-id>\n"+
			"  ℹ  Perfect for long migrations or remote work",
	))
	b.WriteString("\n\n")

	// Selected count reminder
	selectedCount := 0
	for _, item := range m.vms {
		if item.selected {
			selectedCount++
		}
	}
	b.WriteString(helpStyle.Render(fmt.Sprintf("Migrating %d VMs", selectedCount)))
	b.WriteString("\n\n")

	// Prompt
	b.WriteString(successStyle.Bold(true).Render("Choose execution mode:"))
	b.WriteString("\n\n")

	b.WriteString(helpStyle.Render("1/t: Terminal | 2/s: Systemd Service | Esc/b: Back | q: Quit"))

	return b.String()
}

func (m model) renderExport() string {
	var b strings.Builder

	selectedCount := 0
	for _, item := range m.vms {
		if item.selected {
			selectedCount++
		}
	}

	b.WriteString(titleStyle.Render("📦 Exporting VMs"))
	b.WriteString("\n\n")
	b.WriteString(infoStyle.Render(fmt.Sprintf("Progress: %d / %d", m.currentExport+1, selectedCount)))
	b.WriteString("\n\n")

	// Show selected VMs
	for _, item := range m.vms {
		if item.selected {
			b.WriteString(successStyle.Render("✓ " + item.vm.Name))
			b.WriteString("\n")
		}
	}

	return b.String()
}

func (m model) renderConvert() string {
	var b strings.Builder

	b.WriteString(titleStyle.Render("🔄 Converting VMs with hyper2kvm"))
	b.WriteString("\n\n")

	b.WriteString(infoStyle.Render("Running hyper2kvm for each exported VM..."))
	b.WriteString("\n\n")

	for _, item := range m.vms {
		if item.selected {
			b.WriteString(fmt.Sprintf("⟳ %s - Converting OVF to qcow2...\n", item.vm.Name))
		}
	}

	b.WriteString("\n")
	b.WriteString(helpStyle.Render("This may take several minutes depending on VM size"))

	return b.String()
}

func (m model) renderError() string {
	var b strings.Builder

	b.WriteString(errorStyle.Render("❌ Error"))
	b.WriteString("\n\n")

	if m.err != nil {
		b.WriteString(m.err.Error())
		b.WriteString("\n\n")
	}

	b.WriteString(helpStyle.Render("Troubleshooting:"))
	b.WriteString("\n\n")

	// Check connection mode and provide relevant troubleshooting
	if os.Getenv("GOVC_URL") != "" {
		b.WriteString(infoStyle.Render("  Connection Mode: Direct (using environment variables)"))
		b.WriteString("\n\n")
		b.WriteString("  • Verify environment variables are set:\n")
		b.WriteString(fmt.Sprintf("    GOVC_URL=%s\n", os.Getenv("GOVC_URL")))
		b.WriteString(fmt.Sprintf("    GOVC_USERNAME=%s\n", os.Getenv("GOVC_USERNAME")))
		b.WriteString("    GOVC_PASSWORD=*** (set: ")
		if os.Getenv("GOVC_PASSWORD") != "" {
			b.WriteString("yes)\n")
		} else {
			b.WriteString("no)\n")
		}
		b.WriteString(fmt.Sprintf("    GOVC_INSECURE=%s\n\n", os.Getenv("GOVC_INSECURE")))
		b.WriteString("  • Test vCenter connection manually:\n")
		b.WriteString("    govc about\n\n")
		b.WriteString("  • Check vCenter is accessible:\n")
		b.WriteString(fmt.Sprintf("    ping %s\n\n", os.Getenv("GOVC_URL")))
	} else {
		b.WriteString(infoStyle.Render("  Connection Mode: Daemon API"))
		b.WriteString("\n\n")
		b.WriteString("  • Check that hyper2kvmd daemon is running:\n")
		b.WriteString("    sudo systemctl status hyper2kvmd\n\n")
		b.WriteString("  • Check daemon logs:\n")
		b.WriteString("    sudo journalctl -u hyper2kvmd -f\n\n")
		b.WriteString("  • Verify daemon is accessible:\n")
		b.WriteString(fmt.Sprintf("    curl %s/vms/list\n\n", m.daemonURL))
		b.WriteString("  • Check vCenter credentials in /etc/hyper2kvm/config.yaml\n\n")
		b.WriteString("  • OR use direct connection by setting environment:\n")
		b.WriteString("    export GOVC_URL='https://vcenter/sdk'\n")
		b.WriteString("    export GOVC_USERNAME='user@vsphere.local'\n")
		b.WriteString("    export GOVC_PASSWORD='password'\n")
		b.WriteString("    export GOVC_INSECURE=1\n\n")
	}

	b.WriteString(helpStyle.Render("Press 'q' to quit"))
	b.WriteString("\n")

	return b.String()
}

func (m model) renderDone() string {
	var b strings.Builder

	if m.runMode == "service" {
		// Show service information
		b.WriteString(successStyle.Render("✅ Migration Service Started!"))
		b.WriteString("\n\n")

		if m.message != "" {
			b.WriteString(infoStyle.Render(m.message))
			b.WriteString("\n\n")
		}

		b.WriteString(helpStyle.Render("The migration is running in the background.\nYou can safely close this terminal and check back later."))
		b.WriteString("\n")

		return b.String()
	}

	// Terminal mode - show completion
	b.WriteString(successStyle.Render("✅ Migration Complete!"))
	b.WriteString("\n\n")

	for _, item := range m.vms {
		if item.selected {
			vmOutputDir := filepath.Join(m.outputDir, sanitizeFilename(item.vm.Name))
			b.WriteString(fmt.Sprintf("📁 %s → %s\n", item.vm.Name, vmOutputDir))
		}
	}

	if m.message != "" {
		b.WriteString("\n\n")
		b.WriteString(infoStyle.Render(m.message))
	}

	return b.String()
}

func colorPowerState(state string) string {
	if state == "poweredOn" {
		return lipgloss.NewStyle().Foreground(lipgloss.Color("#00ff00")).Render("ON ")
	}
	return lipgloss.NewStyle().Foreground(lipgloss.Color("#888888")).Render("OFF")
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func sanitizeFilename(name string) string {
	// Replace invalid characters
	name = strings.ReplaceAll(name, "/", "-")
	name = strings.ReplaceAll(name, "\\", "-")
	name = strings.ReplaceAll(name, " ", "-")
	return name
}

func boolToYesNo(b bool) string {
	if b {
		return successStyle.Render("Yes ✓")
	}
	return lipgloss.NewStyle().Foreground(lipgloss.Color("#888888")).Render("No")
}

func (m model) createSystemdService() tea.Cmd {
	return func() tea.Msg {
		// Generate unique job ID
		jobID := fmt.Sprintf("vm-migration-%d", os.Getpid())

		// Create a script file that will be executed by systemd
		scriptPath := fmt.Sprintf("/tmp/%s.sh", jobID)
		scriptContent := "#!/bin/bash\n\n"
		scriptContent += fmt.Sprintf("# VM Migration Script\n")
		scriptContent += fmt.Sprintf("# Generated by hyperctl\n\n")

		// Add export and conversion commands for each selected VM
		for _, item := range m.vms {
			if item.selected {
				vmName := sanitizeFilename(item.vm.Name)
				vmOutputDir := filepath.Join(m.outputDir, vmName)

				// Create output directory
				scriptContent += fmt.Sprintf("mkdir -p '%s'\n\n", vmOutputDir)

				// Export VM
				scriptContent += fmt.Sprintf("echo 'Exporting %s...'\n", item.vm.Name)
				scriptContent += fmt.Sprintf("# Submit export job via hyperctl\n")
				scriptContent += fmt.Sprintf("hyperctl submit -vm '%s' -output '%s'\n\n", item.vm.Path, vmOutputDir)

				// Wait for export to complete (poll job status)
				scriptContent += fmt.Sprintf("# Wait for export to complete\n")
				scriptContent += "sleep 10\n\n"

				if m.autoConvert {
					// Convert with hyper2kvm
					scriptContent += fmt.Sprintf("echo 'Converting %s with hyper2kvm...'\n", item.vm.Name)
					scriptContent += fmt.Sprintf("OVF_FILE=$(ls '%s'/*.ovf | head -1)\n", vmOutputDir)
					scriptContent += fmt.Sprintf("if [ -f \"$OVF_FILE\" ]; then\n")
					scriptContent += fmt.Sprintf("  hyper2kvm -input \"$OVF_FILE\" -output '%s' -format qcow2\n", vmOutputDir)
					scriptContent += "fi\n\n"
				}

				if m.autoImport {
					// Import to libvirt
					scriptContent += fmt.Sprintf("echo 'Importing %s to libvirt...'\n", item.vm.Name)
					scriptContent += fmt.Sprintf("QCOW2_FILE=$(ls '%s'/*.qcow2 | head -1)\n", vmOutputDir)
					scriptContent += fmt.Sprintf("if [ -f \"$QCOW2_FILE\" ]; then\n")
					scriptContent += fmt.Sprintf("  virt-install --name '%s' --import --disk \"$QCOW2_FILE\",bus=virtio \\\n", item.vm.Name)
					scriptContent += fmt.Sprintf("    --memory %d --vcpus %d --os-variant generic \\\n", item.vm.MemoryMB, item.vm.NumCPU)
					scriptContent += "    --network bridge=virbr0 --graphics vnc --noautoconsole\n"
					scriptContent += "fi\n\n"
				}
			}
		}

		scriptContent += "echo 'Migration complete!'\n"

		// Write script file
		if err := os.WriteFile(scriptPath, []byte(scriptContent), 0755); err != nil {
			return exportDoneMsg{index: -1, err: fmt.Errorf("failed to create script: %v", err)}
		}

		// Create systemd transient service
		cmd := exec.Command("systemd-run",
			"--user",
			"--unit", jobID,
			"--description", fmt.Sprintf("VM Migration: %d VMs", len(m.vms)),
			"--working-directory", m.outputDir,
			scriptPath,
		)

		output, err := cmd.CombinedOutput()
		if err != nil {
			// Try without --user flag (requires sudo)
			cmd = exec.Command("sudo", "systemd-run",
				"--unit", jobID,
				"--description", fmt.Sprintf("VM Migration: %d VMs", len(m.vms)),
				"--working-directory", m.outputDir,
				scriptPath,
			)

			output, err = cmd.CombinedOutput()
			if err != nil {
				return exportDoneMsg{index: -1, err: fmt.Errorf("failed to create systemd service: %v\nOutput: %s", err, string(output))}
			}
		}

		// Service created successfully
		m.message = fmt.Sprintf("✅ Migration started as systemd service: %s\n\nCheck status with:\n  journalctl -u %s -f\n\nScript: %s", jobID, jobID, scriptPath)
		m.phase = "done"

		return exportDoneMsg{index: -1, err: nil}
	}
}

func runInteractive(daemonURL, outputDir string, autoConvert, autoImport bool) {
	// Show banner first
	showBanner()
	pterm.Println()
	pterm.Info.Println("🎮 Entering interactive mode...")
	pterm.Println()

	// Check if we have a TTY
	if !isatty() {
		pterm.Error.Println("❌ Interactive mode requires a terminal (TTY)")
		pterm.Info.Println("")
		pterm.Info.Println("Please run this command inside tmux or a real terminal:")
		pterm.Info.Println("")
		pterm.Info.Println("  Method 1: Start tmux first")
		pterm.Info.Println("    tmux")
		pterm.Info.Println("    hyperctl migrate")
		pterm.Info.Println("")
		pterm.Info.Println("  Method 2: Use the helper script")
		pterm.Info.Println("    /tmp/start-migration-tui.sh")
		pterm.Info.Println("")
		os.Exit(1)
	}

	// Run bubbletea program
	p := tea.NewProgram(
		initialModel(daemonURL, outputDir, autoConvert, autoImport),
		tea.WithAltScreen(),
	)

	finalModel, err := p.Run()
	if err != nil {
		pterm.Error.Printfln("Error running interactive mode: %v", err)
		os.Exit(1)
	}

	// Check if there was an error in the final model
	if m, ok := finalModel.(model); ok && m.err != nil {
		pterm.Println()
		pterm.Error.Printfln("Migration error: %v", m.err)
		os.Exit(1)
	}

	pterm.Println()
	pterm.Success.Println("✅ Interactive migration complete!")
}

func isatty() bool {
	fileInfo, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return (fileInfo.Mode() & os.ModeCharDevice) != 0
}

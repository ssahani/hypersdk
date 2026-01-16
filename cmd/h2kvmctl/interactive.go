// SPDX-License-Identifier: LGPL-3.0-or-later

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/pterm/pterm"

	"hyper2kvm-providers/providers/vsphere"
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
	daemonURL     string
	outputDir     string
	autoConvert   bool
	autoImport    bool
	phase         string // "select", "confirm", "export", "convert", "done"
	currentExport int
	message       string
	err           error
	confirmConvert bool
	confirmImport  bool
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
		resp, err := apiRequestWithTimeout(daemonURL+"/vms/list", "GET", "", nil, 120000)
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
			return m, tea.Quit
		}

		m.vms = make([]vmItem, len(msg.vms))
		for i, vm := range msg.vms {
			m.vms[i] = vmItem{vm: vm, selected: false}
		}
		return m, nil

	case tea.KeyMsg:
		switch m.phase {
		case "select":
			return m.handleSelectionKeys(msg)
		case "confirm":
			return m.handleConfirmKeys(msg)
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
		// Start export
		m.phase = "export"
		m.currentExport = 0
		return m, m.exportNext()

	case "n", "N":
		// Cancel and go back
		m.phase = "select"
		m.message = "Export cancelled"
		return m, nil
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

				// Find VMDK files
				vmdkFiles, err := filepath.Glob(filepath.Join(vmOutputDir, "*.vmdk"))
				if err != nil || len(vmdkFiles) == 0 {
					continue
				}

				// Convert first VMDK to qcow2
				vmdkFile := vmdkFiles[0]
				qcow2File := strings.TrimSuffix(vmdkFile, ".vmdk") + ".qcow2"

				cmd := exec.Command("qemu-img", "convert", "-f", "vmdk", "-O", "qcow2", vmdkFile, qcow2File)
				if err := cmd.Run(); err != nil {
					return exportDoneMsg{index: i, err: err}
				}
			}
		}
		return exportDoneMsg{index: -1, err: nil}
	}
}

func (m model) View() string {
	if m.err != nil {
		return errorStyle.Render(fmt.Sprintf("Error: %v\n", m.err))
	}

	switch m.phase {
	case "select":
		return m.renderSelection()
	case "confirm":
		return m.renderConfirm()
	case "export":
		return m.renderExport()
	case "convert":
		return m.renderConvert()
	case "done":
		return m.renderDone()
	}

	return "Loading..."
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
			"Auto-convert to qcow2: %s\n"+
			"Auto-import to libvirt: %s\n",
		m.outputDir,
		boolToYesNo(m.autoConvert),
		boolToYesNo(m.autoImport),
	)
	b.WriteString(infoStyle.Render(settings))
	b.WriteString("\n\n")

	// Confirmation prompt
	b.WriteString(successStyle.Bold(true).Render("🚀 Start migration?"))
	b.WriteString("\n\n")

	b.WriteString(helpStyle.Render("y: Yes, start migration | n: No, go back | Esc/b: Back to selection | q: Quit"))

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
	return successStyle.Render("🔄 Converting VMDKs to qcow2...")
}

func (m model) renderDone() string {
	var b strings.Builder

	b.WriteString(successStyle.Render("✅ Migration Complete!"))
	b.WriteString("\n\n")

	for _, item := range m.vms {
		if item.selected {
			vmOutputDir := filepath.Join(m.outputDir, sanitizeFilename(item.vm.Name))
			b.WriteString(fmt.Sprintf("📁 %s → %s\n", item.vm.Name, vmOutputDir))
		}
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

func runInteractive(daemonURL, outputDir string, autoConvert, autoImport bool) {
	// Show banner first
	showBanner()
	pterm.Println()
	pterm.Info.Println("🎮 Entering interactive mode...")
	pterm.Println()

	// Run bubbletea program
	p := tea.NewProgram(
		initialModel(daemonURL, outputDir, autoConvert, autoImport),
		tea.WithAltScreen(),
	)

	if _, err := p.Run(); err != nil {
		pterm.Error.Printfln("Error running interactive mode: %v", err)
		os.Exit(1)
	}

	pterm.Println()
	pterm.Success.Println("✅ Interactive migration complete!")
}

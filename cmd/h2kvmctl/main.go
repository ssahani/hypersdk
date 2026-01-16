// SPDX-License-Identifier: LGPL-3.0-or-later

package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/pterm/pterm"
	"gopkg.in/yaml.v3"

	"hyper2kvm-providers/daemon/models"
	"hyper2kvm-providers/providers/vsphere"
)

const (
	defaultDaemonURL = "http://localhost:8080"
	version          = "0.0.1"
)

var (
	funFacts = []string{
		"💡 Did you know? h2kvmctl uses VDDK for lightning-fast disk transfers!",
		"🚀 Pro tip: Use -json flag for automation and scripting",
		"⚡ Speed boost: Increase parallel_downloads for faster exports",
		"🎯 Fun fact: KVM can run VMs faster than VMware in many cases",
		"💾 Remember: Always remove CD/DVD before migration for smooth imports",
		"🔥 Parallel downloads can make exports 10x faster!",
		"🌟 h2kvmctl is built with love using Go and pterm",
		"🎨 Enjoying the colors? We use pterm for beautiful terminal output!",
		"📊 Monitor jobs in real-time with: h2kvmctl query -status running",
		"🐧 Linux rocks! Especially with KVM virtualization",
	}

	motivationalMessages = []string{
		"🎉 Great job! Your migration skills are impressive!",
		"✨ Awesome! You're becoming a migration expert!",
		"🚀 Fantastic! One step closer to cloud-native infrastructure!",
		"💪 Nice work! Keep those VMs moving!",
		"🌟 Excellent! Your infrastructure is evolving!",
		"🎯 Perfect! Migration mastery unlocked!",
		"⚡ Amazing! Speed and efficiency combined!",
		"🔥 On fire! Your migration game is strong!",
	}
)

func showBanner() {
	banner := pterm.DefaultBigText.WithLetters(
		pterm.NewLettersFromStringWithStyle("h2kvm", pterm.NewStyle(pterm.FgCyan)),
		pterm.NewLettersFromStringWithStyle("ctl", pterm.NewStyle(pterm.FgLightMagenta)),
	)
	banner.Render()

	pterm.DefaultCenter.WithCenterEachLineSeparately().Println(
		pterm.LightCyan("Multi-Cloud to KVM Migration Tool\n") +
		pterm.Gray("Version " + version),
	)
}

func showRandomFact() {
	rand.Seed(time.Now().UnixNano())
	fact := funFacts[rand.Intn(len(funFacts))]
	pterm.Println()
	pterm.FgLightCyan.Println(fact)
}

func showMotivation() {
	rand.Seed(time.Now().UnixNano())
	msg := motivationalMessages[rand.Intn(len(motivationalMessages))]
	pterm.Println()
	pterm.FgLightGreen.Println(msg)
}

func showSuccessArt() {
	pterm.Println()
	pterm.DefaultCenter.Println(pterm.LightGreen("✨ ⭐ 🎉 SUCCESS! 🎉 ⭐ ✨"))
	pterm.Println()
}

func main() {
	// Global flags
	daemonURL := flag.String("daemon", defaultDaemonURL, "Daemon URL")
	versionFlag := flag.Bool("version", false, "Show version")

	// Define subcommands
	submitCmd := flag.NewFlagSet("submit", flag.ExitOnError)
	submitFile := submitCmd.String("file", "", "Job file (JSON/YAML)")
	submitVM := submitCmd.String("vm", "", "VM path")
	submitOutput := submitCmd.String("output", "", "Output directory")

	queryCmd := flag.NewFlagSet("query", flag.ExitOnError)
	queryAll := queryCmd.Bool("all", false, "Query all jobs")
	queryID := queryCmd.String("id", "", "Query specific job ID")
	queryStatus := queryCmd.String("status", "", "Filter by status (running,completed,failed)")

	listCmd := flag.NewFlagSet("list", flag.ExitOnError)
	listJSON := listCmd.Bool("json", false, "Output in JSON format")
	listFilter := listCmd.String("filter", "", "Filter VMs by name (case-insensitive)")

	vmCmd := flag.NewFlagSet("vm", flag.ExitOnError)
	vmOperation := vmCmd.String("op", "", "Operation: shutdown, poweroff, remove-cdrom, info")
	vmPath := vmCmd.String("path", "", "VM path (e.g. /data/vm/my-vm)")
	vmTimeout := vmCmd.Int("timeout", 300, "Timeout in seconds (for shutdown)")

	statusCmd := flag.NewFlagSet("status", flag.ExitOnError)

	cancelCmd := flag.NewFlagSet("cancel", flag.ExitOnError)
	cancelID := cancelCmd.String("id", "", "Job ID to cancel (comma-separated for multiple)")

	migrateCmd := flag.NewFlagSet("migrate", flag.ExitOnError)
	migrateOutput := migrateCmd.String("output", "/tmp/vm-migrations", "Output directory for exports")
	migrateConvert := migrateCmd.Bool("convert", true, "Auto-convert VMDK to qcow2")
	migrateImport := migrateCmd.Bool("import", false, "Auto-import to libvirt")

	// Parse global flags
	flag.Parse()

	if *versionFlag {
		fmt.Printf("h2kvmctl version %s\n", version)
		os.Exit(0)
	}

	if len(os.Args) < 2 {
		showUsage()
		os.Exit(1)
	}

	// Route to subcommands
	switch os.Args[1] {
	case "submit":
		submitCmd.Parse(os.Args[2:])
		handleSubmit(*daemonURL, *submitFile, *submitVM, *submitOutput)

	case "query":
		queryCmd.Parse(os.Args[2:])
		handleQuery(*daemonURL, *queryAll, *queryID, *queryStatus)

	case "list":
		listCmd.Parse(os.Args[2:])
		handleList(*daemonURL, *listJSON, *listFilter)

	case "vm":
		vmCmd.Parse(os.Args[2:])
		handleVM(*daemonURL, *vmOperation, *vmPath, *vmTimeout)

	case "status":
		statusCmd.Parse(os.Args[2:])
		handleStatus(*daemonURL)

	case "cancel":
		cancelCmd.Parse(os.Args[2:])
		handleCancel(*daemonURL, *cancelID)

	case "migrate", "interactive":
		migrateCmd.Parse(os.Args[2:])
		runInteractive(*daemonURL, *migrateOutput, *migrateConvert, *migrateImport)

	case "help", "-h", "--help":
		showUsage()

	default:
		pterm.Error.Printfln("Unknown command: %s", os.Args[1])
		showUsage()
		os.Exit(1)
	}
}

func showUsage() {
	// Show banner
	showBanner()

	pterm.Println()
	pterm.Info.Println("🚀 A powerful CLI for multi-cloud to KVM migration")
	pterm.Println()

	// VM Discovery Commands
	pterm.DefaultSection.Println("📋 VM Discovery")
	discoveryCommands := [][]string{
		{"Command", "Description", "Example"},
		{"list", "List VMs from vCenter", "h2kvmctl list"},
		{"list -json", "List VMs (JSON output)", "h2kvmctl list -json"},
		{"list -filter", "Filter VMs by name", "h2kvmctl list -filter rhel"},
	}
	pterm.DefaultTable.
		WithHasHeader().
		WithHeaderRowSeparator("-").
		WithBoxed().
		WithData(discoveryCommands).
		Render()

	pterm.Println()

	// VM Operations Commands
	pterm.DefaultSection.Println("🔧 VM Operations")
	vmCommands := [][]string{
		{"Command", "Description", "Example"},
		{"vm -op shutdown", "Graceful VM shutdown", "h2kvmctl vm -op shutdown -path /data/vm/my-vm"},
		{"vm -op poweroff", "Force power off VM", "h2kvmctl vm -op poweroff -path /data/vm/my-vm"},
		{"vm -op remove-cdrom", "Remove CD/DVD devices", "h2kvmctl vm -op remove-cdrom -path /data/vm/my-vm"},
		{"vm -op info", "Get VM details", "h2kvmctl vm -op info -path /data/vm/my-vm"},
	}
	pterm.DefaultTable.
		WithHasHeader().
		WithHeaderRowSeparator("-").
		WithBoxed().
		WithData(vmCommands).
		Render()

	pterm.Println()

	// Interactive Migration
	pterm.DefaultSection.Println("🎮 Interactive Migration")
	migrateCommands := [][]string{
		{"Command", "Description", "Example"},
		{"migrate", "Interactive VM selection & migration", "h2kvmctl migrate"},
		{"migrate -output", "Set output directory", "h2kvmctl migrate -output /migrations"},
		{"migrate -convert=false", "Skip auto-conversion to qcow2", "h2kvmctl migrate -convert=false"},
	}
	pterm.DefaultTable.
		WithHasHeader().
		WithHeaderRowSeparator("-").
		WithBoxed().
		WithData(migrateCommands).
		Render()

	pterm.Println()

	// Job Management Commands
	pterm.DefaultSection.Println("📦 Job Management")
	jobCommands := [][]string{
		{"Command", "Description", "Example"},
		{"submit", "Submit export job", "h2kvmctl submit -vm /data/vm/my-vm -output /tmp"},
		{"submit -file", "Submit from YAML/JSON", "h2kvmctl submit -file jobs.yaml"},
		{"query", "Query job status", "h2kvmctl query -all"},
		{"status", "Show daemon status", "h2kvmctl status"},
		{"cancel", "Cancel running jobs", "h2kvmctl cancel -id abc123"},
	}
	pterm.DefaultTable.
		WithHasHeader().
		WithHeaderRowSeparator("-").
		WithBoxed().
		WithData(jobCommands).
		Render()

	pterm.Println()
	pterm.Info.Println("Examples:")
	pterm.Println("  # Interactive Migration")
	pterm.Println("  h2kvmctl migrate                                  # Launch interactive mode")
	pterm.Println("  h2kvmctl migrate -output /migrations              # Custom output directory")
	pterm.Println()
	pterm.Println("  # VM Discovery")
	pterm.Println("  h2kvmctl list                                     # List all VMs")
	pterm.Println("  h2kvmctl list -json                               # List VMs in JSON format")
	pterm.Println("  h2kvmctl list -filter rhel                        # Filter VMs by name")
	pterm.Println()
	pterm.Println("  # VM Operations")
	pterm.Println("  h2kvmctl vm -op shutdown -path /data/vm/my-vm     # Graceful shutdown")
	pterm.Println("  h2kvmctl vm -op poweroff -path /data/vm/my-vm     # Force power off")
	pterm.Println("  h2kvmctl vm -op remove-cdrom -path /data/vm/my-vm # Remove CD/DVD")
	pterm.Println("  h2kvmctl vm -op info -path /data/vm/my-vm         # Get VM info")
	pterm.Println()
	pterm.Println("  # Job Management")
	pterm.Println("  h2kvmctl submit -file jobs.yaml")
	pterm.Println("  h2kvmctl submit -vm /DC/vm/test-vm -output /tmp/export")
	pterm.Println("  h2kvmctl query -all")
	pterm.Println("  h2kvmctl query -id abc123")
	pterm.Println("  h2kvmctl query -status running")
	pterm.Println("  h2kvmctl status")
	pterm.Println("  h2kvmctl cancel -id abc123,def456")
}

func handleSubmit(daemonURL, filePath, vmPath, outputPath string) {
	spinner, _ := pterm.DefaultSpinner.Start("Submitting job(s)...")

	var data []byte
	var contentType string
	var err error

	if filePath != "" {
		// Submit from file
		data, err = os.ReadFile(filePath)
		if err != nil {
			spinner.Fail(fmt.Sprintf("Failed to read file: %v", err))
			os.Exit(1)
		}

		ext := filepath.Ext(filePath)
		if ext == ".yaml" || ext == ".yml" {
			contentType = "application/x-yaml"
		} else {
			contentType = "application/json"
		}
	} else if vmPath != "" {
		// Create job from command line args
		if outputPath == "" {
			outputPath = fmt.Sprintf("./export-%s", filepath.Base(vmPath))
		}

		job := models.JobDefinition{
			Name:       filepath.Base(vmPath),
			VMPath:     vmPath,
			OutputPath: outputPath,
		}

		data, err = json.Marshal(job)
		if err != nil {
			spinner.Fail(fmt.Sprintf("Failed to create job: %v", err))
			os.Exit(1)
		}
		contentType = "application/json"
	} else {
		spinner.Fail("Either -file or -vm must be specified")
		os.Exit(1)
	}

	// Send request
	resp, err := apiRequest(daemonURL+"/jobs/submit", "POST", contentType, data)
	if err != nil {
		spinner.Fail(fmt.Sprintf("Failed to submit job: %v", err))
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		spinner.Fail(fmt.Sprintf("Server error: %s", string(body)))
		os.Exit(1)
	}

	var submitResp models.SubmitResponse
	if err := json.NewDecoder(resp.Body).Decode(&submitResp); err != nil {
		spinner.Fail(fmt.Sprintf("Failed to parse response: %v", err))
		os.Exit(1)
	}

	spinner.Success(fmt.Sprintf("Submitted %d job(s)", submitResp.Accepted))

	// Display results
	if submitResp.Accepted > 0 {
		pterm.Success.Printfln("Accepted Jobs: %d", submitResp.Accepted)
		for _, id := range submitResp.JobIDs {
			pterm.Info.Printfln("  - Job ID: %s", id)
		}
	}

	if submitResp.Rejected > 0 {
		pterm.Warning.Printfln("Rejected Jobs: %d", submitResp.Rejected)
		for _, errMsg := range submitResp.Errors {
			pterm.Error.Printfln("  - %s", errMsg)
		}
	}
}

func handleQuery(daemonURL string, all bool, jobID, statusFilter string) {
	spinner, _ := pterm.DefaultSpinner.Start("Querying jobs...")

	req := models.QueryRequest{
		All: all,
	}

	if jobID != "" {
		req.JobIDs = strings.Split(jobID, ",")
	}

	if statusFilter != "" {
		statuses := strings.Split(statusFilter, ",")
		req.Status = make([]models.JobStatus, len(statuses))
		for i, s := range statuses {
			req.Status[i] = models.JobStatus(strings.TrimSpace(s))
		}
	}

	data, _ := json.Marshal(req)
	resp, err := apiRequest(daemonURL+"/jobs/query", "POST", "application/json", data)
	if err != nil {
		spinner.Fail(fmt.Sprintf("Failed to query: %v", err))
		os.Exit(1)
	}
	defer resp.Body.Close()

	var queryResp models.QueryResponse
	if err := json.NewDecoder(resp.Body).Decode(&queryResp); err != nil {
		spinner.Fail(fmt.Sprintf("Failed to parse response: %v", err))
		os.Exit(1)
	}

	spinner.Success(fmt.Sprintf("Found %d job(s)", queryResp.Total))

	if queryResp.Total == 0 {
		pterm.Info.Println("No jobs found")
		return
	}

	// Display jobs in table
	displayJobs(queryResp.Jobs)
}

func handleList(daemonURL string, jsonOutput bool, filter string) {
	// Only show spinner if not in JSON mode
	var spinner *pterm.SpinnerPrinter
	if !jsonOutput {
		spinner, _ = pterm.DefaultSpinner.Start("🔍 Discovering VMs from vCenter...")
	}

	// Use longer timeout for VM listing (can take time with many VMs)
	resp, err := apiRequestWithTimeout(daemonURL+"/vms/list", "GET", "", nil, 120*time.Second)
	if err != nil {
		if spinner != nil {
			spinner.Fail(fmt.Sprintf("Failed to list VMs: %v", err))
		} else {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		}
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if spinner != nil {
			spinner.Fail(fmt.Sprintf("Server error: %s", string(body)))
		} else {
			fmt.Fprintf(os.Stderr, "Error: %s\n", string(body))
		}
		os.Exit(1)
	}

	// Parse response
	var vmResp struct {
		VMs       []vsphere.VMInfo `json:"vms"`
		Total     int              `json:"total"`
		Timestamp time.Time        `json:"timestamp"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&vmResp); err != nil {
		if spinner != nil {
			spinner.Fail(fmt.Sprintf("Failed to parse response: %v", err))
		} else {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		}
		os.Exit(1)
	}

	// Apply filter if specified
	vms := vmResp.VMs
	if filter != "" {
		var filtered []vsphere.VMInfo
		lowerFilter := strings.ToLower(filter)
		for _, vm := range vms {
			if strings.Contains(strings.ToLower(vm.Name), lowerFilter) ||
				strings.Contains(strings.ToLower(vm.Path), lowerFilter) {
				filtered = append(filtered, vm)
			}
		}
		vms = filtered
	}

	if spinner != nil {
		spinner.Success(fmt.Sprintf("✅ Found %d VMs", len(vms)))
	}

	if len(vms) == 0 {
		pterm.Info.Println("No VMs found")
		return
	}

	// Output format
	if jsonOutput {
		// JSON output
		output, _ := json.MarshalIndent(map[string]interface{}{
			"vms":       vms,
			"total":     len(vms),
			"timestamp": time.Now(),
		}, "", "  ")
		fmt.Println(string(output))
	} else {
		// Display in nice table format
		displayVMs(vms)
	}
}

func displayVMs(vms []vsphere.VMInfo) {
	// Calculate statistics
	var poweredOn, poweredOff, totalMemory, totalCPUs int
	var totalStorage int64

	for _, vm := range vms {
		if strings.Contains(strings.ToLower(vm.PowerState), "on") {
			poweredOn++
		} else {
			poweredOff++
		}
		totalMemory += int(vm.MemoryMB)
		totalCPUs += int(vm.NumCPU)
		totalStorage += vm.Storage
	}

	// Show summary
	pterm.DefaultSection.Println("📊 VM Summary")
	summaryData := [][]string{
		{"🖥️  Total VMs", fmt.Sprintf("%d", len(vms))},
		{"✅ Powered On", pterm.Green(fmt.Sprintf("%d", poweredOn))},
		{"⭕ Powered Off", pterm.Gray(fmt.Sprintf("%d", poweredOff))},
		{"💾 Total Memory", fmt.Sprintf("%.1f GB", float64(totalMemory)/1024)},
		{"⚡ Total CPUs", fmt.Sprintf("%d", totalCPUs)},
		{"💿 Total Storage", formatBytes(totalStorage)},
	}

	pterm.DefaultTable.
		WithBoxed().
		WithData(summaryData).
		Render()

	pterm.Println()

	// Show VMs table
	pterm.DefaultSection.Println("💻 Virtual Machines")

	data := [][]string{
		{"#", "Name", "Power", "CPU", "Memory", "Storage", "Guest OS"},
	}

	for i, vm := range vms {
		// Truncate name if too long
		name := vm.Name
		if len(name) > 35 {
			name = name[:32] + "..."
		}

		// Color code power state
		power := vm.PowerState
		if strings.Contains(strings.ToLower(power), "on") {
			power = pterm.Green(power)
		} else {
			power = pterm.Gray(power)
		}

		// Truncate guest OS
		guestOS := vm.GuestOS
		if len(guestOS) > 30 {
			guestOS = guestOS[:27] + "..."
		}

		data = append(data, []string{
			fmt.Sprintf("%d", i+1),
			name,
			power,
			fmt.Sprintf("%d", vm.NumCPU),
			fmt.Sprintf("%.1f GB", float64(vm.MemoryMB)/1024),
			formatBytes(vm.Storage),
			guestOS,
		})
	}

	pterm.DefaultTable.
		WithHasHeader().
		WithHeaderRowSeparator("-").
		WithBoxed().
		WithData(data).
		Render()

	pterm.Println()
	pterm.Info.Printfln("💡 Tip: Use 'h2kvmctl list -json' for machine-readable output")
	pterm.Info.Printfln("💡 Tip: Use 'h2kvmctl list -filter <name>' to filter VMs")

	// Show random fun fact
	showRandomFact()
}

func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

func handleVM(daemonURL, operation, vmPath string, timeout int) {
	if operation == "" {
		pterm.Error.Println("Operation required (-op)")
		pterm.Info.Println("Available operations: shutdown, poweroff, remove-cdrom, info")
		os.Exit(1)
	}

	if vmPath == "" {
		pterm.Error.Println("VM path required (-path)")
		os.Exit(1)
	}

	var endpoint string
	var opEmoji string
	var opName string

	switch operation {
	case "shutdown":
		endpoint = "/vms/shutdown"
		opEmoji = "🔌"
		opName = "Shutting down"
	case "poweroff":
		endpoint = "/vms/poweroff"
		opEmoji = "⚡"
		opName = "Powering off"
	case "remove-cdrom":
		endpoint = "/vms/remove-cdrom"
		opEmoji = "💿"
		opName = "Removing CD/DVD from"
	case "info":
		endpoint = "/vms/info"
		opEmoji = "ℹ️"
		opName = "Getting info for"
	default:
		pterm.Error.Printfln("Unknown operation: %s", operation)
		pterm.Info.Println("Available operations: shutdown, poweroff, remove-cdrom, info")
		os.Exit(1)
	}

	spinner, _ := pterm.DefaultSpinner.Start(fmt.Sprintf("%s %s VM: %s", opEmoji, opName, vmPath))

	// Prepare request
	reqBody := map[string]interface{}{
		"vm_path": vmPath,
	}
	if operation == "shutdown" && timeout > 0 {
		reqBody["timeout"] = timeout
	}

	data, _ := json.Marshal(reqBody)

	// Make request with appropriate timeout
	reqTimeout := 30 * time.Second
	if operation == "shutdown" {
		reqTimeout = time.Duration(timeout+10) * time.Second
	}

	resp, err := apiRequestWithTimeout(daemonURL+endpoint, "POST", "application/json", data, reqTimeout)
	if err != nil {
		spinner.Fail(fmt.Sprintf("Failed to %s: %v", operation, err))
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		spinner.Fail(fmt.Sprintf("Server error: %s", string(body)))
		os.Exit(1)
	}

	// Parse response
	if operation == "info" {
		var infoResp struct {
			Success  bool              `json:"success"`
			VMInfo   vsphere.VMInfo    `json:"vm_info"`
			Timestamp time.Time        `json:"timestamp"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&infoResp); err != nil {
			spinner.Fail(fmt.Sprintf("Failed to parse response: %v", err))
			os.Exit(1)
		}

		spinner.Success("Retrieved VM info")

		// Display VM info
		pterm.DefaultSection.Println("📋 VM Information")
		data := [][]string{
			{"Property", "Value"},
			{"Name", infoResp.VMInfo.Name},
			{"Path", infoResp.VMInfo.Path},
			{"Power State", colorizeStatus(infoResp.VMInfo.PowerState)},
			{"Guest OS", infoResp.VMInfo.GuestOS},
			{"CPUs", fmt.Sprintf("%d", infoResp.VMInfo.NumCPU)},
			{"Memory", fmt.Sprintf("%.1f GB", float64(infoResp.VMInfo.MemoryMB)/1024)},
			{"Storage", formatBytes(infoResp.VMInfo.Storage)},
		}

		pterm.DefaultTable.
			WithHasHeader().
			WithHeaderRowSeparator("-").
			WithBoxed().
			WithData(data).
			Render()
	} else {
		var opResp struct {
			Success   bool      `json:"success"`
			Message   string    `json:"message"`
			Timestamp time.Time `json:"timestamp"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&opResp); err != nil {
			spinner.Fail(fmt.Sprintf("Failed to parse response: %v", err))
			os.Exit(1)
		}

		spinner.Success(opResp.Message)

		// Show success celebration
		showSuccessArt()
		pterm.Success.Printfln("✅ %s", opResp.Message)

		// Show motivation
		showMotivation()

		// Show helpful next steps
		pterm.Println()
		switch operation {
		case "shutdown":
			pterm.Info.Println("💡 Next steps:")
			pterm.Println("   1. Verify VM is powered off: h2kvmctl vm -op info -path " + vmPath)
			pterm.Println("   2. Remove CD/DVD: h2kvmctl vm -op remove-cdrom -path " + vmPath)
			pterm.Println("   3. Export VM: h2kvmctl submit -vm " + vmPath + " -output /tmp/export")
		case "poweroff":
			pterm.Info.Println("💡 Next steps:")
			pterm.Println("   1. Remove CD/DVD: h2kvmctl vm -op remove-cdrom -path " + vmPath)
			pterm.Println("   2. Export VM: h2kvmctl submit -vm " + vmPath + " -output /tmp/export")
		case "remove-cdrom":
			pterm.Info.Println("💡 Next steps:")
			pterm.Println("   1. Export VM: h2kvmctl submit -vm " + vmPath + " -output /tmp/export")
			pterm.Println("   2. Monitor export: h2kvmctl query -status running")
		}
	}
}

func handleStatus(daemonURL string) {
	spinner, _ := pterm.DefaultSpinner.Start("📊 Getting daemon status...")

	resp, err := apiRequest(daemonURL+"/status", "GET", "", nil)
	if err != nil {
		spinner.Fail(fmt.Sprintf("Failed to get status: %v", err))
		os.Exit(1)
	}
	defer resp.Body.Close()

	var status models.DaemonStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		spinner.Fail(fmt.Sprintf("Failed to parse response: %v", err))
		os.Exit(1)
	}

	spinner.Success("Retrieved daemon status")
	pterm.Println()

	// Show connection info
	pterm.Info.Printfln("🔗 Connected to: %s", daemonURL)
	pterm.Println()

	// Display main status
	pterm.DefaultSection.Println("📊 Daemon Status")
	statusData := [][]string{
		{"Property", "Value"},
		{"⚙️  Version", status.Version},
		{"⏱️  Uptime", status.Uptime},
		{"📍 URL", daemonURL},
	}

	pterm.DefaultTable.
		WithHasHeader().
		WithHeaderRowSeparator("-").
		WithBoxed().
		WithData(statusData).
		Render()

	pterm.Println()

	// Display job statistics
	pterm.DefaultSection.Println("📈 Job Statistics")

	// Calculate percentages
	total := float64(status.TotalJobs)
	runningPct := 0.0
	completedPct := 0.0
	failedPct := 0.0
	if total > 0 {
		runningPct = float64(status.RunningJobs) / total * 100
		completedPct = float64(status.CompletedJobs) / total * 100
		failedPct = float64(status.FailedJobs) / total * 100
	}

	jobsData := [][]string{
		{"Status", "Count", "Percentage"},
		{"📦 Total Jobs", fmt.Sprintf("%d", status.TotalJobs), "100%"},
		{"🔄 Running", pterm.LightCyan(fmt.Sprintf("%d", status.RunningJobs)), fmt.Sprintf("%.1f%%", runningPct)},
		{"✅ Completed", pterm.Green(fmt.Sprintf("%d", status.CompletedJobs)), fmt.Sprintf("%.1f%%", completedPct)},
		{"❌ Failed", pterm.Red(fmt.Sprintf("%d", status.FailedJobs)), fmt.Sprintf("%.1f%%", failedPct)},
	}

	pterm.DefaultTable.
		WithHasHeader().
		WithHeaderRowSeparator("-").
		WithBoxed().
		WithData(jobsData).
		Render()

	pterm.Println()

	// Show helpful actions
	if status.RunningJobs > 0 {
		pterm.Info.Println("💡 You have running jobs:")
		pterm.Println("   View them: h2kvmctl query -status running")
	} else if status.TotalJobs == 0 {
		pterm.Info.Println("💡 No jobs yet. Start by:")
		pterm.Println("   1. List VMs: h2kvmctl list")
		pterm.Println("   2. Submit job: h2kvmctl submit -vm /data/vm/my-vm -output /tmp/export")
	} else {
		pterm.Success.Println("✅ All jobs completed!")
	}
}

func handleCancel(daemonURL, jobIDs string) {
	if jobIDs == "" {
		pterm.Error.Println("Job ID required (-id)")
		os.Exit(1)
	}

	spinner, _ := pterm.DefaultSpinner.Start("Cancelling job(s)...")

	req := models.CancelRequest{
		JobIDs: strings.Split(jobIDs, ","),
	}

	data, _ := json.Marshal(req)
	resp, err := apiRequest(daemonURL+"/jobs/cancel", "POST", "application/json", data)
	if err != nil {
		spinner.Fail(fmt.Sprintf("Failed to cancel: %v", err))
		os.Exit(1)
	}
	defer resp.Body.Close()

	var cancelResp models.CancelResponse
	if err := json.NewDecoder(resp.Body).Decode(&cancelResp); err != nil {
		spinner.Fail(fmt.Sprintf("Failed to parse response: %v", err))
		os.Exit(1)
	}

	spinner.Success(fmt.Sprintf("Cancelled %d job(s)", len(cancelResp.Cancelled)))

	if len(cancelResp.Cancelled) > 0 {
		pterm.Success.Println("Cancelled:")
		for _, id := range cancelResp.Cancelled {
			pterm.Info.Printfln("  - %s", id)
		}
	}

	if len(cancelResp.Failed) > 0 {
		pterm.Warning.Println("Failed to cancel:")
		for _, id := range cancelResp.Failed {
			pterm.Error.Printfln("  - %s: %s", id, cancelResp.Errors[id])
		}
	}
}

func displayJobs(jobs []*models.Job) {
	data := [][]string{
		{"Job ID", "Name", "VM Path", "Status", "Progress", "Started"},
	}

	for _, job := range jobs {
		id := job.Definition.ID
		if len(id) > 8 {
			id = id[:8] + "..."
		}

		vmPath := job.Definition.VMPath
		if len(vmPath) > 30 {
			vmPath = "..." + vmPath[len(vmPath)-27:]
		}

		status := colorizeStatus(string(job.Status))

		progress := "-"
		if job.Progress != nil {
			progress = fmt.Sprintf("%s (%.1f%%)",
				job.Progress.Phase,
				job.Progress.PercentComplete)
		}

		started := "-"
		if job.StartedAt != nil {
			started = job.StartedAt.Format("15:04:05")
		}

		data = append(data, []string{
			id,
			job.Definition.Name,
			vmPath,
			status,
			progress,
			started,
		})
	}

	pterm.DefaultSection.Println("Jobs")
	pterm.DefaultTable.
		WithHasHeader().
		WithHeaderRowSeparator("-").
		WithBoxed().
		WithData(data).
		Render()
}

func colorizeStatus(status string) string {
	switch status {
	case "running":
		return pterm.LightCyan(status)
	case "completed":
		return pterm.Green(status)
	case "failed":
		return pterm.Red(status)
	case "cancelled":
		return pterm.Yellow(status)
	default:
		return pterm.Gray(status)
	}
}

func apiRequest(url, method, contentType string, body []byte) (*http.Response, error) {
	return apiRequestWithTimeout(url, method, contentType, body, 30*time.Second)
}

func apiRequestWithTimeout(url, method, contentType string, body []byte, timeout time.Duration) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	client := &http.Client{Timeout: timeout}
	return client.Do(req)
}

// GenerateExampleJobFile creates an example job file
func GenerateExampleJobFile(format string) {
	job := models.JobDefinition{
		Name:       "example-export",
		VMPath:     "/datacenter/vm/my-vm",
		OutputPath: "/tmp/export-my-vm",
		Options: &models.ExportOptions{
			ParallelDownloads:      4,
			RemoveCDROM:            true,
			ShowIndividualProgress: false,
		},
	}

	var data []byte
	var err error
	var filename string

	if format == "yaml" {
		data, err = yaml.Marshal(job)
		filename = "example-job.yaml"
	} else {
		data, err = json.MarshalIndent(job, "", "  ")
		filename = "example-job.json"
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Generated %s\n", filename)
}

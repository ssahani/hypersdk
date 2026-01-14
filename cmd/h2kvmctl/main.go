// SPDX-License-Identifier: LGPL-3.0-or-later

package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
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

	case "help", "-h", "--help":
		showUsage()

	default:
		pterm.Error.Printfln("Unknown command: %s", os.Args[1])
		showUsage()
		os.Exit(1)
	}
}

func showUsage() {
	pterm.DefaultHeader.Println("h2kvmctl - Hyper2KVM Daemon Control")
	pterm.Println()

	commands := [][]string{
		{"Command", "Description"},
		{"submit", "Submit job(s) to daemon"},
		{"list", "List available VMs from vCenter"},
		{"vm", "VM operations (shutdown, poweroff, remove-cdrom, info)"},
		{"query", "Query job status"},
		{"status", "Get daemon status"},
		{"cancel", "Cancel running job(s)"},
		{"help", "Show this help"},
	}

	pterm.DefaultTable.
		WithHasHeader().
		WithHeaderRowSeparator("-").
		WithBoxed().
		WithData(commands).
		Render()

	pterm.Println()
	pterm.Info.Println("Examples:")
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
		pterm.Success.Printfln("✅ %s", opResp.Message)
	}
}

func handleStatus(daemonURL string) {
	spinner, _ := pterm.DefaultSpinner.Start("Getting daemon status...")

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

	// Display status
	data := [][]string{
		{"Metric", "Value"},
		{"Version", status.Version},
		{"Uptime", status.Uptime},
		{"Total Jobs", fmt.Sprintf("%d", status.TotalJobs)},
		{"Running", fmt.Sprintf("%d", status.RunningJobs)},
		{"Completed", fmt.Sprintf("%d", status.CompletedJobs)},
		{"Failed", fmt.Sprintf("%d", status.FailedJobs)},
	}

	pterm.DefaultSection.Println("Daemon Status")
	pterm.DefaultTable.
		WithHasHeader().
		WithHeaderRowSeparator("-").
		WithBoxed().
		WithData(data).
		Render()
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

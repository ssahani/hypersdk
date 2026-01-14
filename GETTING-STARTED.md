# Getting Started with hyper2kvm-vsphere

Welcome to **hyper2kvm-vsphere** - the Go implementation of the hyper2kvm migration toolkit!

---

## 🎯 What is hyper2kvm-vsphere?

A high-performance, daemon-based VM export system that provides:

1. **Interactive CLI** (`hyper2kvm`) - Beautiful terminal UI for manual exports
2. **Background Daemon** (`hyper2kvmd`) - REST API service for automation
3. **Control CLI** (`h2kvmctl`) - Manage daemon jobs from command line

Built with:
- **govmomi v0.52.0** - VMware vSphere Go SDK
- **pterm v0.12.82** - Modern terminal UI
- **Go 1.24** - Fast, concurrent, production-ready

---

## ⚡ Quick Start (5 minutes)

### 1. Set Your vCenter Credentials

```bash
export GOVC_URL='https://your-vcenter.com/sdk'
export GOVC_USERNAME='administrator@vsphere.local'
export GOVC_PASSWORD='your-password'
export GOVC_INSECURE=1
```

### 2. Choose Your Workflow

#### Option A: Interactive Mode (Beginner-Friendly)

```bash
cd ~/go/hyper2kvm
./build/hyper2kvm
```

Then:
- Browse and select your VM interactively
- Watch real-time progress bars
- Get beautiful status updates

#### Option B: Daemon Mode (For Automation)

**Terminal 1 - Start Daemon:**
```bash
./build/hyper2kvmd
```

**Terminal 2 - Submit Jobs:**
```bash
# Single VM
./build/h2kvmctl submit -vm "/datacenter/vm/my-vm" -output "/tmp/export"

# Or from YAML
./build/h2kvmctl submit -file example-job.yaml

# Check status
./build/h2kvmctl query -all
```

---

## 📝 Your First Export

### Create a Job File

Create `my-export.yaml`:

```yaml
name: "my-first-export"
vm_path: "/datacenter/vm/my-test-vm"  # Change this to your VM path
output_path: "/tmp/my-export"
options:
  parallel_downloads: 4
  remove_cdrom: true
```

### Submit the Job

```bash
./build/h2kvmctl submit -file my-export.yaml
```

### Monitor Progress

```bash
# Watch all jobs
./build/h2kvmctl query -all

# Watch daemon status
./build/h2kvmctl status

# View logs
tail -f /tmp/hyper2kvmd.log
```

---

## 🔧 Common Tasks

### List All VMs

The interactive CLI (`./build/hyper2kvm`) automatically discovers all VMs.

### Export Multiple VMs (Batch)

Create `batch-export.yaml`:

```yaml
jobs:
  - name: "vm-1"
    vm_path: "/datacenter/vm/vm-1"
    output_path: "/tmp/export-vm-1"

  - name: "vm-2"
    vm_path: "/datacenter/vm/vm-2"
    output_path: "/tmp/export-vm-2"

  - name: "vm-3"
    vm_path: "/datacenter/vm/vm-3"
    output_path: "/tmp/export-vm-3"
```

Submit:
```bash
./build/h2kvmctl submit -file batch-export.yaml
```

### Cancel a Running Job

```bash
# Get job ID first
./build/h2kvmctl query -all

# Cancel it
./build/h2kvmctl cancel -id <job-id>
```

### Check What the Daemon is Doing

```bash
./build/h2kvmctl status
```

Output:
```
┌────────────┬────────┐
| Metric     | Value  |
|────────────────────|
| Version    | 1.0.0  |
| Uptime     | 5m30s  |
| Total Jobs | 5      |
| Running    | 2      |
| Completed  | 3      |
| Failed     | 0      |
└────────────┴────────┘
```

---

## 🐍 Python Integration

Perfect for integrating with your Python hyper2kvm project:

```python
import requests

# Submit job
resp = requests.post("http://localhost:8080/jobs/submit", json={
    "name": "python-export",
    "vm_path": "/datacenter/vm/my-vm",
    "output_path": "/tmp/export"
})

job_id = resp.json()["job_ids"][0]

# Check status
status = requests.post("http://localhost:8080/jobs/query",
    json={"job_ids": [job_id]}).json()

print(status["jobs"][0]["status"])  # "running", "completed", etc.
```

---

## 🎨 What Makes This Special?

### Beautiful Terminal UI
```
 ██   ██ ██    ██ ██████  ███████ ██████
 ██   ██  ██  ██  ██   ██ ██      ██   ██
 ███████   ████   ██████  █████   ██████
 ██   ██    ██    ██      ██      ██   ██
 ██   ██    ██    ██      ███████ ██   ██

        Hypervisor to KVM Migration Tool
```

### Real-Time Progress
```
Exporting my-vm: 45% |████████████░░░░░░░| (2/4 files)
 ✓ disk-0.vmdk (23 GB) - Complete
 ✓ disk-1.vmdk (15 GB) - Complete
 → disk-2.vmdk (18 GB) - Downloading 67%
   disk-3.vmdk (8 GB)  - Pending
```

### Concurrent Processing
Multiple VMs export **in parallel** - each in its own goroutine!

---

## 📊 Example Output

### Interactive CLI
```
 SUCCESS  Connected to vSphere successfully!
 SUCCESS  Found 201 virtual machine(s)

┌─ Connection Info ─────────────────────┐
| vCenter: https://10.73.213.134/sdk    |
| User: administrator@vsphere.local     |
└───────────────────────────────────────┘

Select a VM to export [type to search]:
> my-test-vm
  production-web-server
  dev-database
  ...
```

### Daemon Query
```
# Jobs

┌────────────┬─────────┬────────────────┬─────────┬────────────┬─────────┐
| Job ID     | Name    | VM Path        | Status  | Progress   | Started |
|──────────────────────────────────────────────────────────────────────────|
| abc123...  | vm-1    | .../my-vm      | running | export 45% | 10:30:15|
| def456...  | vm-2    | .../other-vm   | complete| 100%       | 10:25:00|
└────────────┴─────────┴────────────────┴─────────┴────────────┴─────────┘
```

---

## 🚀 Production Deployment

### Run as Systemd Service

1. Copy binary:
   ```bash
   sudo cp build/hyper2kvmd /usr/local/bin/
   ```

2. Create service file `/etc/systemd/system/hyper2kvmd.service`:
   ```ini
   [Unit]
   Description=Hyper2KVM vSphere Daemon
   After=network.target

   [Service]
   Type=simple
   User=vmexport
   Environment="GOVC_URL=https://vcenter.example.com/sdk"
   Environment="GOVC_USERNAME=admin@vsphere.local"
   Environment="GOVC_PASSWORD=secret"
   Environment="GOVC_INSECURE=1"
   ExecStart=/usr/local/bin/hyper2kvmd
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start:
   ```bash
   sudo systemctl enable hyper2kvmd
   sudo systemctl start hyper2kvmd
   sudo systemctl status hyper2kvmd
   ```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOVC_URL` | ✅ Yes | vCenter SDK URL |
| `GOVC_USERNAME` | ✅ Yes | vCenter username |
| `GOVC_PASSWORD` | ✅ Yes | vCenter password |
| `GOVC_INSECURE` | No | Skip TLS verification (1=yes) |
| `GOVC_DATACENTER` | No | Default datacenter |
| `DOWNLOAD_WORKERS` | No | Parallel downloads (default: 4) |
| `LOG_LEVEL` | No | debug/info/warn/error (default: info) |

---

## 🔍 Troubleshooting

### Problem: Cannot Connect to vCenter

**Check:**
```bash
# Test credentials
echo $GOVC_URL
echo $GOVC_USERNAME

# Try direct connection
curl -k $GOVC_URL
```

**Solution:**
- Verify URL ends with `/sdk`
- Check firewall allows HTTPS (443)
- Try `GOVC_INSECURE=1` for self-signed certs

### Problem: Job Stuck in "Running"

**Check daemon logs:**
```bash
tail -f /tmp/hyper2kvmd.log
```

**Common causes:**
- Network interruption
- VM has snapshots (not supported)
- Insufficient disk space
- vCenter under heavy load

### Problem: Download Fails

**Automatic retry** happens 3 times. If still failing:
- Check disk space: `df -h /tmp`
- Check network: `ping vcenter.example.com`
- Reduce workers: Add `parallel_downloads: 1` to job file

---

## 📚 Learn More

- [Full Documentation](README.md)
- [Daemon Architecture](DAEMON-README.md)
- [Test Results](TEST-RESULTS.md)
- [API Reference](docs/API.md) (coming soon)

---

## 💡 Pro Tips

1. **Start with interactive mode** to understand the workflow
2. **Use YAML files** for repeatable exports
3. **Run daemon in background** for automation
4. **Monitor with h2kvmctl** instead of checking logs
5. **Adjust parallel downloads** based on network speed
6. **Remove CD/DVD** before export for cleaner OVF files

---

## ✅ You're Ready!

Try your first export:

```bash
# Interactive mode
./build/hyper2kvm

# OR daemon mode
./build/hyper2kvmd &
./build/h2kvmctl submit -vm "/path/to/your/vm" -output "/tmp/export"
./build/h2kvmctl query -all
```

**Happy migrating! 🎉**

---

*Part of the [hyper2kvm](https://github.com/yourusername/hyper2kvm) project family*

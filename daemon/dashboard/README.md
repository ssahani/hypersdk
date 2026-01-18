# HyperSDK Real-Time Web Dashboard

A modern, real-time web dashboard for monitoring HyperSDK operations with WebSocket-based live updates.

## Features

- **Real-Time Updates**: WebSocket-based live metrics updates (1-second intervals)
- **Interactive Charts**: Dynamic charts powered by Chart.js
- **Job Monitoring**: Track active, completed, and failed jobs in real-time
- **Resource Monitoring**: CPU, memory, and goroutine metrics
- **Provider Stats**: Jobs breakdown by cloud provider (AWS, Azure, GCP)
- **Alert System**: Real-time alerts with severity levels
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Auto-Reconnect**: Automatically reconnects on connection loss

## Quick Start

### Basic Usage

```go
import "hypersdk/daemon/dashboard"

// Create dashboard with default config
config := dashboard.DefaultConfig()
config.Port = 8080
config.UpdateInterval = 1 * time.Second

dash, err := dashboard.NewDashboard(config)
if err != nil {
    log.Fatal(err)
}

// Start dashboard server
ctx := context.Background()
go dash.Start(ctx)

// Update metrics from your application
dash.UpdateJobMetrics(active, completed, failed, pending, queueLen)
dash.UpdateSystemMetrics(memoryMB, cpuPercent, goroutines)
dash.UpdateHTTPMetrics(requests, errors, avgResponseTime)
```

### Access Dashboard

Open your browser and navigate to:
```
http://localhost:8080
```

## Configuration

```go
type Config struct {
    Enabled        bool          // Enable/disable dashboard
    Port           int           // HTTP port (default: 8080)
    UpdateInterval time.Duration // Metrics update frequency (default: 1s)
    MaxClients     int           // Maximum WebSocket clients (default: 100)
}
```

### Example Configurations

**Development** (fast updates):
```go
config := &dashboard.Config{
    Enabled:        true,
    Port:           8080,
    UpdateInterval: 500 * time.Millisecond,
    MaxClients:     50,
}
```

**Production** (optimized):
```go
config := &dashboard.Config{
    Enabled:        true,
    Port:           8080,
    UpdateInterval: 2 * time.Second,
    MaxClients:     200,
}
```

## Dashboard Components

### Overview Stats (8 Cards)

- **Active Jobs**: Currently running jobs
- **Completed Jobs**: Successfully finished jobs
- **Failed Jobs**: Jobs that encountered errors
- **Queue Length**: Jobs waiting to be processed
- **HTTP Requests**: Total API requests
- **Avg Response**: Average API response time
- **Memory Usage**: Current memory consumption
- **CPU Usage**: Current CPU utilization

### Charts (4 Visualizations)

1. **Job Status Distribution** (Doughnut Chart)
   - Shows proportion of jobs by status
   - Colors: Active (blue), Completed (green), Failed (red), Pending (orange)

2. **Jobs Over Time** (Line Chart)
   - Tracks active, completed, and failed jobs over time
   - 50-point rolling history

3. **Provider Distribution** (Bar Chart)
   - Jobs breakdown by cloud provider
   - Dynamically updates as providers are used

4. **System Resources** (Multi-axis Line Chart)
   - Memory usage (MB) on left axis
   - CPU usage (%) on right axis

### Jobs Table

Real-time table showing recent jobs with:
- Job ID
- Name
- Status badge (colored)
- Progress bar (0-100%)
- Provider
- VM Name
- Duration
- Start Time

Maximum 50 recent jobs displayed

### Alert System

Top-of-page alerts with three severity levels:
- **Critical**: Red background
- **Warning**: Orange background
- **Info**: Blue background

Dismissible alerts, maximum 3 shown at once

## API Endpoints

### HTTP API

```
GET  /                  - Dashboard homepage
GET  /api/metrics      - Current metrics (JSON)
GET  /api/jobs         - Recent jobs list (JSON)
GET  /api/jobs/{id}    - Specific job details (JSON)
GET  /static/*         - Static assets (CSS, JS)
```

### WebSocket API

```
WS   /ws               - Real-time metrics stream
```

#### WebSocket Message Format

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "jobs_active": 5,
  "jobs_completed": 123,
  "jobs_failed": 2,
  "jobs_pending": 8,
  "queue_length": 15,
  "http_requests": 45678,
  "http_errors": 23,
  "avg_response_time": 125.5,
  "memory_usage": 2048,
  "cpu_usage": 45.2,
  "goroutines": 1234,
  "active_connections": 3,
  "provider_stats": {
    "aws": 50,
    "azure": 30,
    "gcp": 43
  },
  "recent_jobs": [...],
  "system_health": "healthy",
  "alerts": [...]
}
```

## Updating Metrics

### Job Metrics

```go
// Update job counters
dash.UpdateJobMetrics(
    active,     // int: Running jobs
    completed,  // int: Finished jobs
    failed,     // int: Failed jobs
    pending,    // int: Queued jobs
    queueLen,   // int: Queue length
)
```

### Add Job to History

```go
job := dashboard.JobInfo{
    ID:        "job-12345",
    Name:      "export-vm-prod-01",
    Status:    "running",
    Progress:  75,
    StartTime: time.Now(),
    Provider:  "aws",
    VMName:    "prod-web-01",
}
dash.AddJob(job)
```

### System Resource Metrics

```go
// Update system metrics
dash.UpdateSystemMetrics(
    memoryMB,    // int64: Memory in megabytes
    cpuPercent,  // float64: CPU usage percentage
    goroutines,  // int: Number of goroutines
)
```

### HTTP Metrics

```go
// Update HTTP metrics
dash.UpdateHTTPMetrics(
    requests,        // int64: Total requests
    errors,          // int64: Error count
    avgResponseTime, // float64: Avg response in ms
)
```

### Alerts

```go
// Add alert
dash.AddAlert("warning", "High memory usage detected")
dash.AddAlert("critical", "Service degraded")
dash.AddAlert("info", "Backup completed successfully")
```

### System Health

```go
// Set overall health status
dash.SetSystemHealth("healthy")   // Green
dash.SetSystemHealth("degraded")  // Orange
dash.SetSystemHealth("unhealthy") // Red
```

## Integration Example

```go
package main

import (
    "context"
    "log"
    "runtime"
    "time"

    "hypersdk/daemon/dashboard"
)

func main() {
    // Create and start dashboard
    dash, err := dashboard.NewDashboard(dashboard.DefaultConfig())
    if err != nil {
        log.Fatal(err)
    }

    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    go dash.Start(ctx)

    // Update metrics periodically
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()

    for range ticker.C {
        // Get system metrics
        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        memoryMB := int64(m.Alloc / 1024 / 1024)
        goroutines := runtime.NumGoroutine()

        // Update dashboard
        dash.UpdateSystemMetrics(memoryMB, 0, goroutines)

        // Add job updates as they occur
        // dash.AddJob(jobInfo)
    }
}
```

## WebSocket Client Example

### JavaScript

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
    console.log('Connected');
};

ws.onmessage = (event) => {
    const metrics = JSON.parse(event.data);
    console.log('Metrics:', metrics);
    // Update your UI
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('Disconnected');
    // Reconnect after delay
};
```

### Go

```go
import "github.com/gorilla/websocket"

conn, _, err := websocket.DefaultDialer.Dial("ws://localhost:8080/ws", nil)
if err != nil {
    log.Fatal(err)
}
defer conn.Close()

for {
    _, message, err := conn.ReadMessage()
    if err != nil {
        log.Println("Read error:", err)
        break
    }

    var metrics dashboard.Metrics
    json.Unmarshal(message, &metrics)
    log.Printf("Active jobs: %d\n", metrics.JobsActive)
}
```

## Customization

### Custom Templates

Templates are embedded in the binary. To customize:

1. Modify `templates/index.html`
2. Rebuild the application

### Custom Styles

CSS is located in `static/css/dashboard.css`. Key variables:

```css
:root {
    --primary-color: #3b82f6;
    --success-color: #10b981;
    --warning-color: #f59e0b;
    --danger-color: #ef4444;
    --dark-bg: #1f2937;
    --card-bg: #374151;
}
```

### Custom JavaScript

Dashboard logic is in `static/js/dashboard.js`. Key functions:

- `updateDashboard(metrics)` - Update all UI components
- `updateCharts(metrics)` - Refresh charts
- `updateJobsTable(jobs)` - Update jobs table
- `updateAlerts(alerts)` - Update alert notifications

## Performance Considerations

1. **Update Interval**: Balance between responsiveness and server load
   - Fast: 500ms-1s (development)
   - Normal: 1-2s (production)
   - Slow: 5s+ (low-priority monitoring)

2. **Max Clients**: Limit WebSocket connections
   - Small: 50 clients
   - Medium: 100 clients (default)
   - Large: 200+ clients (requires tuning)

3. **History Size**: Charts keep 50 data points
   - Modify `MAX_HISTORY` in JavaScript for more/less

4. **Job Limit**: Recent jobs limited to 50
   - Older jobs automatically removed

## Security

### Production Recommendations

1. **HTTPS/WSS**: Use TLS in production
   ```go
   server.ListenAndServeTLS("cert.pem", "key.pem")
   ```

2. **Authentication**: Add auth middleware
   ```go
   mux.HandleFunc("/", authMiddleware(d.handleIndex))
   ```

3. **CORS**: Configure allowed origins
   ```go
   upgrader.CheckOrigin = func(r *http.Request) bool {
       origin := r.Header.Get("Origin")
       return origin == "https://yourdomain.com"
   }
   ```

4. **Rate Limiting**: Prevent abuse
   ```go
   // Use rate limiting middleware
   ```

## Troubleshooting

### WebSocket Not Connecting

1. Check server is running on correct port
2. Verify firewall allows WebSocket connections
3. Check browser console for errors
4. Ensure proxy supports WebSocket upgrades

### High Memory Usage

1. Reduce `UpdateInterval`
2. Decrease `MaxClients`
3. Limit job history size
4. Clear old metrics data

### Charts Not Updating

1. Verify WebSocket connection is active
2. Check browser console for JavaScript errors
3. Ensure Chart.js library loaded correctly
4. Verify metrics are being sent from server

### Slow Performance

1. Increase `UpdateInterval`
2. Reduce number of chart data points
3. Optimize chart update mode (`'none'` for no animation)
4. Limit concurrent WebSocket clients

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE11: ❌ Not supported (no WebSocket)

## Dependencies

- **Chart.js**: v4.4.0 (charts and graphs)
- **Gorilla WebSocket**: Real-time communication
- **Embedded FS**: Templates and static files

## License

SPDX-License-Identifier: LGPL-3.0-or-later

// SPDX-License-Identifier: LGPL-3.0-or-later

package api

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"hypersdk/daemon/models"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins in development - should be restricted in production
		return true
	},
}

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type      string                 `json:"type"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

// WSClient represents a connected WebSocket client
type WSClient struct {
	conn     *websocket.Conn
	send     chan WSMessage
	hub      *WSHub
	mu       sync.Mutex
	closed   bool
}

// WSHub manages WebSocket clients and broadcasts
type WSHub struct {
	clients    map[*WSClient]bool
	broadcast  chan WSMessage
	register   chan *WSClient
	unregister chan *WSClient
	mu         sync.RWMutex
}

// NewWSHub creates a new WebSocket hub
func NewWSHub() *WSHub {
	return &WSHub{
		clients:    make(map[*WSClient]bool),
		broadcast:  make(chan WSMessage, 256),
		register:   make(chan *WSClient),
		unregister: make(chan *WSClient),
	}
}

// Run starts the WebSocket hub
func (h *WSHub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Client buffer full, close connection
					h.mu.RUnlock()
					h.unregister <- client
					h.mu.RLock()
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends a message to all connected clients
func (h *WSHub) Broadcast(msgType string, data map[string]interface{}) {
	message := WSMessage{
		Type:      msgType,
		Timestamp: time.Now(),
		Data:      data,
	}
	select {
	case h.broadcast <- message:
	default:
		// Drop message if channel is full
	}
}

// GetClientCount returns the number of connected clients
func (h *WSHub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// readPump pumps messages from the WebSocket connection to the hub
func (c *WSClient) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				// Log unexpected close
			}
			break
		}
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *WSClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}

			if err := json.NewEncoder(w).Encode(message); err != nil {
				return
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleWebSocket handles WebSocket connections
func (es *EnhancedServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		es.logger.Error("websocket upgrade failed", "error", err)
		return
	}

	client := &WSClient{
		conn: conn,
		send: make(chan WSMessage, 256),
		hub:  es.wsHub,
	}

	es.wsHub.register <- client

	// Send initial data
	go func() {
		// Send current status
		status := es.manager.GetStatus()
		client.send <- WSMessage{
			Type:      "status",
			Timestamp: time.Now(),
			Data: map[string]interface{}{
				"total_jobs":      status.TotalJobs,
				"running_jobs":    status.RunningJobs,
				"completed_jobs":  status.CompletedJobs,
				"failed_jobs":     status.FailedJobs,
			},
		}

		// Send current jobs
		allJobs := es.manager.GetAllJobs()
		jobsData := make([]map[string]interface{}, 0, len(allJobs))
		for _, job := range allJobs {
			jobsData = append(jobsData, map[string]interface{}{
				"definition": job.Definition,
				"status":     job.Status,
				"progress":   job.Progress,
				"error":      job.Error,
			})
		}
		client.send <- WSMessage{
			Type:      "jobs",
			Timestamp: time.Now(),
			Data: map[string]interface{}{
				"jobs": jobsData,
			},
		}
	}()

	// Run client pumps
	go client.writePump()
	go client.readPump()

	es.logger.Info("websocket client connected", "remote", r.RemoteAddr)
}

// StartStatusBroadcaster starts a goroutine that broadcasts status updates
func (es *EnhancedServer) StartStatusBroadcaster() {
	ticker := time.NewTicker(2 * time.Second)
	go func() {
		for range ticker.C {
			if es.wsHub.GetClientCount() == 0 {
				continue
			}

			status := es.manager.GetStatus()
			es.wsHub.Broadcast("status", map[string]interface{}{
				"total_jobs":      status.TotalJobs,
				"running_jobs":    status.RunningJobs,
				"completed_jobs":  status.CompletedJobs,
				"failed_jobs":     status.FailedJobs,
			})
		}
	}()
}

// BroadcastJobUpdate broadcasts a job update to all connected clients
func (es *EnhancedServer) BroadcastJobUpdate(job *models.Job) {
	if es.wsHub == nil {
		return
	}

	es.wsHub.Broadcast("job_update", map[string]interface{}{
		"definition": job.Definition,
		"status":     job.Status,
		"progress":   job.Progress,
		"error":      job.Error,
	})
}

// BroadcastScheduleEvent broadcasts a schedule event
func (es *EnhancedServer) BroadcastScheduleEvent(event string, scheduleID string, data map[string]interface{}) {
	if es.wsHub == nil {
		return
	}

	if data == nil {
		data = make(map[string]interface{})
	}
	data["schedule_id"] = scheduleID
	data["event"] = event

	es.wsHub.Broadcast("schedule_event", data)
}

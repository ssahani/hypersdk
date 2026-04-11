import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react'
import { getWsToken } from '../api/client'

interface WSMessage {
  type: string
  data?: unknown
}

export interface VMEvent {
  event: 'state_change' | 'vm_added' | 'vm_removed'
  name: string
  old_state?: string
  new_state?: string
  state?: string
  timestamp: number
}

interface WebSocketContextType {
  isConnected: boolean
  subscribe: (callback: (msg: WSMessage) => void) => () => void
  events: VMEvent[]
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  subscribe: () => () => {},
  events: [],
})

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [events, setEvents] = useState<VMEvent[]>([])
  const subscribersRef = useRef<Set<(msg: WSMessage) => void>>(new Set())
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let retryDelay = 1000
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    async function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      let token: string
      try {
        token = await getWsToken()
      } catch {
        retryTimer = setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 30000)
        return
      }
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/v1/watch?token=${encodeURIComponent(token)}`)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        retryDelay = 1000
      }
      ws.onclose = () => {
        setIsConnected(false)
        retryTimer = setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 30000)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.changes && Array.isArray(data.changes)) {
            const newEvents: VMEvent[] = data.changes.map((c: VMEvent) => ({ ...c, timestamp: Date.now() }))
            setEvents(prev => [...newEvents, ...prev].slice(0, 50))
          }
          const msg = data as WSMessage
          subscribersRef.current.forEach((cb) => {
            try {
              cb(msg)
            } catch (err) {
              console.error('WebSocket subscriber error:', err)
            }
          })
        } catch {
          if (import.meta.env.DEV) {
            console.warn('Non-JSON WebSocket message:', e.data)
          }
        }
      }
    }

    connect()
    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      wsRef.current?.close()
    }
  }, [])

  const subscribe = useCallback((callback: (msg: WSMessage) => void) => {
    subscribersRef.current.add(callback)
    return () => { subscribersRef.current.delete(callback) }
  }, [])

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe, events }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocketContext() {
  return useContext(WebSocketContext)
}

import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react'

interface WSMessage {
  type: string
  data?: unknown
}

interface WebSocketContextType {
  isConnected: boolean
  subscribe: (callback: (msg: WSMessage) => void) => () => void
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  subscribe: () => () => {},
})

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const subscribersRef = useRef<Set<(msg: WSMessage) => void>>(new Set())
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let retryDelay = 1000
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/v1/watch`)
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
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage
          subscribersRef.current.forEach((cb) => cb(msg))
        } catch { /* ignore non-JSON */ }
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
    <WebSocketContext.Provider value={{ isConnected, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocketContext() {
  return useContext(WebSocketContext)
}

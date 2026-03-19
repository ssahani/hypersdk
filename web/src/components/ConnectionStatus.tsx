import { Wifi, WifiOff } from 'lucide-react'
import { useWebSocketContext } from '../contexts/WebSocketContext'

export default function ConnectionStatus() {
  const { isConnected } = useWebSocketContext()

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
      isConnected
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'bg-red-500/10 text-red-400 border border-red-500/20'
    }`}>
      {isConnected ? (
        <>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
          <Wifi className="w-3 h-3" />
          <span className="hidden sm:inline">Live</span>
        </>
      ) : (
        <>
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <WifiOff className="w-3 h-3" />
          <span className="hidden sm:inline">Offline</span>
        </>
      )}
    </div>
  )
}

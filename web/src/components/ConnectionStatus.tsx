import { Loader2, Wifi, WifiOff } from 'lucide-react'
import { useWebSocketContext } from '../contexts/WebSocketContext'

export default function ConnectionStatus() {
  const { connection } = useWebSocketContext()

  const isLive = connection === 'live'
  const isConnecting = connection === 'connecting'

  const title = isLive
    ? 'Real-time VM updates connected (/ws/v1/watch)'
    : isConnecting
      ? 'Connecting to real-time updates… If this never turns Live, your proxy may be blocking WebSockets (see README).'
      : 'Could not obtain a WebSocket token (try refreshing after sign-in).'

  return (
    <div
      title={title}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
        isLive
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : isConnecting
            ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
            : 'bg-red-500/10 text-red-400 border-red-500/20'
      }`}
    >
      {isLive ? (
        <>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
          <Wifi className="w-3 h-3 shrink-0" aria-hidden />
          <span className="whitespace-nowrap max-[520px]:sr-only">Live</span>
        </>
      ) : isConnecting ? (
        <>
          <Loader2 className="w-3 h-3 shrink-0 animate-spin" aria-hidden />
          <Wifi className="w-3 h-3 shrink-0 opacity-60" aria-hidden />
          <span className="whitespace-nowrap max-[520px]:sr-only">Connecting</span>
        </>
      ) : (
        <>
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <WifiOff className="w-3 h-3 shrink-0" aria-hidden />
          <span className="whitespace-nowrap max-[520px]:sr-only">Offline</span>
        </>
      )}
    </div>
  )
}

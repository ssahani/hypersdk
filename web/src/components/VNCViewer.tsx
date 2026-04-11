import { useEffect, useRef, useState } from 'react'
import { Maximize, Minimize, Monitor, RefreshCw } from 'lucide-react'
import { getWsToken } from '../api/client'

interface Props {
  vmName: string
  port?: number
}

export default function VNCViewer({ vmName, port = -1 }: Props) {
  const [fullscreen, setFullscreen] = useState(false)
  const [status, setStatus] = useState<'loading' | 'connecting' | 'connected' | 'disconnected'>('loading')
  const containerRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<unknown>(null)

  useEffect(() => {
    if (port <= 0 || !containerRef.current) return

    let cancelled = false

    async function connect() {
      if (!containerRef.current || cancelled) return

      // Clear container
      containerRef.current.innerHTML = ''

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      let token: string
      try {
        token = await getWsToken()
      } catch {
        setStatus('disconnected')
        return
      }
      if (cancelled) return
      const wsUrl = `${protocol}//${window.location.host}/ws/v1/vnc/${encodeURIComponent(vmName)}?token=${encodeURIComponent(token)}`

      // Dynamically import RFB from server-hosted noVNC (ESM module)
      // This is the same noVNC that's served at /novnc/core/rfb.js
      try {
        setStatus('connecting')
        // Load noVNC RFB from server-hosted ESM files (same approach as Cockpit)
        // Use Function constructor to avoid bundler trying to resolve the path
        const loadRfb = new Function('return import("/novnc/core/rfb.js")')
        const module = await loadRfb() as { default: new (...args: unknown[]) => Record<string, unknown> }
        const RFB = module.default

        if (cancelled || !containerRef.current) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rfb: any = new (RFB as any)(containerRef.current, wsUrl)
        rfb.scaleViewport = true
        rfb.resizeSession = false
        rfb.focusOnClick = true

        rfb.addEventListener('connect', () => {
          if (!cancelled) setStatus('connected')
        })
        rfb.addEventListener('disconnect', () => {
          if (!cancelled) setStatus('disconnected')
        })
        rfb.addEventListener('credentialsrequired', () => {
          rfb.sendCredentials({ password: '' })
        })

        rfbRef.current = rfb
      } catch (e) {
        console.error('Failed to load noVNC RFB:', e)

        // Fallback: try novnc-core npm package
        try {
          const { default: RFB } = await import(/* @vite-ignore */ 'novnc-core/lib/rfb')
          if (cancelled || !containerRef.current) return

          const rfb = new RFB(containerRef.current, wsUrl)
          rfb.scaleViewport = true
          rfb.addEventListener('connect', () => { if (!cancelled) setStatus('connected') })
          rfb.addEventListener('disconnect', () => { if (!cancelled) setStatus('disconnected') })
          rfbRef.current = rfb
        } catch {
          setStatus('disconnected')
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      if (rfbRef.current && typeof (rfbRef.current as { disconnect?: () => void }).disconnect === 'function') {
        try { (rfbRef.current as { disconnect: () => void }).disconnect() } catch { /* ignore */ }
      }
      rfbRef.current = null
    }
  }, [vmName, port])

  if (port <= 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-black rounded-lg p-12 text-center" style={{ minHeight: '500px' }}>
        <Monitor className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-400 mb-2">VNC Not Available</h3>
        <p className="text-sm text-slate-500 max-w-md">
          VM '{vmName}' doesn't have a VNC port assigned. Make sure the VM is running and has VNC graphics configured.
        </p>
      </div>
    )
  }

  const statusColor = status === 'connected' ? 'bg-green-500' : status === 'connecting' || status === 'loading' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
  const statusText = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : status === 'loading' ? 'Loading VNC client...' : 'Disconnected'

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-black flex flex-col' : ''}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
          <span className="text-sm text-slate-300">VNC — {vmName}</span>
          <span className="text-xs text-slate-500">{statusText}</span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'disconnected' && (
            <button onClick={() => window.location.reload()} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Reconnect</button>
          )}
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 hover:bg-slate-700 rounded transition" title="Fullscreen">
            {fullscreen ? <Minimize className="w-4 h-4 text-slate-400" /> : <Maximize className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: fullscreen ? 'calc(100vh - 44px)' : '600px',
          backgroundColor: '#000',
        }}
      />
    </div>
  )
}

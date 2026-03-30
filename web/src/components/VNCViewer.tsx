import { useEffect, useRef, useState } from 'react'
import { Maximize, Minimize, Monitor } from 'lucide-react'
// @ts-expect-error novnc-core has no types
import RFB from 'novnc-core/lib/rfb'

interface Props {
  vmName: string
  port?: number
}

export default function VNCViewer({ vmName, port = -1 }: Props) {
  const [fullscreen, setFullscreen] = useState(false)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const containerRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<InstanceType<typeof RFB> | null>(null)

  useEffect(() => {
    if (port <= 0 || !containerRef.current) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/v1/vnc/${encodeURIComponent(vmName)}`

    setStatus('connecting')

    try {
      const rfb = new RFB(containerRef.current, wsUrl)
      rfb.scaleViewport = true
      rfb.resizeSession = true

      rfb.addEventListener('connect', () => setStatus('connected'))
      rfb.addEventListener('disconnect', () => setStatus('disconnected'))

      rfbRef.current = rfb
    } catch (e) {
      console.error('RFB connection failed:', e)
      setStatus('disconnected')
    }

    return () => {
      if (rfbRef.current) {
        rfbRef.current.disconnect()
        rfbRef.current = null
      }
    }
  }, [vmName, port])

  if (port <= 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-black rounded-lg p-12 text-center" style={{ minHeight: '500px' }}>
        <Monitor className="w-16 h-16 text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-gray-400 mb-2">VNC Not Available</h3>
        <p className="text-sm text-gray-500 max-w-md">
          VM '{vmName}' doesn't have a VNC port assigned. Make sure the VM is running and has VNC graphics configured.
        </p>
      </div>
    )
  }

  const statusColor = status === 'connected' ? 'bg-green-500' : status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
  const statusText = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected'

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-black flex flex-col' : ''}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
          <span className="text-sm text-gray-300">VNC — {vmName}</span>
          <span className="text-xs text-gray-500">{statusText}</span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'disconnected' && (
            <button onClick={() => window.location.reload()} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition">Reconnect</button>
          )}
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 hover:bg-gray-700 rounded transition" title="Fullscreen">
            {fullscreen ? <Minimize className="w-4 h-4 text-gray-400" /> : <Maximize className="w-4 h-4 text-gray-400" />}
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className={`w-full bg-black ${fullscreen ? 'flex-1' : ''}`}
        style={fullscreen ? {} : { minHeight: '600px' }}
      />
    </div>
  )
}

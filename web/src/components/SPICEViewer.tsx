import { useState, useEffect } from 'react'
import { Maximize, Minimize, Monitor } from 'lucide-react'
import { getWsToken } from '../api/client'

interface Props {
  vmName: string
  port?: number
}

export default function SPICEViewer({ vmName, port = -1 }: Props) {
  const [fullscreen, setFullscreen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState(false)

  useEffect(() => {
    if (port <= 0) return
    let cancelled = false
    getWsToken()
      .then(t => { if (!cancelled) setToken(t) })
      .catch(() => { if (!cancelled) setTokenError(true) })
    return () => { cancelled = true }
  }, [port])

  if (port <= 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-black rounded-lg p-12 text-center" style={{ minHeight: '500px' }}>
        <Monitor className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-400 mb-2">SPICE Not Available</h3>
        <p className="text-sm text-slate-500 max-w-md">
          VM '{vmName}' doesn't have a SPICE port assigned. Make sure the VM has SPICE graphics configured with QXL video.
        </p>
      </div>
    )
  }

  if (tokenError) {
    return (
      <div className="flex flex-col items-center justify-center bg-black rounded-lg p-12 text-center" style={{ minHeight: '500px' }}>
        <Monitor className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-lg font-semibold text-red-400 mb-2">Authentication Failed</h3>
        <p className="text-sm text-slate-500 max-w-md">Failed to obtain WebSocket token.</p>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center bg-black rounded-lg" style={{ minHeight: '500px' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    )
  }

  const wsHost = window.location.hostname
  const wsPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
  const wsProxyPath = `ws/v1/spice/${encodeURIComponent(vmName)}?token=${encodeURIComponent(token)}`
  const spiceUrl = `/spice-html5/spice_auto.html?host=${wsHost}&port=${wsPort}&path=${encodeURIComponent(wsProxyPath)}`

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-black flex flex-col' : ''}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          <span className="text-sm text-slate-300">SPICE — {vmName}</span>
          <span className="text-xs text-slate-500">port {port}</span>
        </div>
        <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 hover:bg-slate-700 rounded transition" title="Fullscreen">
          {fullscreen ? <Minimize className="w-4 h-4 text-slate-400" /> : <Maximize className="w-4 h-4 text-slate-400" />}
        </button>
      </div>
      <iframe
        src={spiceUrl}
        className={`w-full border-0 rounded-b-lg bg-black ${fullscreen ? 'flex-1' : ''}`}
        style={fullscreen ? { height: '100%' } : { minHeight: '600px' }}
        title={`SPICE console for ${vmName}`}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}

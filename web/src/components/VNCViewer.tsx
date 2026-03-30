import { useState } from 'react'
import { Maximize, Minimize, Monitor } from 'lucide-react'

interface Props {
  vmName: string
  port?: number
}

export default function VNCViewer({ vmName, port = -1 }: Props) {
  const [fullscreen, setFullscreen] = useState(false)

  if (port <= 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-black rounded-lg p-12 text-center" style={{ minHeight: '500px' }}>
        <Monitor className="w-16 h-16 text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-gray-400 mb-2">VNC Not Available</h3>
        <p className="text-sm text-gray-500 max-w-md">
          VM '{vmName}' doesn't have a VNC port assigned. Make sure the VM is running and has VNC graphics configured.
        </p>
        <p className="text-sm text-gray-500 mt-2">Use the <strong>Serial</strong> console instead, or connect via SSH.</p>
      </div>
    )
  }

  // Build noVNC URL — served from the daemon at /novnc/
  // noVNC needs host + port + path to construct the WebSocket URL
  const wsHost = window.location.hostname
  const wsPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
  const wsProxyPath = `ws/v1/vnc/${encodeURIComponent(vmName)}`
  const novncUrl = `/novnc/vnc_lite.html?host=${wsHost}&port=${wsPort}&path=${encodeURIComponent(wsProxyPath)}&scale=true`

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-black flex flex-col' : ''}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-sm text-gray-300">VNC — {vmName}</span>
          <span className="text-xs text-gray-500">port {port}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 hover:bg-gray-700 rounded transition" title="Fullscreen">
            {fullscreen ? <Minimize className="w-4 h-4 text-gray-400" /> : <Maximize className="w-4 h-4 text-gray-400" />}
          </button>
        </div>
      </div>
      <iframe
        src={novncUrl}
        className={`w-full border-0 rounded-b-lg bg-black ${fullscreen ? 'flex-1' : ''}`}
        style={fullscreen ? { height: '100%' } : { minHeight: '600px' }}
        title={`VNC console for ${vmName}`}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}

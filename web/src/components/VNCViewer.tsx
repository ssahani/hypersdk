import { useEffect, useState } from 'react'
import { Maximize, Minimize, ExternalLink, Monitor } from 'lucide-react'

interface Props {
  vmName: string
  host?: string
  port?: number
}

export default function VNCViewer({ vmName, host = '127.0.0.1', port = -1 }: Props) {
  const [fullscreen, setFullscreen] = useState(false)
  const [novncUrl, setNovncUrl] = useState<string | null>(null)

  useEffect(() => {
    if (port > 0) {
      setNovncUrl(`http://${host}:6080/vnc.html?host=${host}&port=${port}&autoconnect=true&resize=scale`)
    }
  }, [host, port])

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

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-gray-900 flex flex-col' : ''}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-sm text-gray-300">VNC — {vmName}</span>
          <span className="text-xs text-gray-500">port {port}</span>
        </div>
        <div className="flex items-center gap-1">
          {novncUrl && (
            <a href={novncUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-700 rounded transition flex items-center gap-1 text-xs text-gray-400" title="Open in noVNC">
              <ExternalLink className="w-4 h-4" /> Open noVNC
            </a>
          )}
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 hover:bg-gray-700 rounded transition" title="Fullscreen">
            {fullscreen ? <Minimize className="w-4 h-4 text-gray-400" /> : <Maximize className="w-4 h-4 text-gray-400" />}
          </button>
        </div>
      </div>

      <div className={`bg-black rounded-b-lg ${fullscreen ? 'flex-1' : ''}`} style={fullscreen ? {} : { minHeight: '500px' }}>
        {novncUrl ? (
          <iframe
            src={novncUrl}
            className="w-full h-full border-0 rounded-b-lg"
            style={{ minHeight: fullscreen ? '100%' : '500px' }}
            title={`VNC console for ${vmName}`}
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 p-8">
            <div className="text-center">
              <p className="mb-2">VNC is available at <code className="bg-gray-800 px-2 py-1 rounded">{host}:{port}</code></p>
              <p className="text-sm">Connect with: <code className="bg-gray-800 px-2 py-1 rounded">vncviewer {host}:{port}</code></p>
              <p className="text-sm mt-2">Or start a noVNC websockify proxy and reload.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

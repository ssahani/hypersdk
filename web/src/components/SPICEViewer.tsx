import { useState } from 'react'
import { Maximize, Minimize, Monitor } from 'lucide-react'

interface Props {
  vmName: string
  port?: number
}

export default function SPICEViewer({ vmName, port = -1 }: Props) {
  const [fullscreen, setFullscreen] = useState(false)

  if (port <= 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-black rounded-lg p-12 text-center" style={{ minHeight: '500px' }}>
        <Monitor className="w-16 h-16 text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-gray-400 mb-2">SPICE Not Available</h3>
        <p className="text-sm text-gray-500 max-w-md">
          VM '{vmName}' doesn't have a SPICE port assigned. Make sure the VM has SPICE graphics configured with QXL video.
        </p>
      </div>
    )
  }

  const wsHost = window.location.hostname
  const wsPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
  const wsProxyPath = `ws/v1/spice/${encodeURIComponent(vmName)}`
  const spiceUrl = `/spice-html5/spice_auto.html?host=${wsHost}&port=${wsPort}&path=${encodeURIComponent(wsProxyPath)}`

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-black flex flex-col' : ''}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          <span className="text-sm text-gray-300">SPICE — {vmName}</span>
          <span className="text-xs text-gray-500">port {port}</span>
        </div>
        <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 hover:bg-gray-700 rounded transition" title="Fullscreen">
          {fullscreen ? <Minimize className="w-4 h-4 text-gray-400" /> : <Maximize className="w-4 h-4 text-gray-400" />}
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

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { ArrowLeft, Terminal as TerminalIcon, Monitor, Tv } from 'lucide-react'
import { apiGet } from '../api/client'
import SerialConsole from '../components/SerialConsole'
import VNCViewer from '../components/VNCViewer'
import SPICEViewer from '../components/SPICEViewer'

interface ConsoleInfo {
  name: string
  console_type: string
  host: string
  port: number
  websocket_port: number
}

type ConsoleMode = 'vnc' | 'spice' | 'serial'

export default function ConsolePage() {
  const { name } = useParams<{ name: string }>()
  const [mode, setMode] = useState<ConsoleMode>('serial')
  const [consoleInfo, setConsoleInfo] = useState<ConsoleInfo | null>(null)
  const [hasVnc, setHasVnc] = useState(false)
  const [hasSpice, setHasSpice] = useState(false)
  const [vncPort, setVncPort] = useState(-1)
  const [spicePort, setSpicePort] = useState(-1)

  useEffect(() => {
    if (!name) return
    apiGet<ConsoleInfo>(`/api/v1/vms/console-info/${encodeURIComponent(name)}`)
      .then((info) => {
        setConsoleInfo(info)
        if (info.console_type === 'vnc' && info.port > 0) {
          setHasVnc(true)
          setVncPort(info.port)
          setMode('vnc')
        } else if (info.console_type === 'spice' && info.port > 0) {
          setHasSpice(true)
          setSpicePort(info.port)
          setMode('spice')
        } else {
          setMode('serial')
        }
      })
      .catch((e) => console.error('Failed to load console info:', e))

    // Also check for SPICE separately (console-info prefers VNC)
    apiGet<string>(`/api/v1/vms/${encodeURIComponent(name)}/xml`)
      .then((xml) => {
        // Check for SPICE graphics
        const spiceMatch = xml.match(/graphics type=['"]spice['"].*?port=['"](\d+)['"]/)
        if (spiceMatch) {
          setHasSpice(true)
          setSpicePort(parseInt(spiceMatch[1]))
        }
        // Check for VNC graphics
        const vncMatch = xml.match(/graphics type=['"]vnc['"].*?port=['"](\d+)['"]/)
        if (vncMatch) {
          setHasVnc(true)
          setVncPort(parseInt(vncMatch[1]))
        }
      })
      .catch(() => {})
  }, [name])

  if (!name) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/vms/${name}`} className="p-2 hover:bg-gray-700 rounded transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Console: {name}</h1>
        </div>

        <div className="flex items-center gap-2">
          {consoleInfo && consoleInfo.port > 0 && (
            <span className="text-xs text-gray-500 mr-2">
              {consoleInfo.console_type.toUpperCase()} port {consoleInfo.port}
            </span>
          )}

          {hasVnc && (
            <button
              onClick={() => setMode('vnc')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                mode === 'vnc' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Monitor className="w-4 h-4" />
              VNC
            </button>
          )}
          {hasSpice && (
            <button
              onClick={() => setMode('spice')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                mode === 'spice' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Tv className="w-4 h-4" />
              SPICE
            </button>
          )}
          <button
            onClick={() => setMode('serial')}
            className={`flex items-center gap-2 px-4 py-2 rounded transition ${
              mode === 'serial' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <TerminalIcon className="w-4 h-4" />
            Serial
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {mode === 'vnc' && <VNCViewer vmName={name} port={vncPort} />}
        {mode === 'spice' && <SPICEViewer vmName={name} port={spicePort} />}
        {mode === 'serial' && <SerialConsole vmName={name} />}
      </div>
    </div>
  )
}

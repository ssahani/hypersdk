import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { ArrowLeft, Terminal as TerminalIcon, Monitor, ExternalLink } from 'lucide-react'
import { apiGet } from '../api/client'
import SerialConsole from '../components/SerialConsole'
import VNCViewer from '../components/VNCViewer'

interface ConsoleInfo {
  name: string
  console_type: string
  host: string
  port: number
  websocket_port: number
}

export default function ConsolePage() {
  const { name } = useParams<{ name: string }>()
  const [mode, setMode] = useState<'serial' | 'vnc'>('serial')
  const [consoleInfo, setConsoleInfo] = useState<ConsoleInfo | null>(null)

  useEffect(() => {
    if (!name) return
    apiGet<ConsoleInfo>(`/api/v1/vms/console-info/${name}`)
      .then(setConsoleInfo)
      .catch(() => {})
  }, [name])

  if (!name) return null

  const vncPort = consoleInfo?.port ?? -1
  const vncHost = consoleInfo?.host ?? '127.0.0.1'

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
          {/* Console info */}
          {consoleInfo && consoleInfo.port > 0 && (
            <span className="text-xs text-gray-500 mr-2">
              {consoleInfo.console_type.toUpperCase()} port {consoleInfo.port}
            </span>
          )}

          {/* External VNC link */}
          {vncPort > 0 && (
            <a
              href={`http://${vncHost}:6080/vnc.html?host=${vncHost}&port=${vncPort}&autoconnect=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              noVNC
            </a>
          )}

          {/* Mode toggle */}
          <button
            onClick={() => setMode('serial')}
            className={`flex items-center gap-2 px-4 py-2 rounded transition ${
              mode === 'serial' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <TerminalIcon className="w-4 h-4" />
            Serial
          </button>
          <button
            onClick={() => setMode('vnc')}
            className={`flex items-center gap-2 px-4 py-2 rounded transition ${
              mode === 'vnc' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Monitor className="w-4 h-4" />
            VNC
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {mode === 'serial' ? (
          <SerialConsole vmName={name} />
        ) : (
          <VNCViewer vmName={name} host={vncHost} port={vncPort} />
        )}
      </div>
    </div>
  )
}

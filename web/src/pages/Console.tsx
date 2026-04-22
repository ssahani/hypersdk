import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { ArrowLeft, Terminal as TerminalIcon, Monitor } from 'lucide-react'
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

export default function ConsolePage() {
  const { name } = useParams<{ name: string }>()
  const [mode, setMode] = useState<'serial' | 'vnc' | 'spice'>('serial')
  const [consoleInfo, setConsoleInfo] = useState<ConsoleInfo | null>(null)

  useEffect(() => {
    if (!name) return
    apiGet<ConsoleInfo>(`/api/v1/vms/console-info/${encodeURIComponent(name)}`)
      .then((info) => {
        setConsoleInfo(info)
        if (info.console_type === 'vnc' && info.port > 0) {
          setMode('vnc')
        } else if (info.console_type === 'spice' && info.port > 0) {
          setMode('spice')
        } else {
          setMode('serial')
        }
      })
      .catch((e) => console.error('Failed to load console info:', e))
  }, [name])

  if (!name) return null

  const vncPort = consoleInfo?.console_type === 'vnc' ? (consoleInfo?.port ?? -1) : -1
  const spicePort = consoleInfo?.console_type === 'spice' ? (consoleInfo?.port ?? -1) : -1

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/vms/${name}`} className="p-2 hover:bg-slate-700 rounded transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Console: {name}</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {consoleInfo && consoleInfo.port > 0 && (
            <span className="text-xs text-slate-500 mr-2">
              {consoleInfo.console_type.toUpperCase()} port {consoleInfo.port}
            </span>
          )}

          {vncPort > 0 && (
            <button
              type="button"
              onClick={() => setMode('vnc')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                mode === 'vnc' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Monitor className="w-4 h-4" />
              VNC
            </button>
          )}
          {spicePort > 0 && (
            <button
              type="button"
              onClick={() => setMode('spice')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition ${
                mode === 'spice' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Monitor className="w-4 h-4" />
              SPICE
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('serial')}
            className={`flex items-center gap-2 px-4 py-2 rounded transition ${
              mode === 'serial' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <TerminalIcon className="w-4 h-4" />
            Serial
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {mode === 'vnc' ? (
          <VNCViewer vmName={name} port={vncPort} />
        ) : mode === 'spice' ? (
          <SPICEViewer vmName={name} port={spicePort} />
        ) : (
          <SerialConsole vmName={name} />
        )}
      </div>
    </div>
  )
}

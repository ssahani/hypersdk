import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { ArrowLeft, Terminal as TerminalIcon, Monitor, Keyboard, Camera, Download } from 'lucide-react'
import { ChoiceCard, ChoiceCardGrid } from '../components/ChoiceCards'
import { apiGet } from '../api/client'
import SerialConsole from '../components/SerialConsole'
import VNCViewer from '../components/VNCViewer'
import SPICEViewer from '../components/SPICEViewer'
import { sendGuestKey, getGuestScreenshotBlob, virtViewerVvUrl } from '../api/vm'
import { useToastContext } from '../contexts/ToastContext'

interface ConsoleInfo {
  name: string
  console_type: string
  host: string
  port: number
  websocket_port: number
}

export default function ConsolePage() {
  const { name } = useParams<{ name: string }>()
  const toast = useToastContext()
  const [mode, setMode] = useState<'serial' | 'vnc' | 'spice'>('serial')
  const [consoleInfo, setConsoleInfo] = useState<ConsoleInfo | null>(null)
  const [shotBusy, setShotBusy] = useState(false)

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

        <div className="flex flex-col items-stretch sm:items-end gap-2 min-w-0 max-w-xl">
          {consoleInfo && consoleInfo.port > 0 && (
            <span className="text-xs text-slate-500 sm:text-right">
              {consoleInfo.console_type.toUpperCase()} port {consoleInfo.port}
            </span>
          )}
          <ChoiceCardGrid className="sm:max-w-lg">
            {vncPort > 0 && (
              <ChoiceCard
                compact
                tone="blue"
                selected={mode === 'vnc'}
                onClick={() => setMode('vnc')}
                icon={<Monitor className="w-4 h-4" />}
                title="VNC"
                description="Graphical console in the browser."
              />
            )}
            {spicePort > 0 && (
              <ChoiceCard
                compact
                tone="purple"
                selected={mode === 'spice'}
                onClick={() => setMode('spice')}
                icon={<Monitor className="w-4 h-4" />}
                title="SPICE"
                description="Graphical SPICE session."
              />
            )}
            <ChoiceCard
              compact
              tone="slate"
              selected={mode === 'serial'}
              onClick={() => setMode('serial')}
              icon={<TerminalIcon className="w-4 h-4" />}
              title="Serial"
              description="Text console over WebSocket."
            />
          </ChoiceCardGrid>
        </div>
      </div>

      {(mode === 'vnc' || mode === 'spice') && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 transition"
            onClick={() => {
              if (!name) return
              void sendGuestKey(name, { preset: 'ctrl_alt_del' })
                .then(() => toast.success('Sent Ctrl+Alt+Del'))
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)))
            }}
          >
            <Keyboard className="w-4 h-4" aria-hidden />
            Ctrl+Alt+Del
          </button>
          <button
            type="button"
            disabled={shotBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 transition disabled:opacity-50"
            onClick={() => {
              if (!name) return
              setShotBusy(true)
              void getGuestScreenshotBlob(name, 0)
                .then((blob) => {
                  const u = URL.createObjectURL(blob)
                  window.open(u, '_blank', 'noopener,noreferrer')
                  setTimeout(() => URL.revokeObjectURL(u), 60_000)
                  toast.success('Screenshot opened in new tab')
                })
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)))
                .finally(() => setShotBusy(false))
            }}
          >
            <Camera className="w-4 h-4" aria-hidden />
            {shotBusy ? 'Screenshot…' : 'Screenshot'}
          </button>
          <a
            href={virtViewerVvUrl(name)}
            download={`${name}.vv`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800/60 hover:bg-emerald-700/70 text-sm text-emerald-100 transition"
          >
            <Download className="w-4 h-4" aria-hidden />
            Virt-Viewer .vv
          </a>
          <span className="text-xs text-slate-500">Keys/screenshot use libvirt on a running guest.</span>
        </div>
      )}

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

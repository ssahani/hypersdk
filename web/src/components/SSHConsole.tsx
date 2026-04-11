import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { RefreshCw, Trash2, Maximize, Minimize } from 'lucide-react'
import { getWsToken } from '../api/client'

interface Props {
  host: string
}

export default function SSHConsole({ host }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const connect = useCallback(async () => {
    if (!terminalRef.current) return

    // Dispose previous
    xtermRef.current?.dispose()
    wsRef.current?.close()

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
      },
      scrollback: 5000,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(terminalRef.current)
    fit.fit()

    xtermRef.current = term
    fitRef.current = fit

    let token: string
    try {
      token = await getWsToken()
    } catch {
      term.write('\r\n\x1b[31m● Failed to obtain WebSocket token\x1b[0m\r\n')
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const encodedHost = encodeURIComponent(host)
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/v1/ssh/${encodedHost}?token=${encodeURIComponent(token)}`)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      term.write('\x1b[32m● Connected to SSH proxy\x1b[0m\r\n\r\n')
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data))
      } else {
        term.write(event.data)
      }
    }
    ws.onerror = () => term.write('\r\n\x1b[31m● Connection error\x1b[0m\r\n')
    ws.onclose = () => {
      setConnected(false)
      term.write('\r\n\x1b[33m● Disconnected\x1b[0m\r\n')
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    })
  }, [host])

  useEffect(() => {
    connect()
    const handleResize = () => fitRef.current?.fit()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      wsRef.current?.close()
      xtermRef.current?.dispose()
    }
  }, [connect])

  const reconnect = () => connect()
  const clear = () => xtermRef.current?.clear()

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-slate-900 flex flex-col' : ''}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-slate-300">SSH Proxy — {host}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clear} className="p-1.5 hover:bg-slate-700 rounded transition" title="Clear"><Trash2 className="w-4 h-4 text-slate-400" /></button>
          <button onClick={reconnect} className="p-1.5 hover:bg-slate-700 rounded transition" title="Reconnect"><RefreshCw className="w-4 h-4 text-slate-400" /></button>
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 hover:bg-slate-700 rounded transition" title="Fullscreen">
            {fullscreen ? <Minimize className="w-4 h-4 text-slate-400" /> : <Maximize className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>
      <div ref={terminalRef} className={`bg-[#0d1117] rounded-b-lg ${fullscreen ? 'flex-1' : ''}`} style={fullscreen ? {} : { minHeight: '500px' }} />
    </div>
  )
}

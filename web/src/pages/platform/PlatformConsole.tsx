// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import ErrorBanner from '../../components/ErrorBanner'
import { getVmConsole, platformVncWsUrl } from '../../api/platform'
import { formatUserError } from '../../utils/apiError'
import AiTerminalCompanion from '../../components/ai/AiTerminalCompanion'

export default function PlatformConsole() {
  const { id } = useParams<{ id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!id || !containerRef.current) return
    let cancelled = false
    let rfb: { disconnect: () => void; addEventListener?: (e: string, fn: () => void) => void } | null = null

    async function connect() {
      try {
        const info = await getVmConsole(id!)
        if (cancelled || !containerRef.current) return
        const wsUrl = platformVncWsUrl(info.ws_path)
        containerRef.current.innerHTML = ''
        const loadRfb = new Function('return import("/novnc/core/rfb.js")')
        const module = await loadRfb() as { default: new (el: HTMLElement, url: string, opts?: object) => { disconnect: () => void; addEventListener: (e: string, fn: () => void) => void } }
        const RFB = module.default
        if (cancelled || !containerRef.current) return
        rfb = new RFB(containerRef.current, wsUrl, { showDotCursor: true })
        rfb.addEventListener?.('connect', () => setStatus('connected'))
        rfb.addEventListener?.('disconnect', () => setStatus('disconnected'))
      } catch (e: unknown) {
        try {
          const { default: RFB } = await import(/* @vite-ignore */ 'novnc-core/lib/rfb')
          if (cancelled || !containerRef.current) return
          const info = await getVmConsole(id!)
          rfb = new RFB(containerRef.current, platformVncWsUrl(info.ws_path), { showDotCursor: true })
          setStatus('connected')
        } catch (inner: unknown) {
          setError(formatUserError(inner ?? e))
          setStatus('error')
        }
      }
    }

    void connect()
    return () => {
      cancelled = true
      rfb?.disconnect()
    }
  }, [id])

  return (
    <div className="space-y-4">
      <Link to={`/platform/vms/${id}`} className="text-sm text-blue-400 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to VM
      </Link>
      {error && <ErrorBanner message={error} />}
      <div className="text-sm text-slate-400">Status: {status}</div>
      <div ref={containerRef} className="w-full min-h-[480px] bg-black rounded-lg overflow-hidden" />
      {id && <AiTerminalCompanion vmName={id} vmId={id} />}
    </div>
  )
}

// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import PageLayout from '../../components/PageLayout'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowLeft, ExternalLink, RefreshCw, Terminal } from 'lucide-react'
import { getPlatformVm, getVmConsole, platformVncWsUrl } from '../../api/platform'
import { formatUserError } from '../../utils/apiError'
import AiTerminalCompanion from '../../components/ai/AiTerminalCompanion'
import VNCViewer from '../../components/VNCViewer'
import { isCenterPopoutMode, openCenterPopout } from '../../utils/platformCenterPopout'
import { hubLinkClasses } from '../../utils/semanticColors'

export default function PlatformConsole() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const isPopout = isCenterPopoutMode(location.search)
  const [vmName, setVmName] = useState<string | null>(null)
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectKey, setConnectKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void Promise.all([
      getVmConsole(id),
      getPlatformVm(id).catch(() => null),
    ])
      .then(([info, vm]) => {
        if (cancelled) return
        setVmName(vm?.name ?? info.vm_name)
        setWsUrl(platformVncWsUrl(info.ws_path))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(formatUserError(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, connectKey])

  return (
    <PageLayout
      compact
      hideHeader={isPopout}
      loading={loading}
      title={vmName ?? 'VM console'}
      subtitle={<span className="text-slate-500">noVNC · same-origin proxy</span>}
      icon={<Terminal className="w-6 h-6 text-slate-400" />}
      prepend={
        !isPopout ? (
          <Link to={`/platform/vms/${id}`} className={`text-sm inline-flex items-center gap-1 ${hubLinkClasses()}`}>
            <ArrowLeft className="w-4 h-4" /> Back to VM
          </Link>
        ) : undefined
      }
      actions={
        !isPopout ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-sm inline-flex items-center gap-1"
              onClick={() => setConnectKey((k) => k + 1)}
            >
              <RefreshCw className="w-4 h-4" /> Reconnect
            </button>
            <button
              type="button"
              className="btn-secondary text-sm inline-flex items-center gap-1"
              onClick={() => openCenterPopout(`/platform/vms/${id}/console`)}
            >
              <ExternalLink className="w-4 h-4" /> Pop out
            </button>
          </div>
        ) : undefined
      }
      error={error}
      errorHints={
        error?.toLowerCase().includes('transport')
          ? ['Ensure machina-agent is running on the host (systemctl status machina-agent)', 'Sync hosts from Platform → Hosts if the host shows offline']
          : undefined
      }
      onErrorRetry={() => setConnectKey((k) => k + 1)}
      className={isPopout ? 'h-[calc(100dvh-3rem)] flex flex-col min-h-0' : 'flex flex-col min-h-0'}
      contentClassName="flex flex-col flex-1 min-h-0"
    >
      {wsUrl && vmName && (
        <VNCViewer
          key={connectKey}
          vmName={vmName}
          wsUrl={wsUrl}
          defaultScaledFit
          fillViewport
          fillViewportOffset={isPopout ? '5.5rem' : '17rem'}
        />
      )}
      {id && !isPopout && wsUrl && <AiTerminalCompanion vmName={vmName ?? id} vmId={id} />}
    </PageLayout>
  )
}

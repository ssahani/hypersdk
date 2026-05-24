import { Link } from 'react-router'
import { Settings, Wifi, WifiOff, AlertCircle, RefreshCw } from 'lucide-react'
import { useOpenStackConnection } from '../hooks/useOpenStackConnection'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'
import { useToastContext } from '../contexts/ToastContext'
import { useState } from 'react'

/** Live OpenStack connection summary for cloud pages. */
export default function OpenStackStatusBar() {
  const { info } = usePlatformInfo()
  const toast = useToastContext()
  const { phase, status, testConnection, cloudName, computeLive, glanceLive } = useOpenStackConnection()
  const [testing, setTesting] = useState(false)

  if (phase === 'off' || phase === 'needsWire') {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-2 font-medium text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          OpenStack not wired on this host
        </span>
        <span className="text-xs text-slate-400">
          enabled={info?.openstack?.enabled ? 'yes' : 'no'} · configured=
          {info?.openstack?.configured ? 'yes' : 'no'}
        </span>
        <Link
          to="/settings?openstack=1"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 text-xs ml-auto"
        >
          <Settings className="w-3.5 h-3.5" />
          Wire &amp; settings
        </Link>
      </div>
    )
  }

  const reachable = phase === 'live'

  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm ${
        reachable
          ? 'border border-sky-500/30 bg-sky-950/25'
          : 'border border-red-500/35 bg-red-950/20'
      }`}
    >
      <span className="inline-flex items-center gap-2 font-medium text-slate-200">
        {reachable ? (
          <Wifi className="w-4 h-4 text-emerald-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-400" />
        )}
        {cloudName || 'OpenStack'}
        {!reachable && <span className="text-xs text-red-300 font-normal">· unreachable</span>}
      </span>
      {reachable && (
        <span className="text-xs text-slate-400">
          Keystone
          {computeLive ? ' · Nova' : ' · Nova off'}
          {glanceLive ? ' · Glance' : ' · Glance off'}
        </span>
      )}
      {reachable && computeLive && status?.instance_count != null && (
        <span className="text-slate-400">
          {status.instance_count} instance{status.instance_count === 1 ? '' : 's'}
        </span>
      )}
      {reachable && glanceLive && status?.image_count != null && (
        <span className="text-slate-400">
          · {status.image_count} image{status.image_count === 1 ? '' : 's'}
        </span>
      )}
      {info?.openstack?.upload_enabled && reachable && glanceLive && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          Glance upload on
        </span>
      )}
      {status?.error && reachable && (
        <span className="text-xs text-amber-300/90 truncate max-w-md" title={status.error}>
          {status.error}
        </span>
      )}
      {status?.error && !reachable && (
        <span className="text-xs text-red-300 truncate max-w-md" title={status.error}>
          {status.error}
        </span>
      )}
      <div className="flex flex-wrap gap-2 ml-auto">
        <button
          type="button"
          disabled={testing}
          onClick={async () => {
            setTesting(true)
            try {
              const s = await testConnection()
              toast.success(s.reachable ? 'OpenStack OK' : 'Still unreachable')
            } catch (e: unknown) {
              toast.error(e instanceof Error ? e.message : String(e))
            } finally {
              setTesting(false)
            }
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs disabled:opacity-50 ${
            reachable
              ? 'border-sky-500/40 text-sky-200 hover:bg-sky-500/10'
              : 'border-red-500/40 text-red-200 hover:bg-red-500/10'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
          {testing ? 'Testing…' : 'Test'}
        </button>
        <Link
          to="/settings?openstack=1"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-xs"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </Link>
      </div>
    </div>
  )
}

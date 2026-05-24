import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  getOpenStackStatus,
  postOpenStackTestConnection,
  type OpenStackConnectionStatus,
} from '../api/openstack'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'
import { isOpenStackNavEnabled } from '../utils/routes'
import { useToastContext } from '../contexts/ToastContext'
import { RefreshCw, Settings, Wifi, WifiOff } from 'lucide-react'

/** Live OpenStack connection summary for cloud pages. */
export default function OpenStackStatusBar() {
  const { info, refreshKey } = usePlatformInfo()
  const toast = useToastContext()
  const ready = isOpenStackNavEnabled(info?.openstack)
  const [status, setStatus] = useState<OpenStackConnectionStatus | null>(null)
  const [testing, setTesting] = useState(false)

  const load = useCallback(async () => {
    try {
      setStatus(await getOpenStackStatus())
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  if (!ready) return null

  const reachable = Boolean(status?.reachable)

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-950/25 px-4 py-3 text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-slate-200">
        {reachable ? (
          <Wifi className="w-4 h-4 text-emerald-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-amber-400" />
        )}
        {status?.cloud_name || info?.openstack?.cloud_name || 'OpenStack'}
      </span>
      {status?.instance_count != null && (
        <span className="text-slate-400">
          {status.instance_count} instance{status.instance_count === 1 ? '' : 's'}
        </span>
      )}
      {status?.image_count != null && (
        <span className="text-slate-400">
          · {status.image_count} image{status.image_count === 1 ? '' : 's'}
        </span>
      )}
      {info?.openstack?.upload_enabled && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          Glance upload on
        </span>
      )}
      {status?.error && (
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
              const s = await postOpenStackTestConnection()
              setStatus(s)
              toast.success(s.reachable ? 'OpenStack OK' : 'Auth OK but API list failed')
            } catch (e: unknown) {
              toast.error(e instanceof Error ? e.message : String(e))
            } finally {
              setTesting(false)
            }
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-sky-500/40 text-sky-200 hover:bg-sky-500/10 text-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
          Test
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

import { Link } from 'react-router'
import { Cloud, Settings, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useOpenStackConnection } from '../hooks/useOpenStackConnection'
import { useToastContext } from '../contexts/ToastContext'
import ErrorBanner from './ErrorBanner'
import CopyButton from './CopyButton'
import { VERIFY_COMMANDS, WIRE_SCRIPT, openStackErrorHints } from '../utils/openstackHints'

/** Shown when OpenStack is configured in Machina but Keystone/API is not reachable. */
export default function OpenStackUnreachablePanel() {
  const { status, testConnection, cloudName } = useOpenStackConnection()
  const toast = useToastContext()
  const [testing, setTesting] = useState(false)
  const error = status?.error || 'Could not reach OpenStack API'
  const hints = openStackErrorHints(status?.error)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-red-500/35 bg-gradient-to-br from-red-950/30 via-slate-900/60 to-slate-900/40 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <Cloud className="w-5 h-5 text-red-300" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-lg font-semibold text-red-100">
              Cloud configured but not reachable
              {cloudName ? ` (${cloudName})` : ''}
            </h2>
            <p className="text-sm text-slate-400">
              Machina has credentials on this host, but Nova/Glance APIs are not responding. Install or start
              OpenStack services before managing instances from the UI.
            </p>
          </div>
        </div>
      </div>

      <ErrorBanner
        title="Connection error"
        headline={error.length > 200 ? `${error.slice(0, 197)}…` : error}
        hints={hints}
        technicalDetail={status?.error}
        tone="red"
        actions={
          <>
            <button
              type="button"
              disabled={testing}
              onClick={async () => {
                setTesting(true)
                try {
                  const s = await testConnection()
                  toast.success(s.reachable ? 'OpenStack is reachable' : 'Still unreachable — see error')
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : String(e))
                } finally {
                  setTesting(false)
                }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-sky-500/40 text-sky-200 hover:bg-sky-500/10 text-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              Test connection
            </button>
            <CopyButton text={VERIFY_COMMANDS} label="Copy verify commands" />
            <Link
              to="/settings?openstack=1"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-xs"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </Link>
          </>
        }
      />

      <div className="rounded-lg bg-slate-950/60 border border-slate-700/60 p-3 text-xs text-slate-400 font-mono">
        <p className="text-slate-500 mb-2">Re-wire after fixing keystonerc:</p>
        <code className="block text-amber-100/90 whitespace-pre-wrap break-all">{WIRE_SCRIPT}</code>
        <div className="mt-2">
          <CopyButton text={WIRE_SCRIPT} label="Copy wire script" />
        </div>
      </div>
    </div>
  )
}

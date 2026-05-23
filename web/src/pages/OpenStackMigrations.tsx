import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  getHypersdkStatus,
  listHypersdkMigrationJobs,
  listHypersdkProviderVms,
  type HypersdkMigrationJob,
  type HypersdkProviderVm,
} from '../api/hypersdk'
import OpenStackFooter from '../components/OpenStackFooter'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'
import { useToastContext } from '../contexts/ToastContext'
import { isOpenStackNavEnabled } from '../utils/routes'
import { Cloud, ExternalLink, RefreshCw, Server } from 'lucide-react'

export default function OpenStackMigrationsPage() {
  const toast = useToastContext()
  const { info } = usePlatformInfo()
  const openstackReady = isOpenStackNavEnabled(info?.openstack)
  const hypersdkEnabled = Boolean(info?.hypersdk?.enabled)

  const [status, setStatus] = useState<Awaited<ReturnType<typeof getHypersdkStatus>> | null>(null)
  const [vms, setVms] = useState<HypersdkProviderVm[]>([])
  const [jobs, setJobs] = useState<HypersdkMigrationJob[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!hypersdkEnabled) {
      setLoading(false)
      return
    }
    try {
      const [st, vmRes, jobRes] = await Promise.all([
        getHypersdkStatus(),
        listHypersdkProviderVms('openstack').catch(() => ({ vms: [] })),
        listHypersdkMigrationJobs().catch(() => ({ jobs: [] })),
      ])
      setStatus(st)
      const vmList = Array.isArray(vmRes) ? vmRes : vmRes.vms ?? []
      setVms(vmList)
      setJobs(jobRes.jobs ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [hypersdkEnabled, toast])

  useEffect(() => {
    void load()
  }, [load])

  const dashboardUrl = info?.openstack?.hypersdk_base_url
    ? `${info.openstack.hypersdk_base_url.replace(/\/$/, '')}/web/dashboard/`
    : info?.hypersdk?.base_url
      ? `${info.hypersdk.base_url.replace(/\/$/, '')}/web/dashboard/`
      : 'https://127.0.0.1:5080/web/dashboard/'

  if (!openstackReady) {
    return (
      <div className="text-slate-400 text-sm">
        Configure OpenStack in Settings first.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Cloud className="w-7 h-7 text-sky-400" />
            Bulk migrations
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            HyperSDK pipelines for multi-VM export and conversion (proxied through machina-daemon when enabled).
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            HyperSDK dashboard
          </a>
          <button
            type="button"
            onClick={() => { setLoading(true); void load() }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {!hypersdkEnabled && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 text-sm text-amber-100">
          Enable <code className="text-amber-50">[hypersdk] enabled = true</code> and set{' '}
          <code className="text-amber-50">base_url</code> to hypervisord (default :5080), then restart machina-daemon.
        </div>
      )}

      {hypersdkEnabled && status && (
        <div className="rounded-xl border border-slate-700/80 p-4 text-sm">
          <span className="text-slate-400">HyperSDK: </span>
          <span className={status.reachable ? 'text-green-400' : 'text-red-400'}>
            {status.reachable ? 'reachable' : 'unreachable'}
          </span>
          <span className="text-slate-500 ml-2 font-mono text-xs">{status.base_url}</span>
          {status.last_error && (
            <p className="text-red-300 text-xs mt-2">{status.last_error}</p>
          )}
        </div>
      )}

      <section className="rounded-xl border border-slate-700/80 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/80 flex items-center gap-2">
          <Server className="w-4 h-4 text-sky-400" />
          <h2 className="font-medium text-slate-200">OpenStack VMs (HyperSDK)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading && vms.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>
              )}
              {!loading && vms.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  No VMs from HyperSDK. Connect OpenStack in the HyperSDK dashboard first.
                </td></tr>
              )}
              {vms.map((vm) => (
                <tr key={vm.id ?? vm.name} className="hover:bg-slate-800/40">
                  <td className="px-4 py-2 text-slate-200">{vm.name}</td>
                  <td className="px-4 py-2">{vm.status ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{vm.id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-xs text-slate-500">
          Single-VM flows: <Link to="/openstack/instances" className="text-sky-400 hover:underline">Machina OpenStack instances</Link>
          {' '}or <Link to="/vms" className="text-sky-400 hover:underline">Push libvirt VM to Glance</Link>.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700/80 overflow-hidden">
        <h2 className="px-4 py-3 border-b border-slate-700/80 font-medium text-slate-200">Recent migration jobs</h2>
        <ul className="divide-y divide-slate-800 text-sm">
          {jobs.length === 0 && (
            <li className="px-4 py-6 text-center text-slate-500">No jobs reported.</li>
          )}
          {jobs.map((j) => (
            <li key={j.job_id ?? j.id} className="px-4 py-3 flex justify-between gap-4">
              <span className="text-slate-200">{j.vm_name ?? j.job_id ?? j.id}</span>
              <span className="text-slate-400">{j.status ?? '—'}</span>
            </li>
          ))}
        </ul>
      </section>

      <OpenStackFooter />
    </div>
  )
}

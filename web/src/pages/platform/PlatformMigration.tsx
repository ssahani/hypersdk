// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRightLeft, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Play } from 'lucide-react'
import { MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import { getHypersdkStatus, listHypersdkProviders, listHypersdkProviderVms, submitHypersdkMigration } from '../../api/hypersdk'
import { getGuestkitStatus, guestkitDoctor } from '../../api/guestkit'
import { getMigrationAdvisor, type MigrationAdvisorReport } from '../../api/ai'
import { usePlatformInfo } from '../../contexts/PlatformInfoContext'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

const SOURCES = [
  { id: 'vcenter', label: 'VMware vCenter', desc: 'Scan via HyperSDK when enabled' },
  { id: 'esxi', label: 'ESXi Host', desc: 'Direct ESXi connection' },
  { id: 'ova', label: 'OVF / OVA File', desc: 'Upload and convert' },
  { id: 'vmdk', label: 'VMDK File', desc: 'Single disk import' },
  { id: 'openstack', label: 'OpenStack', desc: 'Glance image import' },
  { id: 'cloud', label: 'Cloud Image', desc: 'Ubuntu/RHEL cloud images' },
]

type ScanVm = { name: string; status: string; os: string; note: string; provider?: string; advisor?: MigrationAdvisorReport }

export default function PlatformMigration() {
  const { info } = usePlatformInfo()
  const toast = useToastContext()
  const hypersdk = Boolean(info?.hypersdk?.enabled)
  const guestkit = Boolean(info?.guestkit?.enabled)
  const [gkStatus, setGkStatus] = useState<Awaited<ReturnType<typeof getGuestkitStatus>> | null>(null)
  const [diskPath, setDiskPath] = useState('')
  const [gkSummary, setGkSummary] = useState<string | null>(null)
  const [status, setStatus] = useState<{ reachable?: boolean } | null>(null)
  const [scan, setScan] = useState<ScanVm[]>([])
  const [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState('vmware')
  const [migrating, setMigrating] = useState<string | null>(null)

  const scanSource = useCallback(async (p: string) => {
    setLoading(true)
    setProvider(p)
    try {
      const vms = await listHypersdkProviderVms(p) as { vms?: Array<{ name: string; status?: string; id?: string }> }
      const list = await Promise.all((vms.vms ?? []).slice(0, 10).map(async (v) => {
        let advisor: MigrationAdvisorReport | undefined
        try {
          advisor = await getMigrationAdvisor(v.name, p, undefined, diskPath.trim() || undefined)
        } catch { /* optional */ }
        return {
          name: v.name,
          status: advisor && advisor.readiness_percent >= 70 ? 'ready' as const : advisor ? 'check' as const : 'ready' as const,
          os: 'Detected from source',
          note: advisor ? `Readiness ${advisor.readiness_percent}%` : (v.status ?? 'Ready for HyperSDK migration'),
          provider: p,
          advisor,
        }
      }))
      setScan(list.length ? list : [{ name: '(no VMs)', status: 'check', os: '—', note: 'No VMs returned from provider' }])
    } catch {
      setScan([{ name: 'Scan failed', status: 'unsupported', os: '—', note: 'Check HyperSDK connectivity' }])
    } finally {
      setLoading(false)
    }
  }, [])

  const migrateVm = async (vm: ScanVm) => {
    if (!hypersdk || vm.name.startsWith('(')) return
    setMigrating(vm.name)
    try {
      const r = await submitHypersdkMigration({
        provider: vm.provider ?? provider,
        vm_name: vm.name,
        target: 'libvirt',
      })
      toast.success(`Migration submitted${r.job_id ? ` — job ${r.job_id}` : ''}`)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setMigrating(null)
    }
  }

  useEffect(() => {
    if (guestkit) {
      void getGuestkitStatus().then(setGkStatus).catch(() => {})
    }
  }, [guestkit])

  useEffect(() => {
    if (!hypersdk) return
    void (async () => {
      try {
        setStatus(await getHypersdkStatus())
        const prov = await listHypersdkProviders() as { providers?: Array<{ provider: string }> }
        const first = prov.providers?.[0]?.provider ?? 'vmware'
        await scanSource(first)
      } catch { /* optional */ }
    })()
  }, [hypersdk, scanSource])

  return (
    <div className="space-y-8 max-w-4xl animate-fade-in">
      <MacSectionTitle title="Migration Radar" subtitle="Machina Migration Radar — HyperSDK scan + GuestKit offline assurance." />

      {guestkit && gkStatus && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-100 space-y-2">
          <p>GuestKit {gkStatus.library_version ?? 'linked'} — {gkStatus.summary}</p>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="block flex-1 min-w-[14rem]">
              <span className="text-xs text-orange-200/70">Offline disk path (qcow2/vmdk)</span>
              <input className="input text-sm mt-1 w-full" placeholder="/var/lib/libvirt/images/vm.qcow2" value={diskPath} onChange={(e) => setDiskPath(e.target.value)} />
            </label>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={!diskPath.trim()}
              onClick={async () => {
                try {
                  const r = await guestkitDoctor(diskPath.trim(), 'kvm', true)
                  setGkSummary(`${r.boot_score.toFixed(0)}% boot · ${r.summary}`)
                } catch (e: unknown) {
                  setGkSummary(e instanceof Error ? e.message : 'GuestKit doctor failed')
                }
              }}
            >
              GuestKit doctor
            </button>
          </div>
          {gkSummary && <p className="text-xs text-orange-200/80">{gkSummary}</p>}
        </div>
      )}

      {hypersdk && status?.reachable && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          HyperSDK is connected. Select a VM and click Migrate to submit a conversion job.
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Where is your VM coming from?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={loading || (s.id === 'vcenter' && !hypersdk)}
              onClick={() => s.id === 'vcenter' && void scanSource('vmware')}
              className="text-left p-4 rounded-2xl border border-white/[0.06] bg-slate-900/50 hover:border-white/10 transition disabled:opacity-50"
            >
              <p className="font-semibold text-slate-100">{s.label}</p>
              <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="platform-mac-panel rounded-2xl border border-white/[0.06] p-5 space-y-4">
        <h2 className="font-semibold">Scan results</h2>
        {loading && <p className="text-sm text-slate-400">Scanning source…</p>}
        {scan.length > 0 && (
          <ul className="divide-y divide-slate-800">
            {scan.map((vm) => (
              <li key={vm.name} className="py-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.04] bg-slate-900/30 px-3 mb-2">
                <div>
                  <p className="font-medium">{vm.name}</p>
                  <p className="text-xs text-slate-500">{vm.os} · {vm.note}</p>
                  {vm.advisor && (
                    <div className="mt-2 text-xs space-y-1">
                      <p className="text-slate-400">Readiness: <span className="text-emerald-300">{vm.advisor.readiness_percent}%</span></p>
                      {vm.advisor.guestkit_summary && (
                        <p className="text-orange-200/90">GuestKit: {vm.advisor.guestkit_summary}</p>
                      )}
                      {vm.advisor.firewall_migration_summary && (
                        <p className="text-blue-200/90">Firewall: {vm.advisor.firewall_migration_summary}</p>
                      )}
                      {vm.advisor.risks.length > 0 && (
                        <ul className="text-amber-300/90 list-disc pl-4">{vm.advisor.risks.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}</ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs flex items-center gap-1 ${vm.status === 'ready' ? 'text-emerald-400' : vm.status === 'check' ? 'text-amber-400' : 'text-red-400'}`}>
                    {vm.status === 'ready' ? <CheckCircle2 className="w-3 h-3" /> : vm.status === 'check' ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {vm.status}
                  </span>
                  {hypersdk && vm.status === 'ready' && (
                    <button type="button" className="btn-primary text-xs flex items-center gap-1" disabled={migrating === vm.name} onClick={() => void migrateVm(vm)}>
                      <Play className="w-3 h-3" /> {migrating === vm.name ? 'Submitting…' : 'Migrate'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-600 flex flex-wrap gap-3">
          <Link to="/import" className="text-blue-400 inline-flex items-center gap-1">Single-VM import <ExternalLink className="w-3 h-3" /></Link>
          {hypersdk && <Link to="/openstack/migrations" className="text-blue-400">OpenStack migrations →</Link>}
          <Link to="/platform/tasks" className="text-blue-400">View migration tasks →</Link>
        </p>
      </section>
    </div>
  )
}

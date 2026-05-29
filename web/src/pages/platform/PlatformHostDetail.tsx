// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Server } from 'lucide-react'
import { MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import { getPlatformHostDetail, hostMaintenance, syncHost, fenceHost, patchHost, enqueueValidateHost, type PlatformHostDetail } from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

export default function PlatformHostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToastContext()
  const [host, setHost] = useState<PlatformHostDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [fenceMethod, setFenceMethod] = useState('shell')
  const [ipmiAddress, setIpmiAddress] = useState('')
  const [ipmiUser, setIpmiUser] = useState('')
  const [ipmiPass, setIpmiPass] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    try { const h = await getPlatformHostDetail(id); setHost(h); setNotes(h.notes || '') } catch (e: unknown) { setError(formatUserError(e)) }
  }, [id])

  useEffect(() => { void load() }, [load])

  if (!id) return null

  return (
    <div className="space-y-6">
      <Link to="/platform/hosts" className="text-sm text-blue-400 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Hosts</Link>
      {error && <ErrorBanner message={error} />}
      {host && (
        <>
          <MacSectionTitle title={host.hostname} subtitle={`${host.validation_status || 'pending'} · ${host.state}${host.fenced ? ' · fenced' : ''}`} />
          {(host.validation_report?.length ?? 0) > 0 && (
            <section className="card p-4 space-y-2">
              <h3 className="font-semibold text-sm">Join validation checklist</h3>
              <ul className="text-sm space-y-2">
                {host.validation_report!.map((c) => (
                  <li key={c.name} className={c.passed ? 'text-emerald-400' : 'text-red-400'}>
                    <span className="font-mono text-xs">{c.name}</span>: {c.message}
                    {c.remediation && !c.passed && (
                      <p className="text-slate-500 text-xs mt-0.5">→ {c.remediation}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn-secondary" onClick={async () => { await syncHost(id); toast.success('Sync queued') }}>Sync</button>
            <button type="button" className="btn-secondary" onClick={async () => {
              try { await enqueueValidateHost(id); toast.success('Validation queued'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) }
            }}>Validate</button>
            <button type="button" className="btn-secondary" onClick={async () => { await hostMaintenance(id, 'enter'); toast.success('Maintenance') }}>Maintenance</button>
            <button type="button" className="btn-danger" onClick={async () => {
              try { await fenceHost(id); toast.success('Fence invoked'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) }
            }}>Fence host</button>
          </div>
          <div className="card p-4 grid gap-2 text-sm md:grid-cols-2">
            <div>CPU model: {host.cpu_model || '—'}</div>
            <div>Libvirt: {host.libvirt_version || '—'}</div>
            <div>QEMU: {host.qemu_version || '—'}</div>
            <div>Load: CPU {host.cpu_percent?.toFixed(0)}% · mem {host.memory_used_mib}/{host.memory_total_mib} MiB</div>
            <div>Agent: {host.agent_grpc_addr}</div>
            <div>Console: {host.agent_console_addr}</div>
            <div className="md:col-span-2 font-mono text-xs">URI: {host.libvirt_uri}</div>
          </div>
          <div className="card p-4 space-y-2">
            <label className="text-xs text-slate-500">Notes</label>
            <textarea className="input min-h-20 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button type="button" className="btn-secondary text-sm" onClick={async () => {
              try { await patchHost(id, { notes }); toast.success('Notes saved'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) }
            }}>Save notes</button>
          </div>
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm">Fencing (IPMI / shell)</h3>
            <select className="input" value={fenceMethod} onChange={(e) => setFenceMethod(e.target.value)}>
              <option value="shell">Shell command</option>
              <option value="ipmi">IPMI (ipmitool)</option>
            </select>
            {fenceMethod === 'ipmi' && (
              <>
                <input className="input" placeholder="IPMI BMC address" value={ipmiAddress} onChange={(e) => setIpmiAddress(e.target.value)} />
                <input className="input" placeholder="IPMI username" value={ipmiUser} onChange={(e) => setIpmiUser(e.target.value)} />
                <input className="input" type="password" placeholder="IPMI password" value={ipmiPass} onChange={(e) => setIpmiPass(e.target.value)} />
              </>
            )}
            <button type="button" className="btn-secondary text-sm" onClick={async () => {
              try {
                await patchHost(id, {
                  fence_method: fenceMethod,
                  ipmi_address: ipmiAddress,
                  ipmi_username: ipmiUser,
                  ipmi_password: ipmiPass || undefined,
                })
                toast.success('Fence config saved')
              } catch (e: unknown) { toast.error(formatUserError(e)) }
            }}>Save fence config</button>
          </div>
        </>
      )}
    </div>
  )
}

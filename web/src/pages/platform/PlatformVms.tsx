// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LayoutGrid, List, Plus, RefreshCw, Server } from 'lucide-react'
import { StructuredErrorBanner } from '../../components/StructuredErrorBanner'
import VmCard from '../../components/platform/VmCard'
import PlatformEmptyState from '../../components/platform/PlatformEmptyState'
import PlatformFilterPills from '../../components/platform/PlatformFilterPills'
import { MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import SimpleCreateVmWizard, { sizeToSpec } from '../../components/platform/SimpleCreateVmWizard'
import WindowsCreateWizard from '../../components/platform/WindowsCreateWizard'
import MigratePrecheckModal from '../../components/platform/MigratePrecheckModal'
import {
  adoptPlatformVm,
  createPlatformVm,
  listPlatformHosts,
  listPlatformVms,
  type CreatePlatformVmBody,
  type PlatformApiError,
  type PlatformHost,
  type PlatformVm,
} from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

type ViewMode = 'grid' | 'list'
type VmFilter = 'all' | 'running' | 'stopped' | 'discovered'

export default function PlatformVms() {
  const toast = useToastContext()
  const [vms, setVms] = useState<PlatformVm[]>([])
  const [hosts, setHosts] = useState<PlatformHost[]>([])
  const [error, setError] = useState<{ message: string; error_code?: string; remediation?: string } | null>(null)
  const [vmFilter, setVmFilter] = useState<VmFilter>('all')
  const [view, setView] = useState<ViewMode>('grid')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [windowsOpen, setWindowsOpen] = useState(false)
  const [dragVmId, setDragVmId] = useState<string | null>(null)
  const [migrateModal, setMigrateModal] = useState<{ vm: PlatformVm; destId: string; destName: string } | null>(null)
  const [dropHost, setDropHost] = useState<string | null>(null)

  const hostMap = useMemo(() => new Map(hosts.map((h) => [h.id, h.hostname])), [hosts])
  const vmById = useMemo(() => new Map(vms.map((v) => [v.id, v])), [vms])

  const load = useCallback(async () => {
    setError(null)
    try {
      const needDiscovered = vmFilter === 'discovered'
      const [v, h] = await Promise.all([
        listPlatformVms(needDiscovered ? { managed: false } : undefined),
        listPlatformHosts(),
      ])
      setVms(v)
      setHosts(h)
    } catch (e: unknown) {
      const err = e as PlatformApiError
      setError({
        message: err.message || formatUserError(e),
        error_code: err.error_code,
        remediation: err.remediation,
      })
    }
  }, [vmFilter])

  useEffect(() => { void load() }, [load])

  const filteredVms = useMemo(() => {
    if (vmFilter === 'discovered') return vms.filter((v) => v.managed === false)
    if (vmFilter === 'running') return vms.filter((v) => v.observed_state === 'running')
    if (vmFilter === 'stopped') return vms.filter((v) => v.observed_state !== 'running')
    return vms
  }, [vms, vmFilter])

  const counts = useMemo(() => ({
    all: vms.length,
    running: vms.filter((v) => v.observed_state === 'running').length,
    stopped: vms.filter((v) => v.observed_state !== 'running').length,
    discovered: vms.filter((v) => v.managed === false).length,
  }), [vms])

  const buildVmBody = (name: string, os: string, size: string, network: string, extraTags: string[] = []): CreatePlatformVmBody => {
    const spec = sizeToSpec(size)
    return {
      api_version: 'virt.zyvor.dev/v1',
      kind: 'VirtualMachine',
      metadata: { name },
      tags: [os, network, ...extraTags],
      spec: {
        cpu: { sockets: 1, cores: spec.cores },
        memory: spec.memory,
        storage: [{ name: 'root', size: spec.disk, class: 'silver' }],
        network: [{ network, ip_mode: 'dhcp' }],
      },
    }
  }

  const handleCreate = async (payload: { name: string; os: string; size: string; network: string }) => {
    await createPlatformVm(buildVmBody(payload.name, payload.os, payload.size, payload.network))
    toast.success('Create task queued')
    await load()
  }

  const handleWindowsCreate = async (payload: {
    name: string
    os: string
    size: string
    network: string
    windows: { virtio: boolean; uefi: boolean; tpm: boolean; secureBoot: boolean; rdp: boolean }
  }) => {
    const spec = sizeToSpec(payload.size)
    const labels: Record<string, string> = { os_family: 'windows' }
    if (payload.windows.tpm) labels.tpm = 'true'
    if (payload.windows.secureBoot) labels.secure_boot = 'true'
    if (payload.windows.virtio) labels.virtio_win = 'true'
    if (payload.windows.rdp) labels.rdp = 'true'
    const body: CreatePlatformVmBody = {
      api_version: 'virt.zyvor.dev/v1',
      kind: 'VirtualMachine',
      metadata: { name: payload.name, labels },
      tags: ['windows', payload.os, payload.network],
      spec: {
        cpu: { sockets: 1, cores: spec.cores },
        memory: spec.memory,
        firmware: payload.windows.uefi ? 'uefi' : 'bios',
        storage: [{ name: 'root', size: spec.disk, class: 'silver' }],
        network: [{ network: payload.network, ip_mode: 'dhcp' }],
      },
    }
    await createPlatformVm(body)
    toast.success('Windows VM create queued')
    await load()
  }

  const onHostDrop = (hostId: string) => {
    const vmId = dragVmId
    setDropHost(null)
    setDragVmId(null)
    if (!vmId) return
    const vm = vmById.get(vmId)
    const host = hosts.find((h) => h.id === hostId)
    if (!vm || !host || vm.host_id === hostId) return
    setMigrateModal({ vm, destId: hostId, destName: host.hostname })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <MacSectionTitle title="Virtual Machines" subtitle="Finder-style browse — drag a VM onto a host to migrate." />
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-white/[0.06] overflow-hidden">
            <button type="button" className={`p-2 ${view === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400'}`} onClick={() => setView('grid')} aria-label="Grid view"><LayoutGrid className="w-4 h-4" /></button>
            <button type="button" className={`p-2 ${view === 'list' ? 'bg-slate-800 text-white' : 'text-slate-400'}`} onClick={() => setView('list')} aria-label="List view"><List className="w-4 h-4" /></button>
          </div>
          <button type="button" className="btn-secondary" onClick={() => void load()}><RefreshCw className="w-4 h-4" /></button>
          <button type="button" className="btn-secondary" onClick={() => setWindowsOpen(true)}>Windows VM</button>
          <button type="button" className="btn-primary flex items-center gap-2" onClick={() => setWizardOpen(true)}><Plus className="w-4 h-4" /> Create VM</button>
        </div>
      </header>

      <PlatformFilterPills
        value={vmFilter}
        onChange={(id) => setVmFilter(id as VmFilter)}
        options={[
          { id: 'all', label: 'All', count: counts.all },
          { id: 'running', label: 'Running', count: counts.running },
          { id: 'stopped', label: 'Stopped', count: counts.stopped },
          { id: 'discovered', label: 'Discovered', count: counts.discovered },
        ]}
      />

      {error && <StructuredErrorBanner error={error} />}

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {filteredVms.length === 0 && !error ? (
            <PlatformEmptyState title="No virtual machines" subtitle="Create a VM or sync hosts to discover libvirt domains.">
              <button type="button" className="btn-primary mt-3" onClick={() => setWizardOpen(true)}>Create VM</button>
            </PlatformEmptyState>
          ) : view === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredVms.map((v) => (
                <VmCard
                  key={v.id}
                  vm={v}
                  draggable
                  onDragStart={() => setDragVmId(v.id)}
                  hostLabel={v.host_id ? hostMap.get(v.host_id) : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="platform-mac-panel rounded-2xl border border-white/[0.06] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/[0.04]">
                    <th className="p-3">Name</th>
                    <th className="p-3">State</th>
                    <th className="p-3">Host</th>
                    <th className="p-3">vCPU</th>
                    <th className="p-3">Memory</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredVms.map((v) => (
                    <tr key={v.id} className="border-b border-slate-900/80 hover:bg-white/[0.02]">
                      <td className="p-3"><Link to={`/platform/vms/${v.id}`} className="text-blue-400 hover:underline">{v.name}</Link></td>
                      <td className="p-3 capitalize">{v.observed_state}</td>
                      <td className="p-3 text-slate-500">{v.host_id ? hostMap.get(v.host_id) : '—'}</td>
                      <td className="p-3">{v.vcpus}</td>
                      <td className="p-3">{Math.round(v.memory_mib / 1024)} Gi</td>
                      <td className="p-3">
                        {v.managed === false && (
                          <button type="button" className="btn-secondary text-xs" onClick={async () => {
                            try { await adoptPlatformVm(v.id); toast.success('Adopted'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) }
                          }}>Adopt</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="xl:w-56 shrink-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1"><Server className="w-3 h-3" /> Drop VM to migrate</p>
          {hosts.map((h) => (
            <div
              key={h.id}
              onDragOver={(e) => { e.preventDefault(); setDropHost(h.id) }}
              onDragLeave={() => setDropHost(null)}
              onDrop={(e) => { e.preventDefault(); onHostDrop(h.id) }}
              className={`rounded-xl border p-3 text-sm transition ${
                dropHost === h.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/[0.06] bg-slate-900/40'
              }`}
            >
              <p className="font-medium">{h.hostname}</p>
              <p className="text-xs text-slate-500">{h.state} · {h.vm_count} VMs</p>
            </div>
          ))}
        </aside>
      </div>

      <SimpleCreateVmWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreate={handleCreate} />
      <WindowsCreateWizard open={windowsOpen} onClose={() => setWindowsOpen(false)} onCreate={handleWindowsCreate} />
      {migrateModal && (
        <MigratePrecheckModal
          vm={migrateModal.vm}
          destHostId={migrateModal.destId}
          destHostName={migrateModal.destName}
          onClose={() => setMigrateModal(null)}
          onDone={() => { toast.success('Migration queued'); void load() }}
        />
      )}
    </div>
  )
}

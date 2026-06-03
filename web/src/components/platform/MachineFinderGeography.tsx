// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useMemo } from 'react'
import { Link } from 'react-router'
import { Copy, Monitor, Server, Terminal } from 'lucide-react'
import { navigateVmSshSession } from '../vm/VmSshConnectDialog'
import type { FleetMissionOverview, MissionHost, PlatformVm } from '../../api/platform'
import { hostStateTone, hubLinkClasses, statusToneClass } from '../../utils/semanticColors'

const UNASSIGNED_SITE = '__unassigned__'

type ColumnProps<T> = {
  items: T[]
  selectedKey: string | null
  onSelect: (key: string) => void
  renderLabel: (item: T) => string
  renderMeta?: (item: T) => string | null
  itemKey: (item: T) => string
  emptyLabel: string
}

function FinderColumn<T>({
  items,
  selectedKey,
  onSelect,
  renderLabel,
  renderMeta,
  itemKey,
  emptyLabel,
}: ColumnProps<T>) {
  return (
    <div className="w-48 sm:w-52 shrink-0 border-r border-white/[0.06] overflow-y-auto max-h-[min(70vh,560px)]">
      {items.length === 0 ? (
        <p className="px-3 py-4 text-xs text-white/35">{emptyLabel}</p>
      ) : items.map((item) => {
        const key = itemKey(item)
        const active = selectedKey === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`w-full text-left px-3 py-2 text-sm border-b border-white/[0.04] ${
              active ? 'bg-sky-500/15 text-sky-100' : 'text-white/80 hover:bg-white/[0.03]'
            }`}
          >
            <span className="block truncate">{renderLabel(item)}</span>
            {renderMeta?.(item) ? (
              <span className="block text-[10px] text-slate-500 truncate mt-0.5">{renderMeta(item)}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function HostInspector({ host, vms }: { host: MissionHost; vms: PlatformVm[] }) {
  const tone = hostStateTone(host.state, false, host.maintenance_mode)
  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <div>
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Server className="w-4 h-4 shrink-0" />
          {host.hostname}
        </h3>
        <p className="text-xs text-white/50 mt-1">{host.address || '—'}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-white/40">Site</dt><dd className="text-white">{host.site || '—'}</dd></div>
        <div><dt className="text-white/40">Rack</dt><dd className="text-white">{host.rack || '—'}</dd></div>
        <div><dt className="text-white/40">Rack U</dt><dd className="text-white">{host.rack_u ?? '—'}</dd></div>
        <div><dt className="text-white/40">State</dt><dd className={`capitalize ${tone === 'ok' ? statusToneClass('ok') : tone === 'error' ? statusToneClass('error') : statusToneClass('warn')}`}>{host.maintenance_mode ? 'maintenance' : host.state}</dd></div>
        <div><dt className="text-white/40">CPU</dt><dd>{host.cpu_percent.toFixed(0)}%</dd></div>
        <div><dt className="text-white/40">VMs</dt><dd>{host.vm_count}</dd></div>
      </dl>
      <Link to={`/platform/hosts/${host.id}`} className="btn-primary text-sm block text-center">Open host</Link>
      {vms.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">Virtual machines</p>
          <ul className="space-y-1 text-sm">
            {vms.map((vm) => (
              <li key={vm.id}>
                <Link to={`/platform/vms/${vm.id}`} className={`inline-flex items-center gap-1.5 hover:underline ${hubLinkClasses()}`}>
                  <Monitor className="w-3.5 h-3.5 shrink-0" />
                  {vm.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function VmInspector({ vm }: { vm: PlatformVm }) {
  const running = vm.observed_state === 'running'
  const libvirt = vm.inventory_source !== 'kubevirt'
  const ip = vm.guest_ip?.trim() ?? ''
  return (
    <div className="p-4 space-y-3 h-full overflow-y-auto">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <Monitor className="w-4 h-4" />
        {vm.name}
      </h3>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-white/40">State</dt><dd className="capitalize text-white">{vm.observed_state}</dd></div>
        <div><dt className="text-white/40">vCPU</dt><dd className="text-white">{vm.vcpus}</dd></div>
        <div><dt className="text-white/40">Memory</dt><dd className="text-white">{Math.round(vm.memory_mib / 1024)} Gi</dd></div>
        <div><dt className="text-white/40">Managed</dt><dd className="text-white">{vm.managed === false ? 'discovered' : 'yes'}</dd></div>
        {ip && (
          <div className="col-span-2"><dt className="text-white/40">Guest IP</dt><dd className="font-mono text-emerald-300/90">{ip}</dd></div>
        )}
      </dl>
      {running && libvirt && (
        <div className="flex flex-wrap gap-2">
          <Link to={`/platform/vms/${vm.id}/console`} className="btn-secondary text-sm flex-1 text-center inline-flex items-center justify-center gap-1">
            <Monitor className="w-3.5 h-3.5" /> VNC
          </Link>
          <button
            type="button"
            className="btn-secondary text-sm flex-1 inline-flex items-center justify-center gap-1"
            onClick={() => {
              if (ip) navigateVmSshSession(vm.name, ip, 'ubuntu')
              else window.location.href = `/platform/vms/${vm.id}`
            }}
          >
            <Terminal className="w-3.5 h-3.5" /> SSH
          </button>
          {ip && (
            <button
              type="button"
              className="btn-secondary text-sm px-2"
              title="Copy guest IP"
              onClick={() => void navigator.clipboard.writeText(ip)}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      <Link to={`/platform/vms/${vm.id}`} className="btn-primary text-sm block text-center">Open VM</Link>
    </div>
  )
}

export type MachineFinderSelection = {
  site: string | null
  rack: string | null
  hostId: string | null
  vmId: string | null
}

export default function MachineFinderGeography({
  mission,
  vms,
  selection,
  onSelectSite,
  onSelectRack,
  onSelectHost,
  onSelectVm,
}: {
  mission: FleetMissionOverview
  vms: PlatformVm[]
  selection: MachineFinderSelection
  onSelectSite: (site: string) => void
  onSelectRack: (rack: string) => void
  onSelectHost: (hostId: string) => void
  onSelectVm: (vmId: string) => void
}) {
  const vmsByHost = useMemo(() => {
    const map = new Map<string, PlatformVm[]>()
    for (const vm of vms) {
      if (!vm.host_id) continue
      const list = map.get(vm.host_id) ?? []
      list.push(vm)
      map.set(vm.host_id, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return map
  }, [vms])

  const siteOptions = useMemo(() => {
    const sites = mission.sites.map((s) => ({ key: s.name, label: s.name, racks: s.racks }))
    if (mission.unassigned_hosts.length > 0) {
      sites.push({
        key: UNASSIGNED_SITE,
        label: 'Unassigned',
        racks: [{ name: 'All hosts', hosts: mission.unassigned_hosts }],
      })
    }
    return sites
  }, [mission])

  const selectedSite = siteOptions.find((s) => s.key === selection.site) ?? siteOptions[0] ?? null
  const racks = selectedSite?.racks ?? []
  const selectedRack = racks.find((r) => r.name === selection.rack) ?? racks[0] ?? null
  const hosts = selectedRack?.hosts ?? []
  const selectedHost = hosts.find((h) => h.id === selection.hostId) ?? null
  const hostVms = selectedHost ? (vmsByHost.get(selectedHost.id) ?? []) : []
  const selectedVm = hostVms.find((v) => v.id === selection.vmId) ?? null

  return (
    <div className="flex min-h-[420px] border border-white/[0.06] rounded-xl overflow-hidden bg-slate-950/30">
      <FinderColumn
        items={siteOptions}
        selectedKey={selectedSite?.key ?? null}
        onSelect={onSelectSite}
        itemKey={(s) => s.key}
        renderLabel={(s) => s.label}
        renderMeta={(s) => {
          const count = s.racks.reduce((n, r) => n + r.hosts.length, 0)
          return `${count} host${count === 1 ? '' : 's'}`
        }}
        emptyLabel="No sites — set site on host detail"
      />
      <FinderColumn
        items={racks}
        selectedKey={selectedRack?.name ?? null}
        onSelect={onSelectRack}
        itemKey={(r) => r.name}
        renderLabel={(r) => r.name}
        renderMeta={(r) => `${r.hosts.length} host${r.hosts.length === 1 ? '' : 's'}`}
        emptyLabel="Select a site"
      />
      <FinderColumn
        items={hosts}
        selectedKey={selectedHost?.id ?? null}
        onSelect={onSelectHost}
        itemKey={(h) => h.id}
        renderLabel={(h) => h.hostname}
        renderMeta={(h) => `${h.vm_count} VM${h.vm_count === 1 ? '' : 's'} · ${h.state}`}
        emptyLabel="Select a rack"
      />
      <FinderColumn
        items={hostVms}
        selectedKey={selectedVm?.id ?? null}
        onSelect={onSelectVm}
        itemKey={(v) => v.id}
        renderLabel={(v) => v.name}
        renderMeta={(v) => v.guest_ip ? `${v.observed_state} · ${v.guest_ip}` : v.observed_state}
        emptyLabel={selectedHost ? 'No VMs on this host' : 'Select a host'}
      />
      <div className="flex-1 min-w-0 overflow-y-auto border-l border-white/[0.06]">
        {selectedVm ? (
          <VmInspector vm={selectedVm} />
        ) : selectedHost ? (
          <HostInspector host={selectedHost} vms={hostVms} />
        ) : (
          <p className="p-4 text-sm text-white/40">Select site → rack → host → VM</p>
        )}
      </div>
    </div>
  )
}

export { UNASSIGNED_SITE }

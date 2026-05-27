// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import {
  listOpenStackAvailabilityZones,
  listOpenStackComputeServices,
  listOpenStackHostAggregates,
  listOpenStackHypervisors,
  listOpenStackNeutronAgents,
  getOpenStackHypervisor,
  type OpenStackAvailabilityZone,
  type OpenStackComputeService,
  type OpenStackHostAggregate,
  type OpenStackHypervisor,
  type OpenStackNeutronAgent,
} from '../api/openstackExtras'
import { formatUserError } from '../utils/apiError'
import { Loader2, Server } from 'lucide-react'

export default function OpenStackAdminPanel() {
  const [azs, setAzs] = useState<OpenStackAvailabilityZone[]>([])
  const [hvs, setHvs] = useState<OpenStackHypervisor[]>([])
  const [services, setServices] = useState<OpenStackComputeService[]>([])
  const [agents, setAgents] = useState<OpenStackNeutronAgent[]>([])
  const [aggregates, setAggregates] = useState<OpenStackHostAggregate[]>([])
  const [hvDetail, setHvDetail] = useState<OpenStackHypervisor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [a, h, s, ag, agg] = await Promise.all([
        listOpenStackAvailabilityZones().catch(() => ({ availability_zones: [] })),
        listOpenStackHypervisors().catch(() => ({ hypervisors: [] })),
        listOpenStackComputeServices().catch(() => ({ services: [] })),
        listOpenStackNeutronAgents().catch(() => ({ agents: [] })),
        listOpenStackHostAggregates().catch(() => ({ aggregates: [] })),
      ])
      setAzs(a.availability_zones)
      setHvs(h.hypervisors)
      setServices(s.services)
      setAgents(ag.agents)
      setAggregates(agg.aggregates)
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
  }

  return (
    <div className="rounded-xl border border-slate-700 p-4 space-y-4">
      <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
        <Server className="w-4 h-4 text-sky-400" />
        Compute catalog (read-only)
      </h2>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <h3 className="text-xs uppercase text-slate-500 mb-2">Availability zones</h3>
          <ul className="space-y-1 font-mono text-slate-300">
            {azs.map((z) => (
              <li key={z.name}>{z.name} · {z.state}</li>
            ))}
            {azs.length === 0 && <li className="text-slate-500">No AZ data</li>}
          </ul>
        </div>
        <div>
          <h3 className="text-xs uppercase text-slate-500 mb-2">Hypervisors</h3>
          <ul className="space-y-1 font-mono text-slate-300 max-h-40 overflow-y-auto">
            {hvs.map((h) => (
              <li key={h.id}>
                <button type="button" className="text-left hover:text-sky-300" onClick={async () => {
                  try {
                    const r = await getOpenStackHypervisor(h.id)
                    setHvDetail(r.hypervisor)
                  } catch { /* ignore */ }
                }}>
                  {h.hostname} · {h.running_vms} VMs · {h.vcpus_used}/{h.vcpus} vCPU
                </button>
              </li>
            ))}
            {hvs.length === 0 && <li className="text-slate-500">No hypervisor data</li>}
          </ul>
        </div>
        <div>
          <h3 className="text-xs uppercase text-slate-500 mb-2">Host aggregates</h3>
          <ul className="space-y-1 font-mono text-slate-300 max-h-40 overflow-y-auto">
            {aggregates.map((a) => (
              <li key={a.id}>
                {a.name}
                {a.availability_zone ? ` · ${a.availability_zone}` : ''}
                {a.hosts.length > 0 ? ` · ${a.hosts.length} host(s)` : ''}
              </li>
            ))}
            {aggregates.length === 0 && <li className="text-slate-500">No aggregates</li>}
          </ul>
        </div>
        <div>
          <h3 className="text-xs uppercase text-slate-500 mb-2">Compute services</h3>
          <ul className="space-y-1 font-mono text-slate-300 max-h-40 overflow-y-auto">
            {services.map((s) => (
              <li key={s.id}>
                {s.binary} @ {s.host} · {s.state}/{s.status}
              </li>
            ))}
            {services.length === 0 && <li className="text-slate-500">No service data</li>}
          </ul>
        </div>
        <div className="md:col-span-2">
          <h3 className="text-xs uppercase text-slate-500 mb-2">Neutron agents</h3>
          <ul className="space-y-1 font-mono text-slate-300 max-h-40 overflow-y-auto">
            {agents.map((a) => (
              <li key={a.id}>
                {a.agent_type} @ {a.host} · {a.alive ? 'alive' : 'down'} · admin {a.admin_state_up ? 'up' : 'down'}
              </li>
            ))}
            {agents.length === 0 && <li className="text-slate-500">No agent data</li>}
          </ul>
        </div>
      </div>
      {hvDetail && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-3 text-xs font-mono text-slate-300">
          {hvDetail.hostname} · {hvDetail.state}/{hvDetail.status} · {hvDetail.memory_mb_used}/{hvDetail.memory_mb} MB RAM
          <button type="button" className="ml-2 text-slate-500 hover:underline" onClick={() => setHvDetail(null)}>Dismiss</button>
        </div>
      )}
    </div>
  )
}

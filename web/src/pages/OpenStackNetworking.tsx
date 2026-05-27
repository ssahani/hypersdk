// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { listOpenStackNetworks } from '../api/openstack'
import {
  listOpenStackPorts,
  listOpenStackRouters,
  listOpenStackSubnets,
  type OpenStackPort,
  type OpenStackRouter,
  type OpenStackSubnet,
} from '../api/openstackExtras'
import OpenStackGate from '../components/OpenStackGate'
import OpenStackSubNav from '../components/OpenStackSubNav'
import OpenStackFooter from '../components/OpenStackFooter'
import { useToastContext } from '../contexts/ToastContext'
import { formatUserError } from '../utils/apiError'
import { Loader2, Network, RefreshCw } from 'lucide-react'

export default function OpenStackNetworkingPage() {
  return (
    <OpenStackGate title="Neutron topology">
      <OpenStackNetworkingContent />
    </OpenStackGate>
  )
}

function OpenStackNetworkingContent() {
  const toast = useToastContext()
  const [subnets, setSubnets] = useState<OpenStackSubnet[]>([])
  const [routers, setRouters] = useState<OpenStackRouter[]>([])
  const [ports, setPorts] = useState<OpenStackPort[]>([])
  const [networks, setNetworks] = useState<{ id: string; name: string; external: boolean }[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r, p, n] = await Promise.all([
        listOpenStackSubnets(),
        listOpenStackRouters(),
        listOpenStackPorts(),
        listOpenStackNetworks(),
      ])
      setSubnets(s.subnets)
      setRouters(r.routers)
      setPorts(p.ports)
      setNetworks(n.networks.map((x) => ({ id: x.id, name: x.name, external: x.external })))
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 max-w-5xl">
      <OpenStackSubNav />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Network className="w-7 h-7 text-sky-400" />
          Networking (read-only)
        </h1>
        <button type="button" onClick={() => void load()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-600 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-sky-400 mx-auto" />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <Section title={`Networks (${networks.length})`}>
            <ul className="text-sm space-y-1 font-mono">
              {networks.map((n) => (
                <li key={n.id} className="text-slate-300">
                  {n.name} {n.external && <span className="text-amber-400 text-xs">external</span>}
                </li>
              ))}
            </ul>
          </Section>
          <Section title={`Subnets (${subnets.length})`}>
            <ul className="text-sm space-y-1 font-mono text-slate-300">
              {subnets.map((s) => (
                <li key={s.id}>{s.name} · {s.cidr}</li>
              ))}
            </ul>
          </Section>
          <Section title={`Routers (${routers.length})`}>
            <ul className="text-sm space-y-1 font-mono text-slate-300">
              {routers.map((r) => (
                <li key={r.id}>{r.name} · {r.status}</li>
              ))}
            </ul>
          </Section>
          <Section title={`Ports (${ports.length})`}>
            <ul className="text-sm space-y-1 font-mono text-slate-300 max-h-64 overflow-y-auto">
              {ports.slice(0, 40).map((p) => (
                <li key={p.id}>{p.name || p.id.slice(0, 8)} · {p.fixed_ips.join(', ') || '—'}</li>
              ))}
            </ul>
          </Section>
        </div>
      )}
      <OpenStackFooter />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700 p-4">
      <h2 className="text-sm font-medium text-slate-400 mb-2">{title}</h2>
      {children}
    </div>
  )
}

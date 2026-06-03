// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import PageLayout from '../../components/PageLayout'
import PlatformPageChrome from '../../components/platform/PlatformPageChrome'
import { listPlatformHosts, listPlatformVms, type PlatformHost, type PlatformVm } from '../../api/platform'
import { hubLinkClasses } from '../../utils/semanticColors'

const SOURCE_LABELS: Record<string, string> = {
  libvirt: 'KVM / libvirt',
  kubevirt: 'KubeVirt',
  discovered: 'Discovered',
}

export default function PlatformDatacenter() {
  const [vms, setVms] = useState<PlatformVm[]>([])
  const [hosts, setHosts] = useState<PlatformHost[]>([])

  useEffect(() => {
    void Promise.all([listPlatformVms(), listPlatformHosts()]).then(([v, h]) => {
      setVms(v)
      setHosts(h)
    })
  }, [])

  const bySource = useMemo(() => {
    const map = new Map<string, PlatformVm[]>()
    for (const v of vms) {
      const src = v.inventory_source ?? 'libvirt'
      const list = map.get(src) ?? []
      list.push(v)
      map.set(src, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [vms])

  return (
    <PageLayout compact title="Datacenter" subtitle="Multi-hypervisor inventory (honest scope)">
      <PlatformPageChrome>
        <p className="text-sm text-slate-400 mb-4">
          libvirt/KVM is the system of record. VMware and KubeVirt appear as import/workload planes — not full parity with every vSphere feature.
        </p>
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Hosts ({hosts.length})</h3>
          <ul className="flex flex-wrap gap-2 text-xs">
            {hosts.map((h) => (
              <li key={h.id}>
                <Link to={`/platform/hosts/${h.id}`} className={`px-2 py-1 rounded-lg border border-slate-700 ${hubLinkClasses()}`}>
                  {h.hostname} · {h.state}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {bySource.map(([src, list]) => (
          <section key={src} className="mb-6">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">
              {SOURCE_LABELS[src] ?? src} <span className="text-slate-500">({list.length})</span>
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {list.map((v) => (
                <li key={v.id} className="rounded-lg border border-slate-800/80 px-3 py-2">
                  <Link to={`/platform/vms/${v.id}`} className={hubLinkClasses()}>{v.name}</Link>
                  <span className="text-xs text-slate-500 block">{v.observed_state}{v.guest_ip ? ` · ${v.guest_ip}` : ''}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-xs text-slate-500">
          VMware import: <Link to="/platform/migration" className={hubLinkClasses()}>Migration Assistant</Link>
        </p>
      </PlatformPageChrome>
    </PageLayout>
  )
}

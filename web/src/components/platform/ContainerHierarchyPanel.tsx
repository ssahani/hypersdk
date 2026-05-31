// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export interface ContainerHierarchy {
  host_id?: string
  summary?: string
  namespaces?: Array<{
    namespace: string
    event_count?: number
    pods?: Array<{
      pod: string
      deployment?: string
      event_count?: number
      containers?: Array<{
        container: string
        event_count?: number
        max_severity?: string
        processes?: string[]
      }>
    }>
  }>
}

function severityClass(sev?: string): string {
  if (sev === 'critical' || sev === 'high') return 'text-red-300'
  if (sev === 'medium') return 'text-amber-300'
  return 'text-slate-400'
}

export default function ContainerHierarchyPanel({ data }: { data: ContainerHierarchy | null }) {
  if (!data?.namespaces?.length) {
    return (
      <p className="text-sm text-slate-500 p-3">
        No K8s pod/container metadata yet. Install Tetragon on the cluster or enable K8s enrichment on this node.
      </p>
    )
  }

  return (
    <div className="space-y-4 p-3">
      {data.summary && <p className="text-xs text-slate-500">{data.summary}</p>}
      {data.namespaces.map((ns) => (
        <div key={ns.namespace} className="rounded-lg border border-white/[0.08] bg-slate-900/30 p-3">
          <p className="text-sm font-medium text-slate-100">
            ns/{ns.namespace}
            {ns.event_count ? <span className="text-xs text-slate-500 ml-2">{ns.event_count} events</span> : null}
          </p>
          <div className="mt-2 space-y-3 pl-3 border-l border-white/[0.06]">
            {(ns.pods ?? []).map((pod) => (
              <div key={pod.pod}>
                <p className="text-sm text-slate-200">
                  pod/{pod.pod}
                  {pod.deployment ? <span className="text-xs text-slate-500 ml-2">deploy/{pod.deployment}</span> : null}
                </p>
                <ul className="mt-1 space-y-1 pl-3">
                  {(pod.containers ?? []).map((c) => (
                    <li key={c.container} className="text-xs text-slate-400">
                      <span className={severityClass(c.max_severity)}>{c.container}</span>
                      {' · '}
                      {c.event_count ?? 0} events
                      {c.processes?.length ? ` · ${c.processes.slice(0, 3).join(', ')}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

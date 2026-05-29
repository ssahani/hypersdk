// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Cpu, Search, Server, Shield, Workflow } from 'lucide-react'
import { MacGlassPanel, MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import {
  analyzeAttackPath,
  diagnoseKnowledge,
  executeFleetRebalance,
  getComplianceFrameworks,
  getGpuPlacement,
  getFleetHeatmap,
  simulateServiceImpact,
  getFleetRebalanceProposal,
  getInfrastructureMemory,
  getSecurityGraph,
  getServiceGraph,
  listBaremetalServers,
  planBaremetalCapacity,
  registerBaremetalServer,
  searchKnowledge,
  setBaremetalPower,
  type BaremetalServer,
  type FleetHeatmap,
  type KnowledgeHit,
  type RebalanceProposal,
} from '../../api/ai'

type Tab = 'fleet' | 'security' | 'knowledge' | 'services' | 'baremetal'

export default function PlatformZeusOs() {
  const [tab, setTab] = useState<Tab>('fleet')
  const [error, setError] = useState<string | null>(null)
  const [heatmap, setHeatmap] = useState<FleetHeatmap | null>(null)
  const [rebalance, setRebalance] = useState<RebalanceProposal | null>(null)
  const [attackSummary, setAttackSummary] = useState<string | null>(null)
  const [knowledgeQuery, setKnowledgeQuery] = useState('payments')
  const [knowledgeHits, setKnowledgeHits] = useState<KnowledgeHit[]>([])
  const [serviceCount, setServiceCount] = useState(0)
  const [memoryCount, setMemoryCount] = useState(0)
  const [baremetal, setBaremetal] = useState<BaremetalServer[]>([])
  const [bmcHost, setBmcHost] = useState('')
  const [bmcAddr, setBmcAddr] = useState('')
  const [capacitySummary, setCapacitySummary] = useState<string | null>(null)
  const [rebalancePreview, setRebalancePreview] = useState<string | null>(null)
  const [frameworksSummary, setFrameworksSummary] = useState<string | null>(null)
  const [gpuSummary, setGpuSummary] = useState<string | null>(null)
  const [diagnosisSummary, setDiagnosisSummary] = useState<string | null>(null)
  const [serviceImpact, setServiceImpact] = useState<string | null>(null)

  const loadFleet = useCallback(async () => {
    setError(null)
    try {
      const [h, r, gpu] = await Promise.all([
        getFleetHeatmap(),
        getFleetRebalanceProposal(),
        getGpuPlacement('inference'),
      ])
      setHeatmap(h)
      setRebalance(r)
      setGpuSummary(gpu.summary)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fleet load failed')
    }
  }, [])

  const loadSecurity = useCallback(async () => {
    setError(null)
    try {
      await getSecurityGraph()
      const path = await analyzeAttackPath('attacker', 'db-prod')
      setAttackSummary(path.summary)
      const fw = await getComplianceFrameworks()
      setFrameworksSummary(
        fw.frameworks.map((f) => `${f.framework} ${f.grade} (${f.score})`).join(' · ') || fw.summary,
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Security graph failed')
    }
  }, [])

  const loadServices = useCallback(async () => {
    setError(null)
    try {
      const [sg, mem, impact] = await Promise.all([
        getServiceGraph(),
        getInfrastructureMemory(),
        simulateServiceImpact('payments').catch(() => null),
      ])
      setServiceCount(sg.service_count)
      setMemoryCount(mem.incidents.length)
      if (impact) setServiceImpact(impact.summary)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Service graph failed')
    }
  }, [])

  const loadBaremetal = useCallback(async () => {
    setError(null)
    try {
      setBaremetal(await listBaremetalServers())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bare metal load failed')
    }
  }, [])

  useEffect(() => {
    if (tab === 'fleet') void loadFleet()
    if (tab === 'security') void loadSecurity()
    if (tab === 'services') void loadServices()
    if (tab === 'baremetal') void loadBaremetal()
  }, [tab, loadFleet, loadSecurity, loadServices, loadBaremetal])

  const runKnowledge = async () => {
    try {
      const [r, diag] = await Promise.all([
        searchKnowledge(knowledgeQuery),
        diagnoseKnowledge(knowledgeQuery),
      ])
      setKnowledgeHits(r.hits)
      setDiagnosisSummary(diag.hypotheses[0]?.title ?? diag.summary)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed')
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'fleet', label: 'Fleet', icon: <Cpu className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'knowledge', label: 'Knowledge', icon: <Search className="w-4 h-4" /> },
    { id: 'services', label: 'Services', icon: <Workflow className="w-4 h-4" /> },
    { id: 'baremetal', label: 'Bare Metal', icon: <Server className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <MacSectionTitle
        title="Machina Zeus OS"
        subtitle="Fleet intelligence · AI security graph · knowledge engine · service fabric · bare metal"
      />
      {error && <ErrorBanner message={error} />}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${
              tab === t.id ? 'border-orange-400/50 bg-orange-500/10 text-orange-200' : 'border-white/[0.08] text-slate-400'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <Link to="/mission-control" className="text-xs text-blue-400 self-center ml-2">Mission Control →</Link>
        <Link to="/platform/topology" className="text-xs text-blue-400 self-center">Digital Twin →</Link>
      </div>

      {tab === 'fleet' && heatmap && (
        <div className="space-y-4">
          <MacGlassPanel title="Fleet heat map" subtitle="Hot, cold, and power-waste hosts">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              {heatmap.hosts.map((h) => (
                <div key={h.host_id} className="rounded-lg border border-white/[0.06] p-2">
                  <p className="font-medium text-slate-200">{h.hostname}</p>
                  <p className="text-slate-500">CPU {h.cpu_percent.toFixed(0)}% · Mem {h.memory_percent.toFixed(0)}% · {h.classification}</p>
                </div>
              ))}
            </div>
          </MacGlassPanel>
          {gpuSummary && (
            <MacGlassPanel title="GPU / NUMA placement" subtitle="Tag hosts with gpu or nvidia for affinity">
              <p className="text-sm text-slate-300">{gpuSummary}</p>
            </MacGlassPanel>
          )}
          {rebalance && (
            <MacGlassPanel title="Autonomous rebalancer" subtitle={rebalance.summary}>
              <ul className="text-xs space-y-2 text-slate-400">
                {rebalance.moves.map((m) => (
                  <li key={m.vm_id}>{m.vm_name}: {m.from_host} → {m.to_host}</li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-secondary text-xs mt-3"
                onClick={async () => {
                  const r = await executeFleetRebalance(true)
                  setRebalancePreview(r.summary)
                }}
              >
                Preview execute
              </button>
              {rebalancePreview && <p className="text-xs text-slate-400 mt-2">{rebalancePreview}</p>}
            </MacGlassPanel>
          )}
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-4">
          <MacGlassPanel title="Attack path discovery" subtitle="Example: attacker → db-prod">
            <p className="text-sm text-slate-300">{attackSummary ?? 'Loading…'}</p>
            <p className="text-xs text-slate-500 mt-2">Use Spotlight: &quot;show attack path to database VM&quot;</p>
          </MacGlassPanel>
          {frameworksSummary && (
            <MacGlassPanel title="Compliance frameworks" subtitle="CIS · PCI · SOC2 · HIPAA mapping">
              <p className="text-sm text-slate-300">{frameworksSummary}</p>
            </MacGlassPanel>
          )}
        </div>
      )}

      {tab === 'knowledge' && (
        <MacGlassPanel title="Infrastructure knowledge engine" subtitle="Global search + NL diagnose">
          <div className="flex gap-2">
            <input className="input flex-1 text-sm" value={knowledgeQuery} onChange={(e) => setKnowledgeQuery(e.target.value)} />
            <button type="button" className="btn-primary text-xs" onClick={() => void runKnowledge()}>Search</button>
          </div>
          {diagnosisSummary && <p className="text-xs text-amber-200/90 mt-2">Diagnosis: {diagnosisSummary}</p>}
          <ul className="mt-3 space-y-1.5 text-xs">
            {knowledgeHits.map((h) => (
              <li key={`${h.kind}-${h.id}`}>
                {h.navigate ? <Link to={h.navigate} className="text-blue-400 hover:underline">{h.title}</Link> : h.title}
                <span className="text-slate-500"> — {h.snippet}</span>
              </li>
            ))}
          </ul>
        </MacGlassPanel>
      )}

      {tab === 'services' && (
        <MacGlassPanel title="Service graph & infrastructure memory" subtitle="Application → VM dependencies + incident recall">
          <p className="text-sm text-slate-400">{serviceCount} application service(s) mapped · {memoryCount} remembered incident(s)</p>
          {serviceImpact && <p className="text-xs text-slate-400 mt-2">{serviceImpact}</p>}
          <Link to="/platform/applications" className="text-xs text-blue-400 mt-2 inline-block">Open applications →</Link>
        </MacGlassPanel>
      )}

      {tab === 'baremetal' && (
        <div className="space-y-4">
          <MacGlassPanel title="Bare metal servers" subtitle="Redfish / IPMI inventory foundation">
            <div className="flex flex-wrap gap-2 mb-3">
              <input className="input text-sm" placeholder="hostname" value={bmcHost} onChange={(e) => setBmcHost(e.target.value)} />
              <input className="input text-sm" placeholder="BMC address" value={bmcAddr} onChange={(e) => setBmcAddr(e.target.value)} />
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={async () => {
                  await registerBaremetalServer({ hostname: bmcHost, bmc_address: bmcAddr })
                  setBmcHost('')
                  setBmcAddr('')
                  await loadBaremetal()
                }}
              >
                Register
              </button>
            </div>
            <ul className="text-xs text-slate-400 space-y-1">
              {baremetal.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span>{s.hostname} · {s.bmc_type} @ {s.bmc_address || '—'} · {s.state}</span>
                  <button type="button" className="text-blue-400 hover:underline" onClick={() => void setBaremetalPower(s.id, 'on', true).then((r) => setCapacitySummary(r.summary))}>Power on (preview)</button>
                </li>
              ))}
            </ul>
          </MacGlassPanel>
          <MacGlassPanel title="AI capacity planner" subtitle="How many servers for N engineers?">
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={async () => {
                const p = await planBaremetalCapacity('How many servers for 500 AI engineers?')
                setCapacitySummary(p.summary)
              }}
            >
              Plan 500 AI engineers
            </button>
            {capacitySummary && <p className="text-sm text-slate-300 mt-2">{capacitySummary}</p>}
          </MacGlassPanel>
        </div>
      )}
    </div>
  )
}

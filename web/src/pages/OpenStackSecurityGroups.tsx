// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  getOpenStackSecurityGroup,
  listOpenStackSecurityGroups,
  type OpenStackSecurityGroup,
} from '../api/openstack'
import { useToastContext } from '../contexts/ToastContext'
import OpenStackFooter from '../components/OpenStackFooter'
import OpenStackGate from '../components/OpenStackGate'
import OpenStackSubNav from '../components/OpenStackSubNav'
import OpenStackStatusBar from '../components/OpenStackStatusBar'
import ErrorBanner from '../components/ErrorBanner'
import { formatUserError } from '../utils/apiError'
import { openStackErrorHints } from '../utils/openstackHints'
import { Loader2, RefreshCw, Shield } from 'lucide-react'

export default function OpenStackSecurityGroupsPage() {
  return (
    <OpenStackGate title="OpenStack Security Groups">
      <OpenStackSecurityGroupsContent />
    </OpenStackGate>
  )
}

function OpenStackSecurityGroupsContent() {
  const toast = useToastContext()
  const [groups, setGroups] = useState<OpenStackSecurityGroup[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OpenStackSecurityGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { security_groups } = await listOpenStackSecurityGroups()
      setGroups(security_groups)
      if (security_groups.length > 0) {
        setSelectedId((prev) => prev ?? security_groups[0].id)
      }
    } catch (e: unknown) {
      const msg = formatUserError(e)
      setLoadError(msg)
      toast.error(`Failed to load security groups: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    getOpenStackSecurityGroup(selectedId)
      .then((r) => setDetail(r.security_group))
      .catch((e: unknown) => {
        toast.error(formatUserError(e))
        setDetail(null)
      })
      .finally(() => setDetailLoading(false))
  }, [selectedId, toast])

  const active = detail ?? groups.find((g) => g.id === selectedId) ?? null

  return (
    <div className="space-y-6 max-w-5xl">
      <OpenStackSubNav />
      <OpenStackStatusBar />

      {loadError && (
        <ErrorBanner
          title="Security groups unavailable"
          headline={loadError}
          hints={openStackErrorHints(loadError)}
          technicalDetail={loadError}
          tone="red"
          onRetry={() => void load()}
          retryLabel="Retry"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="w-7 h-7 text-sky-400" />
          Security groups
        </h1>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Read-only Neutron view. To create groups or edit rules, use Horizon or{' '}
        <code className="text-xs">openstack security group rule create</code>.
        {' '}
        <Link to="/openstack/instances" className="text-sky-400 hover:underline">
          Attach groups on instance detail
        </Link>
        .
      </p>

      {loading ? (
        <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
          Loading…
        </div>
      ) : groups.length === 0 ? (
        <p className="text-slate-500 text-sm">No security groups in this project.</p>
      ) : (
        <div className="grid lg:grid-cols-[minmax(12rem,16rem)_1fr] gap-6">
          <ul className="space-y-1 rounded-xl border border-slate-700 p-2 max-h-[28rem] overflow-y-auto">
            {groups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                    selectedId === g.id
                      ? 'bg-sky-600/20 text-sky-200 border border-sky-500/40'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="block text-xs text-slate-500 truncate">{g.id}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-slate-700 p-4 min-h-[12rem]">
            {detailLoading && (
              <Loader2 className="w-5 h-5 animate-spin text-sky-400 mb-2" />
            )}
            {active ? (
              <>
                <h2 className="text-lg font-medium text-slate-100">{active.name}</h2>
                {active.description && (
                  <p className="text-sm text-slate-500 mt-1">{active.description}</p>
                )}
                <p className="text-xs font-mono text-slate-600 mt-2 break-all">{active.id}</p>
                <h3 className="text-sm font-medium text-slate-400 mt-4 mb-2">
                  Rules ({active.rules.length})
                </h3>
                {active.rules.length === 0 ? (
                  <p className="text-sm text-slate-500">No rules defined.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900 text-slate-400 text-left">
                        <tr>
                          <th className="px-3 py-2">Direction</th>
                          <th className="px-3 py-2">Protocol</th>
                          <th className="px-3 py-2">Ports</th>
                          <th className="px-3 py-2">Remote</th>
                          <th className="px-3 py-2">Ether</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono text-xs">
                        {active.rules.map((r) => (
                          <tr key={r.id}>
                            <td className="px-3 py-2 text-slate-300">{r.direction}</td>
                            <td className="px-3 py-2">{r.protocol || '—'}</td>
                            <td className="px-3 py-2">
                              {r.port_range_min != null
                                ? r.port_range_min === r.port_range_max
                                  ? String(r.port_range_min)
                                  : `${r.port_range_min}–${r.port_range_max}`
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {r.remote_ip_prefix || r.remote_group_id || '—'}
                            </td>
                            <td className="px-3 py-2">{r.ethertype || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-500 text-sm">Select a security group.</p>
            )}
          </div>
        </div>
      )}

      <OpenStackFooter />
    </div>
  )
}

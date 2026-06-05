// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import {
  createVmPortForward,
  deleteVmPortForward,
  listVmPortForwards,
  type VmPortForwardRule,
} from '../../api/platform'
import { formatUserError } from '../../utils/apiError'

export interface VmPortForwardPanelProps {
  platformVmId: string
  vmName: string
  guestIp: string
  disabled?: boolean
  onNotify?: (message: string) => void
  className?: string
}

export default function VmPortForwardPanel({
  platformVmId,
  vmName,
  guestIp,
  disabled = false,
  onNotify,
  className = '',
}: VmPortForwardPanelProps) {
  const [rules, setRules] = useState<VmPortForwardRule[]>([])
  const [loading, setLoading] = useState(false)
  const [hostPort, setHostPort] = useState('9080')
  const [vmPort, setVmPort] = useState('80')
  const [busy, setBusy] = useState(false)
  const ip = guestIp.trim()

  const notify = (message: string) => onNotify?.(message)

  const load = useCallback(async () => {
    if (!platformVmId || !ip) {
      setRules([])
      return
    }
    setLoading(true)
    try {
      setRules(await listVmPortForwards(platformVmId))
    } catch {
      setRules([])
    } finally {
      setLoading(false)
    }
  }, [platformVmId, ip])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    const host = parseInt(hostPort, 10)
    const guest = parseInt(vmPort, 10)
    if (!Number.isFinite(host) || !Number.isFinite(guest)) {
      notify('Enter valid port numbers')
      return
    }
    setBusy(true)
    try {
      await createVmPortForward(platformVmId, {
        protocol: 'tcp',
        host_port: host,
        vm_port: guest,
        description: vmName,
      })
      notify('NAT rule created on hypervisor')
      await load()
    } catch (e: unknown) {
      notify(formatUserError(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (rule: VmPortForwardRule) => {
    setBusy(true)
    try {
      await deleteVmPortForward(platformVmId, {
        protocol: rule.protocol,
        host_port: rule.host_port,
        vm_port: rule.vm_port,
      })
      notify('NAT rule removed')
      await load()
    } catch (e: unknown) {
      notify(formatUserError(e))
    } finally {
      setBusy(false)
    }
  }

  if (!ip) {
    return (
      <p className={`text-sm text-slate-500 ${className}`}>
        Guest IP required — start the VM and install guest tools to manage hypervisor NAT rules.
      </p>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-xs text-slate-500">
        Map a TCP port on the hypervisor to <span className="font-mono text-slate-400">{ip}</span> via iptables on the host agent.
      </p>
      <div className="flex flex-wrap gap-2 items-end text-sm">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Host port</span>
          <input
            className="input w-20 py-1 text-xs font-mono"
            value={hostPort}
            onChange={(e) => setHostPort(e.target.value)}
            aria-label="Host port"
          />
        </label>
        <span className="text-slate-500 pb-1">→ guest</span>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Guest port</span>
          <input
            className="input w-16 py-1 text-xs font-mono"
            value={vmPort}
            onChange={(e) => setVmPort(e.target.value)}
            aria-label="Guest port"
          />
        </label>
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={busy || disabled}
          onClick={() => void create()}
        >
          Expose
        </button>
      </div>
      {loading && <p className="text-xs text-slate-500">Loading rules…</p>}
      {!loading && rules.length === 0 && (
        <p className="text-xs text-slate-500">No NAT rules on this hypervisor yet.</p>
      )}
      {!loading && rules.length > 0 && (
        <ul className="text-xs font-mono space-y-1">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-center gap-2">
              <span className="text-slate-300">
                {rule.host_port}→{rule.vm_port}
                {rule.protocol !== 'tcp' ? `/${rule.protocol}` : ''}
              </span>
              {rule.description && <span className="text-slate-500 truncate">{rule.description}</span>}
              <button
                type="button"
                className="text-red-400/90 hover:underline"
                disabled={busy || disabled}
                onClick={() => void remove(rule)}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

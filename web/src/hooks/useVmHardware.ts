// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getVmDomainXml,
  getVmGuestHealth,
  getVmDomainCaps,
  getVmHardwareCompat,
  getVmHardwareSummary,
  getVmLibvirtDetails,
  getVmPendingConfig,
  type VmDomainCapabilitiesReport,
  type VmGuestHealthReport,
  type VmHardwareCompatReport,
  type VmHardwareSummaryReport,
  type VmLibvirtDetails,
  type VmPendingConfig,
  type VmPortForwardRule,
} from '../api/platform'
import { queryVmLibvirt, type CpuMemoryTopology } from '../api/platformVmLibvirt'
import { buildVmHardwareSummary, type VmHardwareSummary } from '../utils/vmHardwareSummary'

export type UseVmHardwareOptions = {
  vmId: string | null | undefined
  enabled?: boolean
  inventorySource?: string | null
  portForwardRules?: VmPortForwardRule[]
  protocols?: string[]
  osHint?: string
}

export type UseVmHardwareResult = {
  loading: boolean
  error: string | null
  details: VmLibvirtDetails | null
  domainXml: string
  topology: CpuMemoryTopology | null
  pending: VmPendingConfig | null
  guestHealth: VmGuestHealthReport | null
  report: VmHardwareSummaryReport | null
  summary: VmHardwareSummary | null
  compat: VmHardwareCompatReport | null
  domainCaps: VmDomainCapabilitiesReport | null
  compatLoading: boolean
  compatError: string | null
  checkCompat: () => Promise<void>
  refresh: () => Promise<void>
}

export function useVmHardware({
  vmId,
  enabled = true,
  inventorySource,
  portForwardRules = [],
  protocols = [],
  osHint,
}: UseVmHardwareOptions): UseVmHardwareResult {
  const libvirt = enabled && Boolean(vmId) && inventorySource !== 'kubevirt'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<VmLibvirtDetails | null>(null)
  const [domainXml, setDomainXml] = useState('')
  const [topology, setTopology] = useState<CpuMemoryTopology | null>(null)
  const [pending, setPending] = useState<VmPendingConfig | null>(null)
  const [guestHealth, setGuestHealth] = useState<VmGuestHealthReport | null>(null)
  const [report, setReport] = useState<VmHardwareSummaryReport | null>(null)
  const [compat, setCompat] = useState<VmHardwareCompatReport | null>(null)
  const [domainCaps, setDomainCaps] = useState<VmDomainCapabilitiesReport | null>(null)
  const [compatLoading, setCompatLoading] = useState(false)
  const [compatError, setCompatError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!vmId || !libvirt) {
      setDetails(null)
      setDomainXml('')
      setTopology(null)
      setPending(null)
      setGuestHealth(null)
      setReport(null)
      setCompat(null)
      setDomainCaps(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [d, xmlRes, topo, pend, health, hwReport] = await Promise.all([
        getVmLibvirtDetails(vmId),
        getVmDomainXml(vmId).catch(() => ({ xml: '' })),
        queryVmLibvirt<CpuMemoryTopology>(vmId, 'cpu.memory.topology').catch(() => null),
        getVmPendingConfig(vmId).catch(() => null),
        getVmGuestHealth(vmId).catch(() => null),
        getVmHardwareSummary(vmId).catch(() => null),
      ])
      setDetails(d)
      setDomainXml(xmlRes.xml ?? '')
      setTopology(topo)
      setPending(pend)
      setGuestHealth(health)
      setReport(hwReport)
    } catch (e: unknown) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [vmId, libvirt])

  const checkCompat = useCallback(async () => {
    if (!vmId || !libvirt) return
    setCompatLoading(true)
    setCompatError(null)
    try {
      const [result, caps] = await Promise.all([
        getVmHardwareCompat(vmId),
        getVmDomainCaps(vmId).catch(() => null),
      ])
      setCompat(result)
      setDomainCaps(caps)
    } catch (e: unknown) {
      setCompatError(String(e))
    } finally {
      setCompatLoading(false)
    }
  }, [vmId, libvirt])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const summary = useMemo(() => {
    if (!libvirt) return null
    return buildVmHardwareSummary({
      details,
      domainXml,
      topology,
      pending,
      guestHealth,
      portForwardRules,
      protocols,
      osHint,
    })
  }, [libvirt, details, domainXml, topology, pending, guestHealth, portForwardRules, protocols, osHint])

  return {
    loading,
    error,
    details,
    domainXml,
    topology,
    pending,
    guestHealth,
    report,
    summary,
    compat,
    domainCaps,
    compatLoading,
    compatError,
    checkCompat,
    refresh,
  }
}

// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPlatformVm, type PlatformVm } from '../api/platform'
import { getK8sKubevirtVmSummary, type KubeVirtVmSummaryRow } from '../api/k8s'
import { formatUserError } from '../utils/apiError'
import { buildKubevirtHardwareSummary, type KubevirtHardwareSummary } from '../utils/kubevirtHardwareSummary'

export type UseKubevirtHardwareOptions = {
  vmId: string | null | undefined
  enabled?: boolean
}

export type UseKubevirtHardwareResult = {
  loading: boolean
  error: string | null
  vm: PlatformVm | null
  row: KubeVirtVmSummaryRow | null
  summary: KubevirtHardwareSummary | null
  refresh: () => Promise<void>
}

const KUBEVIRT_HARDWARE_CACHE_MS = 10_000
const kubevirtHardwareCache = new Map<
  string,
  { at: number; vm: PlatformVm | null; row: KubeVirtVmSummaryRow | null }
>()

export function useKubevirtHardware({
  vmId,
  enabled = true,
}: UseKubevirtHardwareOptions): UseKubevirtHardwareResult {
  const active = enabled && Boolean(vmId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vm, setVm] = useState<PlatformVm | null>(null)
  const [row, setRow] = useState<KubeVirtVmSummaryRow | null>(null)

  const refresh = useCallback(async (force = false) => {
    if (!vmId || !active) {
      setVm(null)
      setRow(null)
      setError(null)
      return
    }

    const cached = kubevirtHardwareCache.get(vmId)
    if (!force && cached && Date.now() - cached.at < KUBEVIRT_HARDWARE_CACHE_MS) {
      setVm(cached.vm)
      setRow(cached.row)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const vmRow = await getPlatformVm(vmId)
      setVm(vmRow)
      const ns = vmRow.k8s_namespace ?? 'default'
      let summaryRow: KubeVirtVmSummaryRow | null = null
      try {
        const rows = await getK8sKubevirtVmSummary(ns)
        summaryRow = rows.find((r) => r.name === vmRow.name && r.namespace === ns) ?? null
      } catch {
        summaryRow = null
      }
      setRow(summaryRow)
      kubevirtHardwareCache.set(vmId, { at: Date.now(), vm: vmRow, row: summaryRow })
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [vmId, active])

  useEffect(() => {
    void refresh(false)
  }, [refresh])

  const summary = useMemo(
    () => (vm ? buildKubevirtHardwareSummary(vm, row) : null),
    [vm, row],
  )

  return { loading, error, vm, row, summary, refresh }
}

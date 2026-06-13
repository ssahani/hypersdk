// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPlatformVm, type PlatformVm } from '../api/platform'
import { getK8sKubevirtVmSummary, type KubeVirtVmSummaryRow } from '../api/k8s'
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

export function useKubevirtHardware({
  vmId,
  enabled = true,
}: UseKubevirtHardwareOptions): UseKubevirtHardwareResult {
  const active = enabled && Boolean(vmId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vm, setVm] = useState<PlatformVm | null>(null)
  const [row, setRow] = useState<KubeVirtVmSummaryRow | null>(null)

  const refresh = useCallback(async () => {
    if (!vmId || !active) {
      setVm(null)
      setRow(null)
      setError(null)
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
    } catch (e: unknown) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [vmId, active])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const summary = useMemo(
    () => (vm ? buildKubevirtHardwareSummary(vm, row) : null),
    [vm, row],
  )

  return { loading, error, vm, row, summary, refresh }
}

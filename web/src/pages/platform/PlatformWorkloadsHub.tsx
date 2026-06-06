// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import PlatformZoneHub from '../../components/platform/PlatformZoneHub'
import { platformStatSubtitle } from '../../components/platform/PlatformPageChrome'
import { listPlatformVms } from '../../api/platform'

export default function PlatformWorkloadsHub() {
  const [vmCount, setVmCount] = useState<number | null>(null)
  const [running, setRunning] = useState<number | null>(null)

  useEffect(() => {
    void listPlatformVms()
      .catch(() => [])
      .then((vms) => {
        setVmCount(vms.length)
        setRunning(vms.filter((vm) => vm.observed_state === 'running').length)
      })
  }, [])

  return (
    <PlatformZoneHub
      zoneId="workloads"
      headerIcon={<Package className="w-6 h-6 text-slate-400" />}
      subtitleStats={platformStatSubtitle([
        { label: 'Virtual machines', value: vmCount != null ? String(vmCount) : '—' },
        { label: 'Running', value: running != null ? String(running) : '—' },
      ])}
    />
  )
}

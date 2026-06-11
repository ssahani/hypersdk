// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { Wrench } from 'lucide-react'
import PlatformZoneHub from '../../components/platform/PlatformZoneHub'
import { platformStatSubtitle } from '../../components/platform/PlatformPageChrome'
import { listNotifications, listPlatformTasks } from '../../api/platform'
import { OPERATIONS_HUB_EXTRA_TILES } from '../../utils/platformDashboardZones'

export default function PlatformOperationsHub() {
  const [activeTasks, setActiveTasks] = useState<number | null>(null)
  const [unreadAlerts, setUnreadAlerts] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void Promise.all([
      listPlatformTasks().catch(() => []),
      listNotifications(true).catch(() => []),
    ]).then(([tasks, alerts]) => {
      setActiveTasks(tasks.filter((t) => t.status === 'running' || t.status === 'pending').length)
      setUnreadAlerts(alerts.length)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <PlatformZoneHub
      zoneId="operations"
      loading={loading && activeTasks == null}
      extraTiles={OPERATIONS_HUB_EXTRA_TILES}
      headerIcon={<Wrench className="w-6 h-6 text-slate-400" />}
      subtitleStats={platformStatSubtitle([
        { label: 'Active tasks', value: activeTasks != null ? String(activeTasks) : '—' },
        { label: 'Unread alerts', value: unreadAlerts != null ? String(unreadAlerts) : '—' },
      ])}
    />
  )
}

// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { Server } from 'lucide-react'
import PlatformZoneHub from '../../components/platform/PlatformZoneHub'
import { platformStatSubtitle } from '../../components/platform/PlatformPageChrome'
import { getNetworkSegmentsOverview, getStorageTiersOverview } from '../../api/platform'
import { INFRASTRUCTURE_HUB_EXTRA_TILES } from '../../utils/platformDashboardZones'

export default function PlatformInfrastructureHub({ embedded }: { embedded?: boolean } = {}) {
  const [poolCount, setPoolCount] = useState<number | null>(null)
  const [segmentCount, setSegmentCount] = useState<number | null>(null)

  useEffect(() => {
    void Promise.all([
      getStorageTiersOverview().catch(() => ({ tiers: [] })),
      getNetworkSegmentsOverview().catch(() => ({ segments: [] })),
    ]).then(([storage, segments]) => {
      setPoolCount(storage.tiers?.length ?? 0)
      setSegmentCount(segments.segments?.length ?? 0)
    })
  }, [])

  return (
    <PlatformZoneHub
      zoneId="infrastructure"
      embedded={embedded}
      extraTiles={INFRASTRUCTURE_HUB_EXTRA_TILES}
      headerIcon={<Server className="w-6 h-6 text-slate-400" />}
      subtitleStats={platformStatSubtitle([
        { label: 'Storage tiers', value: poolCount != null ? String(poolCount) : '—' },
        { label: 'Network segments', value: segmentCount != null ? String(segmentCount) : '—' },
      ])}
    />
  )
}

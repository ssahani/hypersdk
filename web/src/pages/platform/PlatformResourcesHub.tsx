// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { HardDrive, Layers, Network, Package } from 'lucide-react'
import PlatformTahoeHero from '../../components/platform/tahoe/PlatformTahoeHero'
import PlatformHubLaunchpad from '../../components/platform/tahoe/PlatformHubLaunchpad'
import { getNetworkSegmentsOverview, getStorageTiersOverview } from '../../api/platform'

export default function PlatformResourcesHub({ embedded }: { embedded?: boolean } = {}) {
  const [poolCount, setPoolCount] = useState<number | null>(null)
  const [segmentCount, setSegmentCount] = useState<number | null>(null)

  useEffect(() => {
    void Promise.all([
      getStorageTiersOverview().catch(() => ({ tiers: [] })),
      getNetworkSegmentsOverview().catch(() => ({ segments: [] })),
    ]).then(([storage, segments]) => {
      setPoolCount(storage.tiers.length)
      setSegmentCount(segments.segments.length)
    })
  }, [])

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6 animate-fade-in'}>
      {!embedded && (
        <PlatformTahoeHero
          compact
          eyebrow="Platform"
          title="Resources"
          subtitle="Storage, networks, images, and templates — macOS Utility folder for your fleet."
          icon={HardDrive}
          stats={[
            { label: 'Storage tiers', value: poolCount != null ? String(poolCount) : '—', tone: 'sky' },
            { label: 'Network segments', value: segmentCount != null ? String(segmentCount) : '—', tone: 'violet' },
          ]}
        />
      )}

      <div className="tahoe-content">
        <PlatformHubLaunchpad
          groups={[
            {
              label: 'Infrastructure',
              subtitle: 'Disk, network, and content libraries',
              tiles: [
                { to: '/platform/storage', label: 'Disk Utility', icon: <HardDrive className="w-8 h-8" strokeWidth={1.75} /> },
                { to: '/platform/networks', label: 'Networks', icon: <Network className="w-8 h-8" strokeWidth={1.75} /> },
                { to: '/platform/content', label: 'Images & ISOs', icon: <Package className="w-8 h-8" strokeWidth={1.75} /> },
                { to: '/platform/templates', label: 'Templates', icon: <Layers className="w-8 h-8" strokeWidth={1.75} /> },
              ],
            },
          ]}
        />
      </div>
    </div>
  )
}

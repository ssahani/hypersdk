// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Settings } from 'lucide-react'
import PlatformZoneHub from '../../components/platform/PlatformZoneHub'
import { ADMINISTRATION_HUB_EXTRA_TILES } from '../../utils/platformDashboardZones'

export default function PlatformAdministrationHub() {
  return (
    <PlatformZoneHub
      zoneId="administration"
      extraTiles={ADMINISTRATION_HUB_EXTRA_TILES}
      headerIcon={<Settings className="w-6 h-6 text-slate-400" />}
    />
  )
}

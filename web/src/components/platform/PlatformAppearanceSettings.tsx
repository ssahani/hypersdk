// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { MacSettingsGroup } from './mac/PlatformMacUi'
import {
  PLATFORM_WALLPAPER_EVENT,
  PLATFORM_WALLPAPER_LABELS,
  loadPlatformWallpaper,
  resetPlatformWallpaper,
  savePlatformWallpaper,
  type PlatformWallpaper,
} from '../../utils/platformWallpaper'
import { getFleetGeneral, type FleetGeneralOverview } from '../../api/platform'
import { openPlatformDockEditor } from '../../utils/platformDockPins'
import { usePlatformDesktopTier } from '../../utils/platformDesktopTier'
import PlatformDesktopTierPicker from './PlatformDesktopTierPicker'

const SWATCH_CLASS: Record<PlatformWallpaper, string> = {
  tahoe: 'mac-wallpaper-swatch-tahoe',
  aurora: 'mac-wallpaper-swatch-aurora',
  midnight: 'mac-wallpaper-swatch-midnight',
  ocean: 'mac-wallpaper-swatch-ocean',
}

export default function PlatformAppearanceSettings() {
  const [wallpaper, setWallpaper] = useState<PlatformWallpaper>(() => loadPlatformWallpaper())
  const [general, setGeneral] = useState<FleetGeneralOverview | null>(null)
  const [tier, setTier] = usePlatformDesktopTier()

  useEffect(() => {
    const onChange = () => setWallpaper(loadPlatformWallpaper())
    window.addEventListener(PLATFORM_WALLPAPER_EVENT, onChange)
    return () => window.removeEventListener(PLATFORM_WALLPAPER_EVENT, onChange)
  }, [])

  useEffect(() => {
    void getFleetGeneral().then(setGeneral).catch(() => setGeneral(null))
  }, [])

  const pick = (next: PlatformWallpaper) => {
    savePlatformWallpaper(next)
    setWallpaper(next)
  }

  return (
    <>
      {general && (
        <MacSettingsGroup title="Fleet summary">
          <p className="text-sm text-white/55 mb-3">{general.summary}</p>
          <div className="grid gap-2 sm:grid-cols-3 text-xs text-white/70">
            <div>Cluster: <span className="text-white">{general.cluster_name}</span></div>
            <div>Controller: <span className="text-white">{general.controller_version}</span></div>
            <div>VMs: <span className="text-white">{general.vm_count}</span></div>
          </div>
        </MacSettingsGroup>
      )}

      <MacSettingsGroup title="Desktop density">
        <PlatformDesktopTierPicker tier={tier} onChange={setTier} />
        <p className="text-xs text-white/40 mt-3">
          Normal hides the status strip and most sidebar apps. Advanced restores the full fleet surface.
        </p>
      </MacSettingsGroup>

      <MacSettingsGroup title="Dock">
        <p className="text-sm text-white/55 mb-3">Pin apps to the Machina dock — same as macOS Customize Dock.</p>
        <button type="button" className="btn-primary text-sm inline-flex items-center gap-2" onClick={openPlatformDockEditor}>
          <LayoutGrid className="w-4 h-4" /> Customize Dock…
        </button>
      </MacSettingsGroup>

      <MacSettingsGroup title="Appearance">
        <p className="text-sm text-white/55 mb-3">Desktop wallpaper for the Machina Platform shell (macOS Tahoe style).</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(PLATFORM_WALLPAPER_LABELS) as PlatformWallpaper[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              className={`rounded-xl border p-2 text-left transition ${
                wallpaper === key ? 'border-sky-400/50 ring-1 ring-sky-400/30' : 'border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className={`h-16 rounded-lg mb-2 ${SWATCH_CLASS[key]}`} />
              <span className="text-xs text-white/80">{PLATFORM_WALLPAPER_LABELS[key]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn-secondary text-sm mt-4" onClick={() => { resetPlatformWallpaper(); setWallpaper('tahoe') }}>
          Reset to default
        </button>
      </MacSettingsGroup>
    </>
  )
}

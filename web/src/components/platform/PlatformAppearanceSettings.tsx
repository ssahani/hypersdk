// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { MacSettingsGroup, MacSettingsGroupBody } from './mac/PlatformMacUi'
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
import { usePlatformDesktopTier } from '../../hooks/usePlatformDesktopTier'
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
          <MacSettingsGroupBody>
            <p className="text-sm text-slate-300 leading-relaxed">{general.summary}</p>
            <div className="grid gap-2 sm:grid-cols-3 text-sm text-slate-400">
              <div>Cluster: <span className="text-slate-100">{general.cluster_name}</span></div>
              <div>Controller: <span className="text-slate-100">{general.controller_version}</span></div>
              <div>VMs: <span className="text-slate-100">{general.vm_count}</span></div>
            </div>
          </MacSettingsGroupBody>
        </MacSettingsGroup>
      )}

      <MacSettingsGroup title="Desktop density">
        <MacSettingsGroupBody>
          <PlatformDesktopTierPicker tier={tier} onChange={setTier} />
          <p className="text-xs text-slate-400 leading-relaxed">
            Normal hides the status strip and most sidebar apps. Advanced restores the full fleet surface.
          </p>
        </MacSettingsGroupBody>
      </MacSettingsGroup>

      <MacSettingsGroup title="Dock">
        <MacSettingsGroupBody>
          <p className="text-sm text-slate-300 leading-relaxed">Pin apps to the Machina dock — same as macOS Customize Dock.</p>
          <button type="button" className="btn-primary text-sm inline-flex items-center gap-2" onClick={openPlatformDockEditor}>
            <LayoutGrid className="w-4 h-4" /> Customize Dock…
          </button>
        </MacSettingsGroupBody>
      </MacSettingsGroup>

      <MacSettingsGroup title="Appearance">
        <MacSettingsGroupBody>
          <p className="text-sm text-slate-300 leading-relaxed">Desktop wallpaper for the Machina Platform shell (macOS Tahoe style).</p>
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
                <span className="text-xs text-slate-200">{PLATFORM_WALLPAPER_LABELS[key]}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary text-sm" onClick={() => { resetPlatformWallpaper(); setWallpaper('tahoe') }}>
            Reset to default
          </button>
        </MacSettingsGroupBody>
      </MacSettingsGroup>
    </>
  )
}

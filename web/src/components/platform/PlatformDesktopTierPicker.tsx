// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import {
  PLATFORM_DESKTOP_TIER_HINTS,
  PLATFORM_DESKTOP_TIER_LABELS,
  type PlatformDesktopTier,
} from '../../utils/platformDesktopTier'

export default function PlatformDesktopTierPicker({
  tier,
  onChange,
}: {
  tier: PlatformDesktopTier
  onChange: (t: PlatformDesktopTier) => void
}) {
  const tiers: PlatformDesktopTier[] = ['normal', 'power', 'advanced']

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/55">
        Choose how much of the Machina fleet desktop to show — like macOS simplicity vs. pro tools.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {tiers.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-xl border p-3 text-left transition ${
              tier === key ? 'border-sky-400/50 ring-1 ring-sky-400/30 bg-sky-500/5' : 'border-white/[0.08] hover:border-white/20'
            }`}
          >
            <span className="text-sm font-medium text-white block">{PLATFORM_DESKTOP_TIER_LABELS[key]}</span>
            <span className="text-[11px] text-white/45 mt-1 block leading-snug">{PLATFORM_DESKTOP_TIER_HINTS[key]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

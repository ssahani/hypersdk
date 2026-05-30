// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { ExternalLink, Sparkles } from 'lucide-react'
import { MacGlassPanel, MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import { usePlatformInfo } from '../../contexts/PlatformInfoContext'
import { integrationCards } from '../../utils/platformIntegrationsNav'
import PlatformDesktopTierPicker from '../../components/platform/PlatformDesktopTierPicker'
import { usePlatformDesktopTier } from '../../hooks/usePlatformDesktopTier'

export default function PlatformIntegrations() {
  const { info } = usePlatformInfo()
  const [tier, setTier] = usePlatformDesktopTier()
  const cards = integrationCards(info)

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      <MacSectionTitle
        title="Apps & Integrations"
        subtitle="Everything the daemon exposes beyond the simple desktop — OpenStack, K8s, migration tools, and classic UI."
      />

      <MacGlassPanel title="Desktop density">
        <p className="text-sm text-slate-400 mb-3">
          Start with <strong className="text-slate-200">Normal</strong> for a clean Finder-style desktop. Switch to Power or Advanced when you need Zeus, firewall modules, and the full sidebar.
        </p>
        <PlatformDesktopTierPicker tier={tier} onChange={setTier} />
      </MacGlassPanel>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.id}
            to={c.href}
            className={`rounded-2xl border p-5 transition block ${
              c.enabled
                ? 'border-white/[0.08] bg-slate-900/50 hover:border-sky-500/40 hover:bg-slate-900/80'
                : 'border-white/[0.04] bg-slate-950/40 opacity-50 pointer-events-none'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-slate-100">{c.title}</h3>
              {c.enabled ? (
                <ExternalLink className="w-4 h-4 text-slate-500 shrink-0" />
              ) : (
                <span className="text-[10px] uppercase text-slate-500">off</span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-2">{c.description}</p>
            {c.enabled && c.configured === false && (
              <p className="text-xs text-amber-400 mt-2">Configured but needs clouds.yaml or auth — open to finish setup.</p>
            )}
          </Link>
        ))}
      </div>

      <MacGlassPanel title="Need more?">
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          Switch to <Link to="/platform/settings?section=general" className="text-blue-400">Settings → Appearance → Advanced</Link> for the full fleet sidebar, Zeus Firewall panes, and developer SDK routes.
        </p>
      </MacGlassPanel>
    </div>
  )
}

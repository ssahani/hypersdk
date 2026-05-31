// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { ExternalLink, Puzzle, Sparkles } from 'lucide-react'
import { MacGlassPanel } from '../../components/platform/mac/PlatformMacUi'
import PlatformTahoeHero from '../../components/platform/tahoe/PlatformTahoeHero'
import { usePlatformInfo } from '../../contexts/PlatformInfoContext'
import { integrationCards } from '../../utils/platformIntegrationsNav'
import { CLASSIC_TOOL_CARDS } from '../../utils/platformClassicTools'
import { PlatformClassicToolLinks } from '../../components/platform/PlatformCrossLinks'
import PlatformDesktopTierPicker from '../../components/platform/PlatformDesktopTierPicker'
import { usePlatformDesktopTier } from '../../hooks/usePlatformDesktopTier'

export default function PlatformIntegrations() {
  const { info } = usePlatformInfo()
  const [tier, setTier] = usePlatformDesktopTier()
  const cards = integrationCards(info)
  const enabledCount = cards.filter((c) => c.enabled).length

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PlatformTahoeHero
        eyebrow="Platform"
        title="Apps & Integrations"
        subtitle="Everything the daemon exposes beyond the simple desktop — OpenStack, K8s, migration tools, and classic UI."
        icon={Puzzle}
        stats={[
          { label: 'Available', value: String(cards.length), tone: 'sky' },
          { label: 'Enabled', value: String(enabledCount), tone: 'emerald' },
          { label: 'Desktop tier', value: tier.charAt(0).toUpperCase() + tier.slice(1), tone: 'violet' },
        ]}
      />

      <div className="tahoe-content space-y-6">
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
              className={`tahoe-integration-card ${c.enabled ? 'tahoe-glass-card' : 'tahoe-integration-card-disabled'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-100">{c.title}</h3>
                {c.enabled ? (
                  <ExternalLink className="w-4 h-4 text-slate-500 shrink-0" />
                ) : (
                  <span className="text-[10px] uppercase text-slate-500">off</span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{c.description}</p>
              {c.enabled && c.configured === false && (
                <p className="text-xs text-amber-400 mt-2">Configured but needs clouds.yaml or auth — open to finish setup.</p>
              )}
            </Link>
          ))}
        </div>

        <MacGlassPanel title="Classic Machina tools">
          <p className="text-sm text-slate-400 mb-4 leading-relaxed">
            Import wizards, libvirt node tools, NW filters, secrets, and the classic audit viewer — same daemon, classic UI chrome.
          </p>
          <PlatformClassicToolLinks tools={CLASSIC_TOOL_CARDS} />
        </MacGlassPanel>

        <MacGlassPanel title="Leaving the desktop">
          <p className="text-sm text-slate-400 leading-relaxed">
            OpenStack, HyperSDK, GuestKit, and classic routes open outside the Platform shell. You stay signed in to the same Machina session — use the sidebar or <Link to="/platform" className="text-blue-400">Platform home</Link> to return.
          </p>
        </MacGlassPanel>

        <MacGlassPanel title="Need more?">
          <p className="text-sm text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            Switch to <Link to="/platform/settings?section=general" className="text-blue-400">Settings → Appearance → Advanced</Link> for the full fleet sidebar, Zeus Firewall panes, and developer SDK routes.
          </p>
        </MacGlassPanel>
      </div>
    </div>
  )
}

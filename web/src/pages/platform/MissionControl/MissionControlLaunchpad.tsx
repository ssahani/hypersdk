// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import {
  Boxes,
  HardDrive,
  Monitor,
  Plus,
  Search,
  Shield,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router'
import { LaunchpadAppIcon } from '../../../components/platform/mac/PlatformMacUi'
import { cinemaPopoutPath } from '../../../utils/consoleExperienceMode'
import { openCenterPopout } from '../../../utils/platformCenterPopout'
import type { PlatformVm } from '../../../api/platform'

type Props = {
  onCreateVm: () => void
  lastVm?: PlatformVm | null
}

const CARDS: Array<{
  id: string
  label: string
  subtitle: string
  icon: typeof Plus
  href?: string
  action?: 'create' | 'console'
}> = [
  { id: 'create', label: 'Create VM', subtitle: '4-step wizard', icon: Plus, action: 'create' },
  { id: 'security', label: 'Security Center', subtitle: 'Firewall & risk', icon: Shield, href: '/platform/zeus/security' },
  { id: 'finder', label: 'Machine Finder', subtitle: 'Discover VMs', icon: Search, href: '/platform/vms' },
  { id: 'recovery', label: 'Recovery', subtitle: 'Snapshots', icon: HardDrive, href: '/platform/backups' },
  { id: 'gpu', label: 'GPU Command Center', subtitle: 'Scheduling', icon: Sparkles, href: '/platform/gpu' },
  { id: 'migrate', label: 'Migration Planner', subtitle: 'Drag & drop', icon: Boxes, href: '/platform/vms?lens=migration' },
  { id: 'golden', label: 'Golden Image Builder', subtitle: 'Templates', icon: Wrench, href: '/platform/vm-builder' },
  { id: 'console', label: 'Machina Cinema', subtitle: 'Live console', icon: Monitor, action: 'console' },
  { id: 'live-wall', label: 'Live Preview Wall', subtitle: 'Fleet grid', icon: Monitor, href: '/platform/mission-control/live' },
  { id: 'trace', label: 'PacketWolf Trace', subtitle: 'Network path', icon: Terminal, href: '/platform/zeus' },
]

export default function MissionControlLaunchpad({ onCreateVm, lastVm }: Props) {
  return (
    <section data-testid="mission-control-launchpad">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-3">Launchpad</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-6">
        {CARDS.map((card) => {
          const Icon = card.icon
          const inner = (
            <div className="mc-launchpad-card transition-transform hover:-translate-y-1">
              <LaunchpadAppIcon name={card.label} icon={<Icon className="w-9 h-9 sm:w-10 sm:h-10" strokeWidth={1.5} />} />
              <p className="text-[10px] text-slate-500 text-center mt-1 truncate px-1">{card.subtitle}</p>
            </div>
          )
          if (card.action === 'create') {
            return <button key={card.id} type="button" className="text-left" onClick={onCreateVm}>{inner}</button>
          }
          if (card.action === 'console') {
            return (
              <button
                key={card.id}
                type="button"
                className="text-left"
                onClick={() => {
                  if (lastVm) openCenterPopout(cinemaPopoutPath(lastVm.id))
                  else window.location.href = '/platform/vms'
                }}
              >
                {inner}
              </button>
            )
          }
          return <Link key={card.id} to={card.href!} className="block">{inner}</Link>
        })}
      </div>
    </section>
  )
}

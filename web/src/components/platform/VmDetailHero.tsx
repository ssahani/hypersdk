// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Activity, Monitor, Shield, Sparkles, Terminal, Zap } from 'lucide-react'
import { gradientForName } from './mac/PlatformMacUi'
import type { VmDetailBlocker } from '../../utils/vmDetailSpotlight'

type Props = {
  vmName: string
  observedState: string
  guestIp?: string
  hostLabel?: string
  healthScore?: number | null
  doctorScore?: number | null
  sshExposed?: boolean
  blockers?: VmDetailBlocker[]
  onOpenAccess?: () => void
  onOpenDoctor?: () => void
}

function stateTone(state: string): string {
  if (state === 'running') return 'text-emerald-300'
  if (state === 'paused') return 'text-violet-300'
  if (state === 'missing' || state === 'failed') return 'text-red-300'
  return 'text-slate-400'
}

export default function VmDetailHero({
  vmName,
  observedState,
  guestIp,
  hostLabel,
  healthScore,
  doctorScore,
  sshExposed,
  blockers = [],
  onOpenAccess,
  onOpenDoctor,
}: Props) {
  const running = observedState === 'running'
  const gradient = gradientForName(vmName)
  const blockerCount = blockers.length
  const ready = running && Boolean(guestIp?.trim()) && (sshExposed || !blockers.includes('ssh_not_exposed'))

  return (
    <div className="vm-detail-hero animate-fade-in" data-testid="vm-detail-hero">
      <div className="vm-detail-hero-glow" aria-hidden />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`vm-detail-hero-icon bg-gradient-to-br ${gradient} ${running ? 'vm-detail-hero-icon--live' : ''}`}>
            <Monitor className="w-6 h-6 text-white drop-shadow-sm" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Virtual machine</p>
            <h2 className="text-lg font-semibold text-slate-50 truncate tracking-tight">{vmName}</h2>
            <p className="text-sm text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`inline-flex items-center gap-1.5 ${stateTone(observedState)}`}>
                {running && <span className="vm-detail-live-dot" aria-hidden />}
                {observedState}
              </span>
              {hostLabel && (
                <>
                  <span className="text-slate-600">·</span>
                  <span>{hostLabel}</span>
                </>
              )}
              {guestIp && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="font-mono text-emerald-300/90">{guestIp}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {ready ? (
            <span className="vm-detail-hero-pill vm-detail-hero-pill--ok">
              <Zap className="w-3.5 h-3.5" /> Ready to connect
            </span>
          ) : blockerCount > 0 ? (
            <button
              type="button"
              className="vm-detail-hero-pill vm-detail-hero-pill--warn"
              onClick={onOpenAccess}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {blockerCount} blocker{blockerCount === 1 ? '' : 's'} — fix in Access
            </button>
          ) : null}
          {healthScore != null && !Number.isNaN(healthScore) && (
            <span className="vm-detail-hero-pill">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Health {healthScore}
            </span>
          )}
          {doctorScore != null && (
            <button type="button" className="vm-detail-hero-pill" onClick={onOpenDoctor}>
              <Shield className="w-3.5 h-3.5 text-violet-400" />
              Doctor {doctorScore}/100
            </button>
          )}
          {sshExposed && (
            <span className="vm-detail-hero-pill vm-detail-hero-pill--ok">
              <Terminal className="w-3.5 h-3.5" /> SSH exposed
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

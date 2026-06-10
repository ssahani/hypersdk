// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ReactNode } from 'react'

type AuraTone = 'healthy' | 'warning' | 'failing' | 'migrating' | 'stopped' | 'snapshot'

export function machineAuraClass(tone: AuraTone): string {
  switch (tone) {
    case 'healthy':
      return 'ring-2 ring-emerald-500/30 shadow-[0_0_24px_rgba(16,185,129,0.12)]'
    case 'warning':
      return 'ring-2 ring-amber-500/35 shadow-[0_0_24px_rgba(245,158,11,0.12)]'
    case 'failing':
      return 'ring-2 ring-red-500/40 shadow-[0_0_28px_rgba(239,68,68,0.15)]'
    case 'migrating':
      return 'ring-2 ring-sky-500/40 shadow-[0_0_28px_rgba(56,189,248,0.15)] animate-pulse'
    case 'snapshot':
      return 'ring-2 ring-violet-500/35 shadow-[0_0_24px_rgba(139,92,246,0.12)]'
    default:
      return 'ring-1 ring-slate-700/50'
  }
}

export function machineAuraTone(
  vmState?: string | null,
  healthScore?: number | null,
): AuraTone {
  const s = (vmState ?? '').toLowerCase()
  if (s.includes('migrat')) return 'migrating'
  if (s.includes('stop') || s.includes('shut')) return 'stopped'
  if (s.includes('fail') || s.includes('crash') || s.includes('error')) return 'failing'
  if (healthScore != null && healthScore < 60) return 'failing'
  if (healthScore != null && healthScore < 85) return 'warning'
  if (s.includes('run') || s === 'active') return 'healthy'
  return 'stopped'
}

type Props = {
  children: ReactNode
  vmState?: string | null
  healthScore?: number | null
  theatre?: boolean
  className?: string
}

export default function MachineCanvas({ children, vmState, healthScore, theatre, className = '' }: Props) {
  const tone = machineAuraTone(vmState, healthScore)
  return (
    <div
      className={`relative flex-1 min-h-0 rounded-xl overflow-hidden bg-[#0a0a0c] ${machineAuraClass(tone)} ${theatre ? 'min-h-[calc(100dvh-8rem)]' : 'min-h-[50vh]'} ${className}`}
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="absolute inset-0 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
/** VM state visuals aligned with HyperSDK k8s-vms palette. */

export type VmSemanticKind =
  | 'running'
  | 'stopped'
  | 'paused'
  | 'creating'
  | 'failed'
  | 'migrating'
  | 'suspended'
  | 'unknown'

/** Normalize libvirt + platform API state strings to a visual kind. */
export function vmSemanticKind(state: string | undefined | null): VmSemanticKind {
  const s = (state ?? '').toLowerCase().trim().replace(/_/g, ' ')
  if (!s) return 'unknown'
  if (s === 'running' || s === 'active' || s === 'poweredon' || s === 'powered on') return 'running'
  if (s === 'paused') return 'paused'
  if (
    s === 'creating' ||
    s === 'building' ||
    s === 'provisioning' ||
    s === 'pending' ||
    s === 'shutting down' ||
    s === 'missing'
  ) {
    return 'creating'
  }
  if (s === 'failed' || s === 'crashed' || s === 'error') return 'failed'
  if (s.includes('migrat')) return 'migrating'
  if (s === 'suspended' || s === 'blocked') return 'suspended'
  if (
    s === 'shutoff' ||
    s === 'stopped' ||
    s === 'shut off' ||
    s === 'poweredoff' ||
    s === 'powered off' ||
    s === 'inactive'
  ) {
    return 'stopped'
  }
  return 'unknown'
}

export const VM_LAUNCHPAD_GRADIENTS: Record<VmSemanticKind, string> = {
  running: 'from-emerald-500 to-emerald-900',
  stopped: 'from-gray-500 to-gray-800',
  paused: 'from-purple-500 to-purple-900',
  creating: 'from-amber-500 to-amber-900',
  failed: 'from-red-500 to-red-900',
  migrating: 'from-blue-500 to-blue-900',
  suspended: 'from-blue-600 to-indigo-900',
  unknown: 'from-slate-500 to-slate-800',
}

export function vmLaunchpadGradient(state: string | undefined | null): string {
  return VM_LAUNCHPAD_GRADIENTS[vmSemanticKind(state)]
}

export function vmStatusBadgeClasses(
  state: string | undefined | null,
  variant: 'soft' | 'solid' = 'soft',
): string {
  const kind = vmSemanticKind(state)
  const base = `machina-vm-status machina-vm-status--${kind}`
  return variant === 'solid' ? `${base} machina-vm-status--solid` : base
}

export function vmCardAccentClass(state: string | undefined | null): string {
  return `machina-vm-card-accent machina-vm-card-accent--${vmSemanticKind(state)}`
}

export function vmStatusDotClass(state: string | undefined | null): string {
  const kind = vmSemanticKind(state)
  const pulse = kind === 'running' ? ' machina-vm-dot--pulse' : ''
  return `machina-vm-dot machina-vm-dot--${kind}${pulse}`
}

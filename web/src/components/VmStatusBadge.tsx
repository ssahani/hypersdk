// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { vmStatusBadgeClasses } from '../utils/vmVisual'

interface VmStatusBadgeProps {
  state: string | undefined | null
  /** solid = HyperSDK-style filled pill; soft = glass-friendly tint */
  variant?: 'soft' | 'solid'
  className?: string
}

export default function VmStatusBadge({ state, variant = 'soft', className = '' }: VmStatusBadgeProps) {
  const label = (state ?? 'unknown').replace(/_/g, ' ')
  return (
    <span className={`${vmStatusBadgeClasses(state, variant)} ${className}`.trim()} title={label}>
      {label}
    </span>
  )
}

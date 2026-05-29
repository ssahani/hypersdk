// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { MacGlassPanel } from './mac/PlatformMacUi'

export default function PlatformEmptyState({
  title,
  subtitle,
  children,
  action,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <MacGlassPanel title={title} subtitle={subtitle} action={action}>
      {children && <div className="text-sm text-slate-400 leading-relaxed -mt-2">{children}</div>}
    </MacGlassPanel>
  )
}

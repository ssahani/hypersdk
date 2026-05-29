// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'

interface ActionCardProps {
  to?: string
  onClick?: () => void
  icon: React.ReactNode
  title: string
  subtitle?: string
}

export default function ActionCard({ to, onClick, icon, title, subtitle }: ActionCardProps) {
  const className =
    'platform-action-card flex flex-col items-start gap-3 p-5 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/80 to-slate-950/80 hover:from-slate-800/80 hover:to-slate-900/80 hover:border-slate-600/60 transition-all text-left w-full'
  const inner = (
    <>
      <div className="p-2.5 rounded-xl bg-slate-800/80 text-slate-200">{icon}</div>
      <div>
        <p className="font-semibold text-slate-100">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </>
  )
  if (to) {
    return <Link to={to} className={className}>{inner}</Link>
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  )
}

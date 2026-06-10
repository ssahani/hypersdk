// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

type Props = {
  className?: string
  healthy?: boolean
}

/** CSS/SVG hero visual — host cube with orbit ring. */
export default function HostOrb({ className = '', healthy = true }: Props) {
  return (
    <div className={`mc-host-orb relative w-32 h-32 sm:w-40 sm:h-40 ${className}`} aria-hidden data-testid="host-orb">
      <div className="absolute inset-0 rounded-full bg-gradient-to-t from-sky-950/80 via-transparent to-cyan-500/10 blur-sm" />
      <div className={`absolute inset-2 rounded-full border border-dashed ${healthy ? 'border-cyan-400/30' : 'border-amber-400/30'} animate-[spin_24s_linear_infinite]`} />
      <div className="absolute inset-6 rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-white/10 shadow-[0_0_40px_rgba(56,189,248,0.15)] flex items-center justify-center">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-sky-500/40 to-indigo-600/30 border border-white/10" />
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-8 bg-cyan-500/20 blur-xl rounded-full" />
    </div>
  )
}

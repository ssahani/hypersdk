// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link, useLocation } from 'react-router'
import { AlertTriangle, Home, Search, Sparkles } from 'lucide-react'
import PageLayout from '../../components/PageLayout'
import { dispatchOpenSpotlight } from '../../utils/platformJarvisShell'
import { useAi } from '../../contexts/AiContext'

export default function PlatformNotFound() {
  const location = useLocation()
  const { openCopilot } = useAi()

  return (
    <PageLayout compact hideHeader contentClassName="mission-control-page">
      <section className="max-w-lg mx-auto rounded-2xl border border-white/[0.08] bg-slate-950/60 p-8 text-center space-y-4" data-testid="platform-not-found">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h1 className="text-xl font-semibold text-white">Route not found</h1>
        <p className="text-sm text-slate-400">This platform route does not exist or the session may have expired.</p>
        <dl className="text-left text-xs bg-black/30 rounded-lg p-3 space-y-1 font-mono text-slate-500">
          <div><dt className="inline text-slate-600">Path: </dt><dd className="inline text-slate-300">{location.pathname}</dd></div>
        </dl>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link to="/platform" className="btn-primary text-sm inline-flex items-center gap-1"><Home className="w-4 h-4" /> Mission Control</Link>
          <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" onClick={() => dispatchOpenSpotlight()}><Search className="w-4 h-4" /> Spotlight</button>
          <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" onClick={() => openCopilot()}><Sparkles className="w-4 h-4" /> Ask Zyra</button>
        </div>
      </section>
    </PageLayout>
  )
}

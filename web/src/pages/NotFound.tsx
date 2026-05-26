// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router'
import { Home, Server, Search, Zap } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] text-center animate-fade-in px-4 py-12">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 mb-6">
        <Zap className="w-7 h-7 text-blue-400" aria-hidden />
      </div>
      <h1 className="text-7xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-3">
        404
      </h1>
      <p className="text-slate-200 font-medium mb-2">Page not found</p>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
        The page you are looking for does not exist or has been moved. Open the command palette to jump anywhere in
        Machina.
      </p>
      <p className="text-xs text-slate-500 mb-6">
        Press{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-300 font-mono">
          Ctrl+K
        </kbd>{' '}
        <span className="inline-flex items-center gap-1 text-slate-500">
          <Search className="w-3.5 h-3.5" aria-hidden />
          command palette
        </span>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all"
        >
          <Home className="w-4 h-4" aria-hidden /> Dashboard
        </Link>
        <Link
          to="/vms"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm transition"
        >
          <Server className="w-4 h-4" aria-hidden /> Virtual Machines
        </Link>
      </div>
    </div>
  )
}

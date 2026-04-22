import { useState, FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme, type AppTheme } from '../contexts/ThemeContext'
import { Lock, User, AlertCircle, Server, Network, Activity, Zap } from 'lucide-react'

const features = [
  {
    icon: <Server className="w-5 h-5 text-white" />,
    gradient: 'bg-gradient-to-br from-blue-500 to-blue-700',
    title: 'VM Lifecycle Management',
    description: 'Create, start, stop, snapshot, and migrate virtual machines with full console access.',
  },
  {
    icon: <Network className="w-5 h-5 text-white" />,
    gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
    title: 'Network & Storage',
    description: 'Visual network topology, port forwarding, storage pools, and firewall rules.',
  },
  {
    icon: <Activity className="w-5 h-5 text-white" />,
    gradient: 'bg-gradient-to-br from-purple-500 to-purple-700',
    title: 'Monitoring & Automation',
    description: 'Live metrics, alerts, webhooks, scheduled actions, and Prometheus integration.',
  },
]

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const { theme, setTheme } = useTheme()
  const isLight = theme === 'light'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Username and password are required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await login(username.trim(), password)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex relative">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
        <label htmlFor="login-theme" className="sr-only">Theme</label>
        <select
          id="login-theme"
          aria-label="Theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value as AppTheme)}
          className="text-xs rounded-lg border border-slate-600/80 bg-slate-900/90 text-slate-200 px-2 py-1.5 backdrop-blur-sm"
        >
          <option value="dark">Dark</option>
          <option value="steel">Steel</option>
          <option value="light">Light</option>
        </select>
      </div>
      {/* Left Panel — Feature Showcase (desktop only) */}
      <div className={`hidden lg:flex lg:w-[60%] relative overflow-hidden flex-col items-center justify-center px-12 ${
        isLight
          ? 'bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100'
          : 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900'
      }`}>
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 login-grid-pattern" />

        {/* Floating orbs */}
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl animate-float ${
          isLight ? 'bg-blue-200/30' : 'bg-blue-500/20'
        }`} />
        <div className={`absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl animate-float ${
          isLight ? 'bg-indigo-200/20' : 'bg-indigo-500/15'
        }`} style={{ animationDelay: '3s' }} />

        {/* Content */}
        <div className="relative z-10 max-w-lg">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <span className={`text-4xl font-bold bg-gradient-to-r bg-clip-text text-transparent ${
              isLight ? 'from-slate-800 to-slate-600' : 'from-white to-slate-300'
            }`}>
              virtspawn
            </span>
          </div>

          {/* Tagline */}
          <p className={`text-lg max-w-md ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Modern libvirt VM management. Web UI, console access, and automation in one daemon.
          </p>

          {/* Divider */}
          <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full mt-6 mb-8" />

          {/* Feature cards */}
          <div className="space-y-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`flex items-start gap-4 p-4 rounded-xl backdrop-blur-sm animate-fade-in ${
                  isLight
                    ? 'bg-slate-200/50 border border-slate-300/50'
                    : 'bg-white/5 border border-white/10'
                }`}
                style={{ animationDelay: `${0.2 + i * 0.2}s`, animationFillMode: 'both' }}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${f.gradient}`}>
                  {f.icon}
                </div>
                <div>
                  <div className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{f.title}</div>
                  <div className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{f.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className={`w-full lg:w-[40%] min-h-screen flex items-center justify-center px-6 py-12 relative ${
        isLight
          ? 'bg-slate-50 lg:border-l lg:border-slate-200/50'
          : 'bg-slate-950 lg:border-l lg:border-slate-800/50'
      }`}>
        {/* Mobile floating orbs (since left panel is hidden) */}
        <div className={`lg:hidden absolute top-1/6 left-1/6 w-64 h-64 rounded-full blur-3xl animate-float ${
          isLight ? 'bg-blue-200/20' : 'bg-blue-500/10'
        }`} />
        <div className={`lg:hidden absolute bottom-1/6 right-1/6 w-48 h-48 rounded-full blur-3xl animate-float ${
          isLight ? 'bg-indigo-200/15' : 'bg-indigo-500/10'
        }`} style={{ animationDelay: '3s' }} />

        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo (hidden on desktop where left panel shows it) */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/20 mb-4">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h1 className={`text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent ${
              isLight ? 'from-slate-800 to-slate-600' : 'from-white to-slate-300'
            }`}>virtspawn</h1>
            <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Sign in with your system account</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-6">
            <h2 className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Sign in</h2>
            <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Access your virtual infrastructure</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className={`rounded-2xl p-8 shadow-2xl space-y-5 ${
              isLight
                ? 'bg-white border border-slate-200'
                : 'bg-slate-800/50 border border-slate-700/50 shadow-black/20'
            }`}
            autoComplete="on"
          >
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-username" className={`block text-sm mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Username</label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                      : 'bg-slate-900/80 border-slate-700/50 text-white placeholder-slate-500'
                  }`}
                  placeholder="root"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className={`block text-sm mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                      : 'bg-slate-900/80 border-slate-700/50 text-white placeholder-slate-500'
                  }`}
                  placeholder="Password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-all duration-200 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className={`text-xs text-center mt-4 max-w-sm mx-auto leading-relaxed ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Same username and password as SSH (PAM stack <code className={`text-[11px] px-1 rounded ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>sshd</code> by default). Not a separate virtspawn password — if you only use SSH keys, run{' '}
            <code className={`text-[11px] px-1 rounded ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>passwd</code>{' '}
            on the server first.
          </p>
        </div>
      </div>
    </div>
  )
}

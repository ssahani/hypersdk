import { useEffect, useState, FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { beginOidcLogin, getAuthProviders, type AuthProviders } from '../api/auth'
import {
  Lock,
  User,
  AlertCircle,
  Server,
  Network,
  Activity,
  Zap,
  Moon,
  Cloud,
  Sun,
  Boxes,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle,
  HardDrive,
} from 'lucide-react'

const LOGIN_ORBS = [
  { size: 300, top: '6%', left: '8%', delay: '0s', duration: '10s' },
  { size: 200, top: '58%', left: '14%', delay: '2.5s', duration: '12s' },
  { size: 160, top: '22%', left: '62%', delay: '1s', duration: '9s' },
  { size: 380, top: '62%', left: '70%', delay: '3s', duration: '14s' },
]

const features = [
  {
    icon: <OpenStackLogo className="w-5 h-5" />,
    gradient: 'from-red-500/90 to-orange-700/90',
    title: 'OpenStack Nova & Glance',
    description:
      'Manage private-cloud instances and images from the same UI as libvirt — Keystone on the host, Packstack/RDO wire script, qcow2 upload without Horizon.',
    highlight: true,
  },
  {
    icon: <Server className="w-5 h-5 text-blue-200" />,
    gradient: 'from-blue-500/90 to-blue-800/90',
    title: 'Guests & lifecycle',
    description: 'Create, start, stop, snapshot, and migrate libvirt-backed QEMU/KVM guests with full console access.',
  },
  {
    icon: <Network className="w-5 h-5 text-emerald-200" />,
    gradient: 'from-emerald-500/90 to-emerald-800/90',
    title: 'Host networking & storage',
    description: 'Visual topology, port forwarding, storage pools, and firewall rules on this hypervisor node.',
  },
  {
    icon: <Activity className="w-5 h-5 text-purple-200" />,
    gradient: 'from-purple-500/90 to-purple-800/90',
    title: 'Monitoring & automation',
    description: 'Live metrics, alerts, webhooks, scheduled actions, and Prometheus integration.',
  },
  {
    icon: <Boxes className="w-5 h-5 text-orange-200" />,
    gradient: 'from-orange-500/90 to-rose-700/90',
    title: 'KubeVirt & qcow2 upload',
    description: 'Push any golden qcow2 to Kubernetes — Linux or Windows guest profiles, CDI upload, virtctl from Disk Images.',
  },
]

function OpenStackLogo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M4 4h16v3H4z" fill="#ED1944" />
      <path d="M4 9h5v6H4zm11 0h5v6h-5z" fill="#ED1944" />
      <path d="M4 17h16v3H4z" fill="#ED1944" />
    </svg>
  )
}

function BoltLogo({ className = 'w-7 h-7' }: { className?: string }) {
  return <Zap className={className} aria-hidden />
}

export default function LoginPage() {
  const saved = (() => {
    try {
      const raw = localStorage.getItem('machina-saved-login')
      return raw ? (JSON.parse(raw) as { username?: string; password?: string }) : null
    } catch {
      return null
    }
  })()

  const [username, setUsername] = useState(saved?.username ?? '')
  const [password, setPassword] = useState(saved?.password ? atob(saved.password) : '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(!!saved)
  const [providers, setProviders] = useState<AuthProviders>({
    pam: { enabled: true },
    oidc: { enabled: false, button_label: 'Sign in with SSO' },
  })
  const { login } = useAuth()
  const { theme, setTheme } = useTheme()
  const isLight = theme === 'light'

  useEffect(() => {
    void getAuthProviders().then(setProviders).catch(() => {})
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'oidc') {
      setError('SSO login failed')
    }
  }, [])

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
      if (rememberMe) {
        localStorage.setItem(
          'machina-saved-login',
          JSON.stringify({ username: username.trim(), password: btoa(password) }),
        )
      } else {
        localStorage.removeItem('machina-saved-login')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`login-page min-h-screen flex flex-col lg:flex-row ${isLight ? 'login-page-light' : ''}`}>
      <ThemeSwitcher theme={theme} setTheme={setTheme} isLight={isLight} />

      <aside className="login-hero hidden lg:flex lg:w-[58%] flex-col justify-between p-12 overflow-hidden relative">
        {LOGIN_ORBS.map((orb, i) => (
          <div
            key={i}
            className="login-orb"
            style={{
              width: orb.size,
              height: orb.size,
              top: orb.top,
              left: orb.left,
              ['--login-delay' as string]: orb.delay,
              ['--login-duration' as string]: orb.duration,
            }}
          />
        ))}

        <div className="relative z-10">
          <div className="login-fade-in flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/25 border border-blue-400/20">
              <BoltLogo className="w-7 h-7 text-white" />
            </div>
            <span className="text-4xl font-bold tracking-tight text-white">Machina</span>
          </div>
          <h2 className="login-fade-in login-fade-in-d1 text-4xl font-extrabold text-white leading-[1.12] mb-4 max-w-lg">
            Libvirt + OpenStack
            <br />
            <span className="login-text-gradient">on one hypervisor host</span>
          </h2>
          <p className="login-fade-in login-fade-in-d2 text-lg text-slate-300/90 max-w-md leading-relaxed">
            QEMU/KVM under libvirt, plus Nova and Glance when your cloud is wired — consoles, storage, automation, and
            block upload to Glance, without Horizon.
          </p>
          <div className="login-fade-in login-fade-in-d3 flex flex-wrap gap-2 mt-6">
            <span className="login-stat-pill">
              <OpenStackLogo className="w-3 h-3" /> OpenStack
            </span>
            <span className="login-stat-pill">
              <HardDrive className="w-3 h-3" /> qcow2 → K8s
            </span>
            <span className="login-stat-pill">PAM auth</span>
            <span className="login-stat-pill">Windows + Linux</span>
          </div>
        </div>

        <div className="relative z-10 space-y-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`login-fade-in flex items-start gap-4 p-4 rounded-xl backdrop-blur-sm ${
                'highlight' in f && f.highlight
                  ? 'bg-red-950/25 border border-red-500/25'
                  : 'bg-white/[0.04] border border-white/10'
              }`}
              style={{ animationDelay: `${0.35 + i * 0.08}s`, opacity: 0 }}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br ${f.gradient} shadow-lg`}>
                {f.icon}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{f.title}</div>
                <p className="text-xs mt-1 text-slate-400">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="login-panel flex-1 flex items-center justify-center relative px-6 py-12 min-h-screen">
        <div className="login-panel-grid" aria-hidden />
        <div className="w-full max-w-[400px] relative z-10">
          <MobileBrand />
          <DesktopHeading isLight={isLight} />

          <form onSubmit={handleSubmit} className="login-glass rounded-2xl p-8 shadow-2xl" autoComplete="on">
            {error && (
              <div className="flex items-center gap-2.5 bg-red-950/50 border border-red-500/40 rounded-xl p-3 mb-6">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span className="text-sm text-red-300">{error}</span>
              </div>
            )}

            <div className="space-y-5">
              <Field label="Username" id="login-username">
                <User className="login-field-icon" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="root"
                  className="login-input"
                />
              </Field>

              <Field label="Password" id="login-password">
                <Lock className="login-field-icon" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="login-input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>
            </div>

            <label className="flex items-center gap-2.5 mt-5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => {
                  setRememberMe(e.target.checked)
                  if (!e.target.checked) localStorage.removeItem('machina-saved-login')
                }}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 accent-blue-500"
              />
              <span className="text-sm text-slate-400">Remember me on this device</span>
            </label>

            <button type="submit" disabled={submitting || !username || !password} className="login-btn-primary">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin relative z-10" />
                  <span className="relative z-10">Signing in…</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Sign in</span>
                  <ArrowRight className="h-4 w-4 relative z-10" />
                </>
              )}
            </button>

            {providers.oidc.enabled && (
              <>
                <OidcDivider isLight={isLight} />
                <button type="button" onClick={() => beginOidcLogin()} className="login-btn-secondary w-full mt-4">
                  {providers.oidc.button_label}
                </button>
              </>
            )}

            <div className="mt-6 pt-5 border-t border-slate-700/50 flex items-center justify-center gap-2 text-xs text-slate-500">
              <CheckCircle className="h-3.5 w-3.5 text-slate-600" />
              <span>Secured with system PAM (same as SSH)</span>
            </div>
          </form>

          <p className={`text-xs text-center mt-4 max-w-sm mx-auto leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
            {providers.oidc.enabled
              ? 'Use your system account or organization SSO, depending on daemon configuration.'
              : <>Same credentials as SSH. If you only use SSH keys, run <code className="text-[11px] px-1 rounded bg-slate-800/80">passwd</code> on the server first.</>}
          </p>
        </div>
      </main>
    </div>
  )
}


function ThemeSwitcher({
  theme,
  setTheme,
  isLight,
}: {
  theme: string
  setTheme: (t: 'dark' | 'steel' | 'light') => void
  isLight: boolean
}) {
  return (
    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30" role="group" aria-label="Theme">
      <div
        className={`grid grid-cols-3 gap-1.5 w-[11.5rem] rounded-xl p-1 backdrop-blur-md border ${
          isLight ? 'border-slate-300/80 bg-white/90' : 'border-slate-600/60 bg-slate-900/80'
        }`}
      >
        {(
          [
            { id: 'dark' as const, label: 'Dark', Icon: Moon },
            { id: 'steel' as const, label: 'Steel', Icon: Cloud },
            { id: 'light' as const, label: 'Light', Icon: Sun },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            className={`rounded-lg border px-1.5 py-2 text-[10px] font-semibold uppercase tracking-wide flex flex-col items-center gap-1 transition ${
              theme === id
                ? isLight
                  ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-200'
                  : 'border-blue-500 bg-blue-950/50 text-blue-200 ring-2 ring-blue-500/50'
                : isLight
                  ? 'border-transparent text-slate-600 hover:bg-slate-100'
                  : 'border-transparent text-slate-300 hover:bg-slate-800/80'
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function MobileBrand() {
  return (
    <div className="lg:hidden text-center mb-8">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/20 mb-4 border border-blue-400/20">
        <BoltLogo className="w-7 h-7 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-white">Machina</h1>
      <p className="text-sm mt-1 text-slate-400">Libvirt · OpenStack · sign in</p>
    </div>
  )
}

function DesktopHeading({ isLight }: { isLight: boolean }) {
  return (
    <div className="hidden lg:block mb-8">
      <h2 className={`text-2xl font-bold mb-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>Welcome back</h2>
      <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        Sign in to libvirt, OpenStack, and automation on this host
      </p>
    </div>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      <div className="relative group">{children}</div>
    </div>
  )
}

function OidcDivider({ isLight }: { isLight: boolean }) {
  return (
    <div className={`relative py-3 mt-4 text-center text-xs uppercase tracking-[0.22em] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
      <span className={`relative px-2 ${isLight ? 'bg-white' : 'bg-slate-900/40'}`}>or</span>
      <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 border-t ${isLight ? 'border-slate-200' : 'border-slate-700/60'}`} />
    </div>
  )
}

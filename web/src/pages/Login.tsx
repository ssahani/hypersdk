import { useEffect, useState, FormEvent, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { ZyvorBrandLine } from '../components/ZyvorBrand'
import { beginOidcLogin, getAuthProviders, type AuthProviders } from '../api/auth'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { formatUserError } from '../utils/apiError'
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
  Boxes,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle,
  HardDrive,
  Sparkles,
} from 'lucide-react'

const LOGIN_ORBS = [
  { size: 340, top: '4%', left: '6%', delay: '0s', duration: '11s', hue: 'blue' as const },
  { size: 220, top: '55%', left: '12%', delay: '2.2s', duration: '13s', hue: 'violet' as const },
  { size: 180, top: '18%', left: '58%', delay: '0.8s', duration: '9s', hue: 'cyan' as const },
  { size: 400, top: '58%', left: '68%', delay: '3.2s', duration: '15s', hue: 'red' as const },
]

const PARTICLE_SEEDS = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 17 + 7) % 100}%`,
  top: `${(i * 23 + 11) % 100}%`,
  delay: `${(i % 7) * 0.45}s`,
  size: 2 + (i % 3),
}))

const features = [
  {
    icon: <OpenStackLogo className="w-5 h-5" />,
    gradient: 'from-red-500/95 via-orange-600/90 to-red-800/95',
    glow: 'shadow-red-500/30',
    title: 'OpenStack Nova & Glance',
    description:
      'Private-cloud instances and images beside libvirt — Keystone on the host, Packstack wire script, qcow2 upload without Horizon.',
    highlight: true,
  },
  {
    icon: <Server className="w-5 h-5 text-blue-100" />,
    gradient: 'from-blue-500/95 to-indigo-800/95',
    glow: 'shadow-blue-500/25',
    title: 'Guests & lifecycle',
    description: 'Create, start, stop, snapshot, and migrate QEMU/KVM guests with VNC, SPICE, and serial consoles.',
  },
  {
    icon: <Network className="w-5 h-5 text-emerald-100" />,
    gradient: 'from-emerald-500/95 to-teal-800/95',
    glow: 'shadow-emerald-500/25',
    title: 'Host networking & storage',
    description: 'Topology maps, port forwards, pools, and firewall rules on the hypervisor node.',
  },
  {
    icon: <Activity className="w-5 h-5 text-purple-100" />,
    gradient: 'from-purple-500/95 to-fuchsia-800/95',
    glow: 'shadow-purple-500/25',
    title: 'Monitoring & automation',
    description: 'Live metrics, alerts, webhooks, schedules, and Prometheus hooks.',
  },
  {
    icon: <Boxes className="w-5 h-5 text-orange-100" />,
    gradient: 'from-orange-500/95 to-rose-700/95',
    glow: 'shadow-orange-500/25',
    title: 'KubeVirt & qcow2',
    description: 'Golden images to Kubernetes — Linux or Windows profiles, CDI upload, virtctl from Disk Images.',
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
    ldap: { enabled: false },
    oidc: { enabled: false, button_label: 'Sign in with SSO' },
  })
  const { t } = useTranslation()
  const { login } = useAuth()
  const { theme, setTheme } = useTheme()
  const reducedMotion = usePrefersReducedMotion()
  const isSteel = theme === 'steel'
  const isAurora = theme === 'aurora'
  const pageThemeClass = isSteel ? 'login-page-steel' : isAurora ? 'login-page-aurora' : ''
  const hostLabel = typeof window !== 'undefined' ? window.location.hostname : ''
  const oidcEnabled = providers.oidc.enabled
  const pamEnabled = providers.pam.enabled
  const ldapEnabled = providers.ldap.enabled
  const passwordLogin = pamEnabled || ldapEnabled

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
      setError(formatUserError(e) || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`login-page min-h-screen flex flex-col lg:flex-row relative overflow-hidden ${pageThemeClass}${reducedMotion ? ' login-page-reduced-motion' : ''}`}
    >
      {!reducedMotion && <div className="login-aurora" aria-hidden />}
      {!reducedMotion && <div className="login-scanline" aria-hidden />}

      <ThemeSwitcher theme={theme} setTheme={setTheme} isSteel={isSteel} isAurora={isAurora} />

      <aside className="login-hero hidden lg:flex lg:w-[58%] flex-col justify-between p-10 xl:p-12 overflow-hidden relative">
        <div className="login-hero-mesh" aria-hidden />
        <div className="login-spotlight" aria-hidden />

        {!reducedMotion &&
          LOGIN_ORBS.map((orb, i) => (
            <div
              key={i}
              className={`login-orb login-orb-${orb.hue}`}
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

        {!reducedMotion && (
          <div className="login-particles" aria-hidden>
            {PARTICLE_SEEDS.map((p) => (
              <span
                key={p.id}
                className="login-particle"
                style={{
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  animationDelay: p.delay,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative z-10">
          <div className="login-fade-in flex items-center gap-4 mb-8">
            <div className="login-logo-ring">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-400 via-blue-600 to-indigo-800 shadow-xl shadow-blue-500/40 border border-white/20">
                <BoltLogo className="w-7 h-7 text-white drop-shadow" />
              </div>
            </div>
            <div>
              <span className="text-4xl font-bold tracking-tight text-white block">Machina</span>
              <span className="text-xs font-medium uppercase tracking-[0.28em] text-sky-300/80 mt-0.5 block">
                Hypervisor control plane
              </span>
            </div>
          </div>
          <h2 className="login-fade-in login-fade-in-d1 text-4xl xl:text-[2.75rem] font-extrabold text-white leading-[1.08] mb-4 max-w-xl">
            Libvirt + OpenStack
            <br />
            <span className="login-text-gradient">on one hypervisor host</span>
          </h2>
          <p className="login-fade-in login-fade-in-d2 text-lg text-slate-300/90 max-w-lg leading-relaxed">
            QEMU/KVM under libvirt, Nova and Glance when wired, consoles, storage, automation, and block upload to
            Glance — without Horizon.
          </p>
          <div className="login-fade-in login-fade-in-d3 flex flex-wrap gap-2 mt-6">
            <span className="login-stat-pill login-stat-pill-glow">
              <OpenStackLogo className="w-3 h-3" /> OpenStack
            </span>
            <span className="login-stat-pill">
              <HardDrive className="w-3 h-3" /> qcow2 → K8s
            </span>
            <span className="login-stat-pill">PAM auth</span>
            <span className="login-stat-pill">Windows + Linux</span>
          </div>
        </div>

        <div className="relative z-10 space-y-2.5 max-h-[42vh] overflow-y-auto login-feature-scroll pr-1">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`login-feature-card login-fade-in flex items-start gap-4 p-4 rounded-xl backdrop-blur-md ${
                f.highlight
                  ? 'login-feature-card-highlight'
                  : 'bg-white/[0.04] border border-white/10 hover:border-white/20'
              }`}
              style={{ animationDelay: `${0.35 + i * 0.07}s`, opacity: 0 }}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br ${f.gradient} shadow-lg ${f.glow}`}
              >
                {f.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  {f.title}
                  {f.highlight && (
                    <Sparkles className="w-3.5 h-3.5 text-amber-300/90 shrink-0" aria-hidden />
                  )}
                </div>
                <p className="text-xs mt-1 text-slate-400 leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 pt-4 shrink-0">
          <ZyvorBrandLine />
        </div>
      </aside>

      {!reducedMotion && <div className="login-beam hidden lg:block" aria-hidden />}

      <main className="login-panel flex-1 flex items-center justify-center relative px-6 py-12 min-h-screen">
        <div className="login-panel-grid" aria-hidden />
        <div className="login-panel-glow" aria-hidden />
        <div className="w-full max-w-[420px] relative z-10">
          <div className="flex justify-end mb-2">
            <LanguageSwitcher />
          </div>
          <MobileBrand hostLabel={hostLabel} />
          <DesktopHeading hostLabel={hostLabel} />

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (passwordLogin) void handleSubmit(e)
            }}
            className="login-glass login-glass-border rounded-2xl p-8 shadow-2xl"
            autoComplete={passwordLogin ? 'on' : 'off'}
            aria-label={t('login.title')}
          >
            {error && (
              <div
                role="alert"
                className={`flex items-center gap-2.5 bg-red-950/50 border border-red-500/40 rounded-xl p-3 mb-6 ${reducedMotion ? '' : 'login-shake'}`}
              >
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" aria-hidden />
                <span className="text-sm text-red-300">{error}</span>
              </div>
            )}

            {oidcEnabled && (
              <button
                type="button"
                onClick={() => beginOidcLogin()}
                className="login-btn-primary group w-full"
              >
                <span className="relative z-10">{providers.oidc.button_label}</span>
                <ArrowRight className="h-4 w-4 relative z-10 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            {oidcEnabled && passwordLogin && <OidcDivider label="or sign in with password" />}

            {ldapEnabled ? (
              <p className="text-xs text-slate-400 mb-4" role="status">
                {t('login.ldapHint')}
              </p>
            ) : null}

            {passwordLogin && (
              <>
                <div className="space-y-5">
                  <Field label={t('login.username')} id="login-username">
                    <User className="login-field-icon" />
                    <input
                      id="login-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      autoFocus={!oidcEnabled}
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

                <button
                  type="submit"
                  disabled={submitting || !username || !password}
                  className={oidcEnabled ? 'login-btn-secondary w-full mt-4' : 'login-btn-primary group w-full'}
                >
                  {submitting ? (
                    <>
                      <Loader2 className={`h-4 w-4 relative z-10 ${reducedMotion ? '' : 'animate-spin'}`} />
                      <span className="relative z-10">Signing in…</span>
                    </>
                  ) : (
                    <>
                      <span className="relative z-10">Sign in with password</span>
                      {!oidcEnabled && (
                        <ArrowRight className="h-4 w-4 relative z-10 group-hover:translate-x-0.5 transition-transform" />
                      )}
                    </>
                  )}
                </button>
              </>
            )}

            {pamEnabled && (
              <div className="mt-6 pt-5 border-t border-slate-700/50 flex items-center justify-center gap-2 text-xs text-slate-500">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500/70" aria-hidden />
                <span>Secured with system PAM (same as SSH)</span>
              </div>
            )}
          </form>

          <p className="text-xs text-center mt-4 max-w-sm mx-auto leading-relaxed text-slate-500">
            {oidcEnabled && pamEnabled
              ? 'Use organization SSO or your system account, depending on how this host is configured.'
              : oidcEnabled
                ? 'You will be redirected to your identity provider to complete sign-in.'
                : (
                  <>
                    Same credentials as SSH. If you only use SSH keys, run{' '}
                    <code className="text-[11px] px-1 rounded bg-slate-800/80 text-slate-300">passwd</code> on the
                    server first.
                  </>
                )}
          </p>

          <div className="lg:hidden text-center mt-6">
            <ZyvorBrandLine />
          </div>
        </div>
      </main>
    </div>
  )
}

function ThemeSwitcher({
  theme,
  setTheme,
  isSteel,
  isAurora,
}: {
  theme: string
  setTheme: (t: 'dark' | 'steel' | 'aurora') => void
  isSteel: boolean
  isAurora: boolean
}) {
  const shell = isSteel
    ? 'border-[rgba(140,160,190,0.25)] bg-[#1a2230]/92 shadow-lg shadow-black/30'
    : isAurora
      ? 'border-[rgba(167,139,250,0.3)] bg-[#0a0618]/92 shadow-lg shadow-violet-900/40'
      : 'border-slate-600/50 bg-slate-900/85 shadow-lg shadow-black/40'

  return (
    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30" role="group" aria-label="Theme">
      <div className={`login-theme-switch grid grid-cols-3 gap-1 rounded-xl p-1 backdrop-blur-xl border ${shell}`}>
        {(
          [
            { id: 'dark' as const, label: 'Dark', Icon: Moon },
            { id: 'steel' as const, label: 'Steel', Icon: Cloud },
            { id: 'aurora' as const, label: 'Aurora', Icon: Sparkles },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            className={`login-theme-btn rounded-lg border px-2 py-2 text-[10px] font-semibold uppercase tracking-wide flex flex-col items-center gap-1 transition ${
              theme === id
                ? isAurora && id === 'aurora'
                  ? 'border-cyan-400/80 bg-cyan-500/15 text-cyan-100 ring-2 ring-violet-400/40'
                  : 'border-blue-500/80 bg-blue-500/20 text-blue-100 ring-2 ring-blue-400/30'
                : 'border-transparent text-slate-400 hover:bg-white/5'
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

function MobileBrand({ hostLabel }: { hostLabel: string }) {
  return (
    <div className="lg:hidden text-center mb-8">
      <div className="login-logo-ring inline-block mb-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 shadow-lg shadow-blue-500/30 border border-blue-400/25">
          <BoltLogo className="w-7 h-7 text-white" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-white">Machina</h1>
      <p className="text-sm mt-1 text-slate-400">Libvirt · OpenStack · KubeVirt</p>
      {hostLabel && (
        <p className="text-xs mt-2 font-mono text-slate-500" title="Hypervisor host">
          {hostLabel}
        </p>
      )}
    </div>
  )
}

function DesktopHeading({ hostLabel }: { hostLabel: string }) {
  return (
    <div className="hidden lg:block mb-8">
      <h2 className="text-2xl font-bold mb-1 text-white">Welcome back</h2>
      <p className="text-sm text-slate-400">
        Sign in to libvirt, OpenStack, and automation
        {hostLabel ? (
          <>
            {' '}
            on <span className="font-mono text-slate-300">{hostLabel}</span>
          </>
        ) : (
          ' on this host'
        )}
      </p>
    </div>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      <div className="relative group">{children}</div>
    </div>
  )
}

function OidcDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="relative py-3 mt-4 text-center text-xs uppercase tracking-[0.18em] text-slate-500">
      <span className="relative px-2 bg-slate-900/40">{label}</span>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-700/60" />
    </div>
  )
}

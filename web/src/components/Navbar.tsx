import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { Plus, Menu, X, ChevronDown, Zap, LogOut, User, Sun, Moon, Bell } from 'lucide-react'
import ConnectionStatus from './ConnectionStatus'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useWebSocketContext, VMEvent } from '../contexts/WebSocketContext'
import { timeAgo } from '../utils/time'
import { navGroups, NavItem, NavGroup } from '../utils/routes'

function navItemVisible(item: NavItem, username: string) {
  return !item.requiresRoot || username === 'root'
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const location = useLocation()
  const isActive = location.pathname === item.to

  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
        isActive
          ? 'bg-blue-600/90 text-white shadow-lg shadow-blue-600/20'
          : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
      }`}
    >
      {item.icon}
      {item.label}
    </Link>
  )
}

function DesktopDropdown({ group, username }: { group: NavGroup; username: string }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const location = useLocation()
  const items = group.items.filter((i) => navItemVisible(i, username))
  const hasActive = items.some((i) => i.to === location.pathname)

  const handleEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    setOpen(true)
  }
  const handleLeave = () => {
    const timer = setTimeout(() => setOpen(false), 400)
    closeTimer.current = timer
  }

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
          hasActive ? 'text-blue-400' : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
        }`}
      >
        {group.label}
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl py-2 min-w-[180px] z-40 animate-fade-in origin-top">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 px-4 py-2.5 transition-all duration-150 text-sm ${
                location.pathname === item.to
                  ? 'bg-blue-600/80 text-white'
                  : 'hover:bg-slate-700/60 text-slate-300 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAuthenticated, username, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { events } = useWebSocketContext()
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const recentCount = events.filter((e: VMEvent) => Date.now() - e.timestamp < 300_000).length

  useEffect(() => {
    if (!bellOpen) return
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [bellOpen])

  return (
    <nav className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group hover:scale-105 transition-transform duration-200">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              virtspawn
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navGroups[0].items.filter((item) => navItemVisible(item, username)).map((item) => (
              <NavLink key={item.to} item={item} />
            ))}
            {navGroups.slice(1).map((group) => (
              <DesktopDropdown key={group.label} group={group} username={username} />
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-1.5 hover:bg-slate-700/60 rounded-lg transition text-slate-400 hover:text-white" title={theme === 'dark' ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="relative" ref={bellRef}>
              <button onClick={() => setBellOpen(o => !o)} className="relative p-1.5 hover:bg-slate-700/60 rounded-lg transition text-slate-400 hover:text-white" title="Notifications" aria-label="Notifications">
                <Bell className="w-4 h-4" />
                {recentCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">{recentCount > 9 ? '9+' : recentCount}</span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute top-full right-0 mt-1 bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl py-2 w-80 z-40 animate-fade-in origin-top-right max-h-[400px] overflow-y-auto">
                  <div className="px-4 py-2 border-b border-slate-700/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recent Activity</div>
                  {events.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-slate-500">No recent events</div>
                  ) : (
                    events.slice(0, 20).map((ev: VMEvent, i: number) => (
                      <div key={i} className="px-4 py-2.5 hover:bg-slate-700/40 transition text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{ev.name}</span>
                          <span className="text-[10px] text-slate-500">{timeAgo(ev.timestamp)}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {ev.event === 'state_change' && `${ev.old_state} → ${ev.new_state}`}
                          {ev.event === 'vm_added' && 'VM created'}
                          {ev.event === 'vm_removed' && 'VM removed'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <ConnectionStatus />
            <Link
              to="/create"
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg transition-all duration-200 text-sm font-medium shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
            >
              <Plus className="w-4 h-4" />
              Create VM
            </Link>
            {isAuthenticated && (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="hidden sm:flex text-xs text-slate-400 items-center gap-1 max-w-[120px] md:max-w-[200px]">
                  <User className="w-3 h-3 shrink-0" aria-hidden />
                  <span className="truncate">{username || 'Signed in'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 rounded-lg transition text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600/60 hover:border-slate-500"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4 shrink-0 text-slate-400 hover:text-red-400" />
                  <span className="text-xs font-medium hidden sm:inline">Log out</span>
                </button>
              </div>
            )}
            <button
              className="lg:hidden p-2 hover:bg-slate-700/60 rounded-lg transition"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-700/50 bg-slate-900/95 backdrop-blur-xl pb-4 animate-fade-in">
          <div className="container mx-auto px-4 pt-3 space-y-4">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1.5">{group.label}</div>
                <div className="space-y-0.5">
                  {group.items.filter((item) => navItemVisible(item, username)).map((item) => (
                    <NavLink key={item.to} item={item} onClick={() => setMobileOpen(false)} />
                  ))}
                </div>
              </div>
            ))}
            <Link
              to="/create"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg transition sm:hidden font-medium"
            >
              <Plus className="w-4 h-4" />
              Create VM
            </Link>
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => { setMobileOpen(false); void logout() }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition text-sm text-slate-300"
              >
                <LogOut className="w-4 h-4" />
                Log out{username ? ` (${username})` : ''}
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
  Server, Plus, Home, Network, HardDrive, Camera, Cpu, Globe, FileText, Upload,
  Menu, X, ChevronDown, Activity, Zap, Shield, MonitorCog, Usb, Archive, LogOut, User, Sun, Moon,
} from 'lucide-react'
import ConnectionStatus from './ConnectionStatus'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { to: '/', icon: <Home className="w-4 h-4" />, label: 'Dashboard' },
      { to: '/vms', icon: <Server className="w-4 h-4" />, label: 'Virtual Machines' },
      { to: '/import', icon: <Upload className="w-4 h-4" />, label: 'Import VM' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/networks', icon: <Network className="w-4 h-4" />, label: 'Networks' },
      { to: '/storage', icon: <HardDrive className="w-4 h-4" />, label: 'Storage' },
      { to: '/snapshots', icon: <Camera className="w-4 h-4" />, label: 'Snapshots' },
      { to: '/nwfilters', icon: <Shield className="w-4 h-4" />, label: 'Network Filters' },
      { to: '/backups', icon: <Archive className="w-4 h-4" />, label: 'Backups' },
      { to: '/host-networking', icon: <Globe className="w-4 h-4" />, label: 'Host Networking' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/node', icon: <Cpu className="w-4 h-4" />, label: 'Host Info' },
      { to: '/events', icon: <Activity className="w-4 h-4" />, label: 'Live Metrics' },
      { to: '/capabilities', icon: <MonitorCog className="w-4 h-4" />, label: 'Capabilities' },
      { to: '/devices', icon: <Usb className="w-4 h-4" />, label: 'Node Devices' },
      { to: '/audit', icon: <FileText className="w-4 h-4" />, label: 'Audit Log' },
    ],
  },
]

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

function DesktopDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useState<ReturnType<typeof setTimeout> | null>(null)
  const location = useLocation()
  const hasActive = group.items.some((i) => i.to === location.pathname)

  const handleEnter = () => {
    if (closeTimer[0]) { clearTimeout(closeTimer[0]); closeTimer[1](null) }
    setOpen(true)
  }
  const handleLeave = () => {
    const timer = setTimeout(() => setOpen(false), 400)
    closeTimer[1](timer)
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
        <div className="absolute top-full left-0 mt-1 bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl py-2 min-w-[180px] z-40 animate-fade-in">
          {group.items.map((item) => (
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
  const { username, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              virtspawn
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navGroups[0].items.map((item) => (
              <NavLink key={item.to} item={item} />
            ))}
            {navGroups.slice(1).map((group) => (
              <DesktopDropdown key={group.label} group={group} />
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-1.5 hover:bg-slate-700/60 rounded-lg transition text-slate-400 hover:text-white" title={theme === 'dark' ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <ConnectionStatus />
            <Link
              to="/create"
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg transition-all duration-200 text-sm font-medium shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
            >
              <Plus className="w-4 h-4" />
              Create VM
            </Link>
            {username && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-slate-400 flex items-center gap-1"><User className="w-3 h-3" />{username}</span>
                <button onClick={logout} className="p-1.5 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-red-400" title="Sign out" aria-label="Sign out">
                  <LogOut className="w-4 h-4" />
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
                  {group.items.map((item) => (
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
            {username && (
              <button
                onClick={() => { setMobileOpen(false); logout() }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition text-sm text-slate-300"
              >
                <LogOut className="w-4 h-4" />
                Sign out ({username})
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

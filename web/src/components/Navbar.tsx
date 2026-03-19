import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
  Server, Plus, Home, Network, HardDrive, Camera, Cpu,
  Menu, X, ChevronDown, Activity,
} from 'lucide-react'
import ConnectionStatus from './ConnectionStatus'

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
      { to: '/vms', icon: <Server className="w-4 h-4" />, label: 'VMs' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/networks', icon: <Network className="w-4 h-4" />, label: 'Networks' },
      { to: '/storage', icon: <HardDrive className="w-4 h-4" />, label: 'Storage' },
      { to: '/snapshots', icon: <Camera className="w-4 h-4" />, label: 'Snapshots' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/node', icon: <Cpu className="w-4 h-4" />, label: 'Host Info' },
      { to: '/events', icon: <Activity className="w-4 h-4" />, label: 'Events' },
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
      className={`flex items-center gap-2 px-3 py-2 rounded transition text-sm ${
        isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'
      }`}
    >
      {item.icon}
      {item.label}
    </Link>
  )
}

function DesktopDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const hasActive = group.items.some((i) => i.to === location.pathname)

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        className={`flex items-center gap-1 px-3 py-2 rounded transition text-sm ${
          hasActive ? 'text-blue-400' : 'text-gray-300 hover:bg-gray-700'
        }`}
      >
        {group.label}
        <ChevronDown className={`w-3 h-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px] z-40">
          {group.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-4 py-2 transition text-sm ${
                location.pathname === item.to ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'
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

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-white">
            <Server className="w-6 h-6 text-blue-500" />
            virtspawn
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {navGroups[0].items.map((item) => (
              <NavLink key={item.to} item={item} />
            ))}
            {navGroups.slice(1).map((group) => (
              <DesktopDropdown key={group.label} group={group} />
            ))}
          </div>

          <div className="flex items-center gap-4">
            <ConnectionStatus />
            <Link
              to="/create"
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition text-sm"
            >
              <Plus className="w-4 h-4" />
              Create VM
            </Link>
            <button
              className="lg:hidden p-2 hover:bg-gray-700 rounded transition"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-700 bg-gray-800 pb-4">
          <div className="container mx-auto px-4 pt-2 space-y-4">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="text-xs font-semibold text-gray-500 uppercase px-3 mb-1">{group.label}</div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavLink key={item.to} item={item} onClick={() => setMobileOpen(false)} />
                  ))}
                </div>
              </div>
            ))}
            <Link
              to="/create"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition sm:hidden"
            >
              <Plus className="w-4 h-4" />
              Create VM
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}

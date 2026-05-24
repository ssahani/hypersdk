import { Link, useLocation } from 'react-router'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'
import { isOpenStackNavEnabled } from '../utils/routes'
import { Cloud, Server, HardDrive, Plus, GitBranch, LayoutGrid } from 'lucide-react'

const TABS = [
  { to: '/openstack', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/openstack/instances', label: 'Instances', icon: Server },
  { to: '/openstack/images', label: 'Glance', icon: HardDrive },
  { to: '/openstack/create', label: 'Create', icon: Plus },
  { to: '/openstack/migrations', label: 'Migrations', icon: GitBranch, requiresHypersdk: true },
] as const

export default function OpenStackSubNav() {
  const { pathname } = useLocation()
  const { info } = usePlatformInfo()
  if (!isOpenStackNavEnabled(info?.openstack)) return null
  const hypersdkEnabled = Boolean(info?.hypersdk?.enabled)
  const tabs = TABS.filter((t) => !('requiresHypersdk' in t && t.requiresHypersdk) || hypersdkEnabled)

  return (
    <nav
      className="mb-6 flex flex-wrap gap-1 p-1 rounded-xl border border-sky-500/25 bg-sky-950/20 backdrop-blur-sm"
      aria-label="OpenStack"
    >
      {tabs.map(({ to, label, icon: Icon, ...rest }) => {
        const end = 'end' in rest && rest.end
        const active = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
        return (
          <Link
            key={to}
            to={to}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              active
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        )
      })}
      <span className="hidden sm:inline-flex items-center gap-1.5 ml-auto px-3 py-2 text-xs text-sky-300/80">
        <Cloud className="w-3.5 h-3.5" />
        {info?.openstack?.cloud_name || 'cloud'}
      </span>
    </nav>
  )
}

import { useParams, Link, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import SSHConsole from '../components/SSHConsole'

export default function SSHPage() {
  const { host: pathHost } = useParams<{ host?: string }>()
  const [searchParams] = useSearchParams()
  const hostFromQuery = searchParams.get('host') ?? ''
  const userFromQuery = searchParams.get('user') ?? 'root'

  const raw = pathHost ?? hostFromQuery
  const host = raw ? decodeURIComponent(raw) : ''

  if (!host.trim()) {
    return (
      <div className="space-y-4 animate-fade-in text-center text-slate-500 py-12">
        <p>No host specified.</p>
        <p className="text-sm">
          Use <code className="text-slate-400">/ssh?host=192.168.122.10&amp;user=root</code> or open SSH from a VM details page.
        </p>
        <Link to="/vms" className="text-blue-400 hover:underline">Back to VMs</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/vms" className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">SSH — {userFromQuery}@{host}</h1>
      </div>
      <SSHConsole host={host} sshUser={userFromQuery} />
    </div>
  )
}

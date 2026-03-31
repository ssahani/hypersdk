import { useParams, Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import SSHConsole from '../components/SSHConsole'

export default function SSHPage() {
  const { host } = useParams<{ host: string }>()

  if (!host) {
    return <div className="text-center text-slate-500 py-12">No host specified</div>
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/vms" className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">SSH — {host}</h1>
      </div>
      <SSHConsole host={host} />
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Server } from 'lucide-react'
import SSHConsole from '../components/SSHConsole'

/** SSH to the machine serving this UI: target host is `window.location.hostname` (e.g. 185.165.240.5), not a guest VM. */
export default function HostSSHPage() {
  const targetHost = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const h = window.location.hostname?.trim()
    return h || ''
  }, [])

  const [sshUser, setSshUser] = useState('root')

  if (!targetHost) {
    return (
      <div className="space-y-4 animate-fade-in text-center text-slate-500 py-12">
        <p>Could not determine a hostname from the page URL.</p>
        <Link to="/" className="text-blue-400 hover:underline">Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Server className="w-6 h-6 text-green-400" aria-hidden />
          SSH — hypervisor
        </h1>
      </div>
      <p className="text-sm text-slate-400 max-w-2xl">
        Opens a shell on <span className="font-mono text-slate-200">{targetHost}</span> (the host from your browser address bar). The virtspawn daemon runs{' '}
        <code className="text-xs bg-slate-800 px-1 rounded">ssh</code> on the server to that address. Enter only the SSH user; IP is filled automatically.
      </p>
      <div className="max-w-md space-y-1">
        <label htmlFor="host-ssh-user" className="block text-sm text-slate-400">SSH user</label>
        <input
          id="host-ssh-user"
          type="text"
          value={sshUser}
          onChange={(e) => setSshUser(e.target.value)}
          className="input-field"
          placeholder="root"
          autoComplete="username"
        />
      </div>
      <SSHConsole host={targetHost} sshUser={sshUser.trim() || 'root'} />
    </div>
  )
}

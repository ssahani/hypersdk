// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Users, Plus } from 'lucide-react'
import { MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import { createUser, deleteUser, listUsers, type PlatformUser } from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

export default function PlatformUsers() {
  const toast = useToastContext()
  const [rows, setRows] = useState<PlatformUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [role, setRole] = useState('operator')

  const load = useCallback(async () => {
    setError(null)
    try { setRows(await listUsers()) } catch (e: unknown) { setError(formatUserError(e)) }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Users & RBAC" subtitle="Platform operator accounts" />
      {error && <ErrorBanner message={error} />}
      <div className="card p-4 grid gap-3 md:grid-cols-4">
        <input className="input" placeholder="username" value={user} onChange={(e) => setUser(e.target.value)} />
        <input className="input" type="password" placeholder="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="admin">admin</option>
          <option value="operator">operator</option>
          <option value="viewer">viewer</option>
        </select>
        <button type="button" className="btn-primary w-fit flex items-center gap-2" onClick={async () => {
          try { await createUser({ username: user, password: pass, role }); toast.success('User created'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) }
        }}><Plus className="w-4 h-4" /> Add user</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-slate-400 border-b border-slate-800"><th className="p-3 text-left">User</th><th className="p-3">Role</th><th className="p-3" /></tr></thead>
          <tbody>{rows.map((u) => (
            <tr key={u.id} className="border-b border-slate-900"><td className="p-3">{u.username}</td><td className="p-3">{u.role}</td>
              <td className="p-3 text-right"><button type="button" className="btn-secondary text-xs" onClick={async () => { try { await deleteUser(u.id); toast.success('Deleted'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) } }}>Delete</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

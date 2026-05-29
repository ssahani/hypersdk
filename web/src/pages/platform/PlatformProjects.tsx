// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Boxes } from 'lucide-react'
import { MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import { listProjects, type ProjectRow } from '../../api/platform'
import { formatUserError } from '../../utils/apiError'

export default function PlatformProjects() {
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try { setRows(await listProjects()) } catch (e: unknown) { setError(formatUserError(e)) }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Projects" subtitle="VM grouping by project label" />
      {error && <ErrorBanner message={error} />}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-slate-400 border-b border-slate-800"><th className="p-3 text-left">Project</th><th className="p-3">VMs</th><th className="p-3" /></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.name} className="border-b border-slate-900">
              <td className="p-3">{p.name || '(default)'}</td>
              <td className="p-3">{p.vm_count}</td>
              <td className="p-3 text-right">
                <Link to={`/platform/vms?project=${encodeURIComponent(p.name)}`} className="text-blue-400 text-xs">View VMs</Link>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

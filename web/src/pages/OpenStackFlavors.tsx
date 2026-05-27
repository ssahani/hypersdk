// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listOpenStackFlavors, type OpenStackFlavor } from '../api/openstack'
import OpenStackGate from '../components/OpenStackGate'
import OpenStackSubNav from '../components/OpenStackSubNav'
import OpenStackFooter from '../components/OpenStackFooter'
import { useToastContext } from '../contexts/ToastContext'
import { formatUserError } from '../utils/apiError'
import { Cpu, Loader2, RefreshCw } from 'lucide-react'

export default function OpenStackFlavorsPage() {
  return (
    <OpenStackGate title="Nova flavors">
      <OpenStackFlavorsContent />
    </OpenStackGate>
  )
}

function OpenStackFlavorsContent() {
  const toast = useToastContext()
  const [flavors, setFlavors] = useState<OpenStackFlavor[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { flavors: list } = await listOpenStackFlavors()
      setFlavors(list)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6 max-w-3xl">
      <OpenStackSubNav />
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Cpu className="w-7 h-7 text-sky-400" />
        Nova flavors
      </h1>
      <p className="text-sm text-slate-400">Read-only catalog — flavor CRUD requires Horizon or admin CLI.</p>
      <button type="button" onClick={() => void load()}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-600 text-sm">
        <RefreshCw className="w-4 h-4" /> Refresh
      </button>
      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      ) : (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">vCPU</th>
                <th className="px-3 py-2">RAM</th>
                <th className="px-3 py-2">Disk</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {flavors.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-2">
                    <Link to={`/openstack/flavors/${f.id}`} className="font-mono text-slate-200 hover:text-sky-300 hover:underline">{f.name}</Link>
                    <span className="block text-xs text-slate-500 font-mono">{f.id}</span>
                  </td>
                  <td className="px-3 py-2">{f.vcpus}</td>
                  <td className="px-3 py-2">{f.ram_mb} MB</td>
                  <td className="px-3 py-2">{f.disk_gb} GB</td>
                  <td className="px-3 py-2">
                    <Link to={`/openstack/flavors/${f.id}`} className="text-xs text-sky-400 hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {flavors.length === 0 && (
            <p className="p-6 text-center text-slate-500 text-sm">No flavors returned from Nova.</p>
          )}
        </div>
      )}
      <OpenStackFooter />
    </div>
  )
}

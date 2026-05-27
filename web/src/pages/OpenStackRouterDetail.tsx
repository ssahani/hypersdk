// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Loader2, GitBranch } from 'lucide-react'
import { listOpenStackNetworks, type OpenStackNetwork } from '../api/openstack'
import { getOpenStackRouter, updateOpenStackRouter, type OpenStackRouter } from '../api/openstackExtras'
import OpenStackGate from '../components/OpenStackGate'
import OpenStackSubNav from '../components/OpenStackSubNav'
import OpenStackFooter from '../components/OpenStackFooter'
import { useToastContext } from '../contexts/ToastContext'
import { formatUserError } from '../utils/apiError'

export default function OpenStackRouterDetailPage() {
  return (
    <OpenStackGate title="Router">
      <OpenStackRouterDetailContent />
    </OpenStackGate>
  )
}

function OpenStackRouterDetailContent() {
  const { id } = useParams<{ id: string }>()
  const toast = useToastContext()
  const [router, setRouter] = useState<OpenStackRouter | null>(null)
  const [networks, setNetworks] = useState<OpenStackNetwork[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [{ router: r }, nets] = await Promise.all([
        getOpenStackRouter(id),
        listOpenStackNetworks().catch(() => ({ networks: [] as OpenStackNetwork[] })),
      ])
      setRouter(r)
      setNetworks(nets.networks)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
      setRouter(null)
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { void load() }, [load])

  if (loading) return <Loader2 className="w-8 h-8 animate-spin text-sky-400 mx-auto py-12" />
  if (!router) {
    return (
      <div className="space-y-4">
        <OpenStackSubNav />
        <Link to="/openstack/networking" className="text-sky-400 hover:underline">Back</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <OpenStackSubNav />
      <Link to="/openstack/networking" className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm">
        <ArrowLeft className="w-4 h-4" /> Networking
      </Link>
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <GitBranch className="w-7 h-7 text-sky-400" />
        {router.name}
      </h1>
      <dl className="grid sm:grid-cols-2 gap-4 rounded-xl border border-slate-700 p-4 text-sm">
        <div><dt className="text-xs text-slate-500 uppercase">ID</dt><dd className="font-mono text-slate-200 mt-1 break-all">{router.id}</dd></div>
        <div><dt className="text-xs text-slate-500 uppercase">Status</dt><dd className="text-slate-200 mt-1">{router.status}</dd></div>
        <div><dt className="text-xs text-slate-500 uppercase">External gateway</dt><dd className="text-slate-200 mt-1">{router.external_gateway ? 'Yes' : 'No'}</dd></div>
      </dl>
      <button type="button" className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm"
        onClick={async () => {
          const n = prompt('Router name', router.name)
          if (n === null || !n.trim()) return
          try {
            await updateOpenStackRouter(router.id, { name: n.trim() })
            toast.success('Renamed')
            void load()
          } catch (e: unknown) { toast.error(formatUserError(e)) }
        }}>Rename</button>
      <div className="rounded-xl border border-slate-700 p-4 space-y-3">
        <h2 className="text-sm font-medium text-slate-300">External gateway</h2>
        <p className="text-xs text-slate-500">
          {router.external_gateway ? 'Gateway is set on this router.' : 'No external gateway — outbound NAT requires one.'}
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <select id="ext-net" className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm min-w-[14rem]"
            defaultValue="">
            <option value="" disabled>Select external network…</option>
            {networks.filter((n) => n.external).map((n) => (
              <option key={n.id} value={n.id}>{n.name || n.id}</option>
            ))}
          </select>
          <button type="button" className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-sm"
            onClick={async () => {
              const sel = document.getElementById('ext-net') as HTMLSelectElement | null
              const netId = sel?.value
              if (!netId) { toast.error('Select an external network'); return }
              try {
                await updateOpenStackRouter(router.id, { external_network_id: netId })
                toast.success('External gateway set')
                void load()
              } catch (e: unknown) { toast.error(formatUserError(e)) }
            }}>Set gateway</button>
          {router.external_gateway && (
            <button type="button" className="px-3 py-1.5 rounded-lg border border-red-500/50 text-red-300 text-sm"
              onClick={async () => {
                if (!confirm('Clear external gateway from this router?')) return
                try {
                  await updateOpenStackRouter(router.id, { clear_external_gateway: true })
                  toast.success('Gateway cleared')
                  void load()
                } catch (e: unknown) { toast.error(formatUserError(e)) }
              }}>Clear gateway</button>
          )}
        </div>
      </div>
      <OpenStackFooter />
    </div>
  )
}

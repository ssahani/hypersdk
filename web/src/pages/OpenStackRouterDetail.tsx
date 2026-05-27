// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Loader2, GitBranch } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { router: r } = await getOpenStackRouter(id)
      setRouter(r)
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
      <OpenStackFooter />
    </div>
  )
}

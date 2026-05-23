import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { deleteOpenStackImage, listOpenStackImages, type OpenStackImage } from '../api/openstack'
import { useToastContext } from '../contexts/ToastContext'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'
import ConfirmDialog from '../components/ConfirmDialog'
import OpenStackFooter from '../components/OpenStackFooter'
import { Cloud, RefreshCw, Plus, Trash2 } from 'lucide-react'

function formatBytes(n?: number) {
  if (n == null || n === 0) return '—'
  const gb = n / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} GiB`
  const mb = n / (1024 ** 2)
  return `${mb.toFixed(0)} MiB`
}

export default function OpenStackImagesPage() {
  const [images, setImages] = useState<OpenStackImage[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<OpenStackImage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToastContext()
  const { lastEvent, refreshKey } = usePlatformInfo()

  const load = useCallback(async () => {
    try {
      const { images: list } = await listOpenStackImages()
      setImages(list)
    } catch (e: unknown) {
      toast.error(`Failed to load images: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!lastEvent) return
    if (lastEvent.kind.startsWith('openstack.image') || lastEvent.kind.startsWith('openstack.instance')) {
      void load()
    }
  }, [refreshKey, lastEvent, load])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteOpenStackImage(deleteTarget.id)
      toast.success(`Deleted image '${deleteTarget.name || deleteTarget.id}'`)
      setDeleteTarget(null)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Cloud className="w-7 h-7 text-sky-400" />
            Glance Images
          </h1>
          <p className="text-slate-400 text-sm mt-1">Images in the connected OpenStack project.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/openstack/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm"
          >
            <Plus className="w-4 h-4" />
            Boot instance
          </Link>
          <button
            type="button"
            onClick={() => { setLoading(true); load() }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/80">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 text-slate-400 text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Min disk</th>
              <th className="px-4 py-3">Min RAM</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading && images.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
            )}
            {!loading && images.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No images found.</td></tr>
            )}
            {images.map((img) => (
              <tr key={img.id} className="hover:bg-slate-800/40">
                <td className="px-4 py-3">
                  <div className="text-slate-200">{img.name || '—'}</div>
                  <div className="text-xs text-slate-500 font-mono truncate max-w-xs">{img.id}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">{img.status}</td>
                <td className="px-4 py-3">{img.min_disk_gb} GB</td>
                <td className="px-4 py-3">{img.min_ram_mb} MB</td>
                <td className="px-4 py-3">{formatBytes(img.size_bytes)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    title="Delete image"
                    onClick={() => setDeleteTarget(img)}
                    className="p-2 rounded hover:bg-red-500/20 text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <OpenStackFooter />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Glance image"
        message={`Permanently delete ${deleteTarget?.name || deleteTarget?.id} from Glance?`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

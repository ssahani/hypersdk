import { useCallback, useEffect, useState } from 'react'
import { HardDrive, RefreshCw, Trash2 } from 'lucide-react'
import { listDiskImages, deleteDiskImage, ImageFile } from '../api/extras'
import { useToastContext } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'

function formatBytes(b: number): string {
  if (b === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(1024))
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export default function DiskImagesPage() {
  const [images, setImages] = useState<ImageFile[]>([])
  const [scanDirectories, setScanDirectories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmPath, setConfirmPath] = useState<string | null>(null)
  const toast = useToastContext()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await listDiskImages()
      setImages(r.files)
      setScanDirectories(r.scan_directories)
    } catch (e: unknown) {
      toast.error(`Failed to load disk images: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!confirmPath) return
    setDeleting(confirmPath)
    setConfirmPath(null)
    try {
      await deleteDiskImage(confirmPath)
      toast.success(`Deleted ${confirmPath.split('/').pop()}`)
      setImages(prev => prev.filter(i => i.path !== confirmPath))
    } catch (e: unknown) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setDeleting(null)
    }
  }

  const totalBytes = images.reduce((s, i) => s + i.size_bytes, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="w-6 h-6" /> Disk Images
          </h1>
          {!loading && (
            <p className="text-sm text-slate-400 mt-0.5">
              {images.length} image{images.length !== 1 ? 's' : ''} · {formatBytes(totalBytes)} total
            </p>
          )}
        </div>
        <button onClick={load} className="p-2 hover:bg-slate-700 rounded transition" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!loading && scanDirectories.length > 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 px-4 py-3 text-xs text-slate-400 space-y-2">
          <p>
            Scanned directories (from libvirt storage pools plus defaults):{' '}
            <span className="text-slate-300 font-mono break-all">{scanDirectories.join(', ')}</span>
          </p>
          <p className="text-amber-200/90 border-t border-amber-900/30 pt-2 mt-2">
            <strong className="text-amber-100/90">mkosi temp:</strong> failed image builds may leave large folders under{' '}
            <code className="text-amber-100/80">/var/tmp/machina-mkosi-ws/</code>.
            Remove stale ones when you no longer need logs to free disk space (successful builds clean up unless <code className="text-amber-100/80">MACHINA_MKOSI_KEEP_WORKSPACE</code> is set).
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : images.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center text-slate-500 space-y-2">
          <p>No disk images found in the scanned directories.</p>
          {scanDirectories.length > 0 ? (
            <p className="text-xs font-mono text-slate-400 break-all">{scanDirectories.join(', ')}</p>
          ) : (
            <p className="text-xs">(Connect to the daemon to discover libvirt pool paths.)</p>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 text-left text-xs text-slate-400 uppercase tracking-wide">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Format</th>
                <th className="px-5 py-3">Size</th>
                <th className="px-5 py-3 hidden md:table-cell">Path</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {images.map((img) => (
                <tr key={img.path} className="hover:bg-slate-700/30 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-200">{img.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-700/60 text-slate-300">
                      {img.format}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-300">{formatBytes(img.size_bytes)}</td>
                  <td className="px-5 py-3 hidden md:table-cell text-xs text-slate-500 font-mono max-w-xs truncate">
                    {img.path}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setConfirmPath(img.path)}
                      disabled={deleting === img.path}
                      className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 text-xs font-medium transition disabled:opacity-40"
                      title="Delete image file"
                    >
                      {deleting === img.path
                        ? <span className="animate-spin inline-block w-3 h-3 border border-red-400 border-t-transparent rounded-full" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmPath}
        title="Delete disk image"
        message={`Permanently delete file from host filesystem? Any VM still referencing it will fail to start.\n\n${confirmPath ?? ''}`}
        confirmLabel="Delete file"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmPath(null)}
      />
    </div>
  )
}

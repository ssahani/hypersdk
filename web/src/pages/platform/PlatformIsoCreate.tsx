// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Platform ISO install — approved content library → controller vm.apply with install_iso CDROM.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Disc, Loader2 } from 'lucide-react'
import PlatformPageChrome, { PlatformBackLink } from '../../components/platform/PlatformPageChrome'
import { MacGlassPanel } from '../../components/platform/mac/PlatformMacUi'
import { createVmFromIso, listContentImages, type ContentImage } from '../../api/platform'
import { sizeToSpec } from '../../components/platform/SimpleCreateVmWizard'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'
import { hubLinkClasses } from '../../utils/semanticColors'

const SIZES = [
  { id: 'small', label: 'Small', detail: '2 vCPU · 2 GiB · 20 GiB disk' },
  { id: 'medium', label: 'Medium', detail: '4 vCPU · 4 GiB · 40 GiB disk' },
  { id: 'large', label: 'Large', detail: '8 vCPU · 8 GiB · 80 GiB disk' },
] as const

export default function PlatformIsoCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToastContext()
  const [images, setImages] = useState<ContentImage[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isoPath, setIsoPath] = useState('')
  const [vmName, setVmName] = useState('vm-from-iso')
  const [size, setSize] = useState<string>('medium')

  const approved = useMemo(
    () => images.filter((i) => i.status === 'available' && (i.kind === 'iso' || i.path.toLowerCase().endsWith('.iso'))),
    [images],
  )

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      setImages(await listContentImages({ status: 'available' }))
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const pre = searchParams.get('iso_path') ?? searchParams.get('iso')
    if (pre) setIsoPath(pre)
  }, [searchParams])

  const selected = approved.find((i) => i.path === isoPath)

  const createOnPlatform = async () => {
    if (!isoPath.trim()) {
      toast.error('Select an approved ISO')
      return
    }
    if (!vmName.trim()) {
      toast.error('Enter a VM name')
      return
    }
    const spec = sizeToSpec(size)
    const memoryGi = parseInt(spec.memory.replace(/Gi$/, ''), 10) || 4
    const diskGb = parseInt(spec.disk.replace(/Gi$/, ''), 10) || 40
    setCreating(true)
    try {
      await createVmFromIso({
        name: vmName.trim(),
        iso_path: isoPath,
        memory: `${memoryGi}Gi`,
        disk_gib: diskGb,
      })
      toast.success(`ISO install queued for ${vmName}`)
      navigate('/platform/vms')
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setCreating(false)
    }
  }

  const openClassicWizard = () => {
    const spec = sizeToSpec(size)
    const memoryMb = parseInt(spec.memory.replace(/Gi$/, ''), 10) * 1024 || 4096
    const diskGb = parseInt(spec.disk.replace(/Gi$/, ''), 10) || 40
    const q = new URLSearchParams({
      iso_path: isoPath,
      name: vmName.trim(),
      vcpus: String(spec.cores),
      memory_mb: String(memoryMb),
      disk_gb: String(diskGb),
    })
    navigate(`/create?${q.toString()}`)
  }

  return (
    <PlatformPageChrome
      error={error}
      onErrorRetry={() => void load()}
      prepend={<PlatformBackLink to="/platform/content" label="Content Library" />}
      title="Create VM from ISO"
      subtitle="Platform-native install attaches the ISO at define time; classic wizard offers full virt-install options."
    >
      {loading ? (
        <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading approved images…</p>
      ) : approved.length === 0 ? (
        <MacGlassPanel title="No approved ISOs">
          <p className="text-sm text-slate-400">
            Upload and approve an ISO in the{' '}
            <Link to="/platform/content" className={hubLinkClasses()}>Content Library</Link>
            {' '}first.
          </p>
        </MacGlassPanel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 max-w-4xl">
          <MacGlassPanel title="ISO image">
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {approved.map((img) => (
                <li key={img.id}>
                  <button
                    type="button"
                    className={`w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors ${
                      isoPath === img.path
                        ? 'border-sky-500/50 bg-sky-500/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                    onClick={() => setIsoPath(img.path)}
                  >
                    <span className="font-medium flex items-center gap-2">
                      <Disc className="w-4 h-4 shrink-0" />
                      {img.name}
                    </span>
                    <span className="text-xs text-slate-500 font-mono block mt-0.5 truncate">{img.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          </MacGlassPanel>
          <MacGlassPanel title="VM settings">
            <label className="block text-sm mb-3">
              <span className="text-slate-400">VM name</span>
              <input className="input w-full mt-1" value={vmName} onChange={(e) => setVmName(e.target.value)} />
            </label>
            <fieldset className="space-y-2 mb-4">
              <legend className="text-sm text-slate-300 mb-1">Size</legend>
              {SIZES.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${
                    size === s.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-800'
                  }`}
                >
                  <input type="radio" name="iso-size" checked={size === s.id} onChange={() => setSize(s.id)} />
                  <span>
                    <span className="font-medium">{s.label}</span>
                    <span className="text-xs text-slate-500 ml-1">{s.detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {selected && (
              <p className="text-xs text-slate-500 mb-3">
                Installing from <span className="font-mono">{selected.path}</span>
              </p>
            )}
            <button type="button" className="btn-primary w-full mb-2" disabled={!isoPath || creating} onClick={() => void createOnPlatform()}>
              {creating ? 'Queuing…' : 'Create on platform (ISO boot)'}
            </button>
            <button type="button" className="btn-secondary w-full text-sm" disabled={!isoPath} onClick={openClassicWizard}>
              Advanced: classic install wizard
            </button>
          </MacGlassPanel>
        </div>
      )}
    </PlatformPageChrome>
  )
}

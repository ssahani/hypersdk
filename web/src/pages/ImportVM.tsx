import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { importDisk, listDiskImages, ImageFile } from '../api/extras'
import { createVMWithProgress, CreateVmRequest } from '../api/vm'
import { listNetworks, NetworkInfo } from '../api/network'
import { BrowseHostPathModal, isHostDiskImageFileName } from '../components/BrowseHostPathModal'
import { useToastContext } from '../contexts/ToastContext'
import { ArrowLeft, Upload, HardDrive, FolderOpen, Sliders } from 'lucide-react'
import { ChoiceCard, ChoiceCardGrid } from '../components/ChoiceCards'
import { Link } from 'react-router'

export default function ImportVMPage() {
  const [source, setSource] = useState('')
  const [vmName, setVmName] = useState('')
  const [vcpus, setVcpus] = useState(1)
  const [memoryMb, setMemoryMb] = useState(1024)
  const [network, setNetwork] = useState('default')
  const [firmware, setFirmware] = useState('bios')
  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [existingDisks, setExistingDisks] = useState<ImageFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [createLog, setCreateLog] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<'import' | 'configure'>('import')
  const [importedPath, setImportedPath] = useState('')
  const [sourceBrowseOpen, setSourceBrowseOpen] = useState(false)
  const toast = useToastContext()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    listNetworks().then(setNetworks).catch(() => {})
    listDiskImages().then((r) => setExistingDisks(r.files)).catch(() => {})
  }, [])

  useEffect(() => {
    const disk = searchParams.get('disk')?.trim()
    if (!disk) return
    const base = disk.split('/').pop()?.replace(/\.[^.]+$/, '') || 'imported-vm'
    setImportedPath(disk)
    setSource(disk)
    setVmName((prev) => prev || base)
    setStep('configure')
  }, [searchParams])

  useEffect(() => {
    if (createLog.length) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [createLog])

  const handleImport = async () => {
    if (!source || !vmName.trim()) { toast.warning('Source path and VM name required'); return }
    setSubmitting(true)
    try {
      const result = await importDisk(source, vmName.trim())
      setImportedPath(result.path)
      toast.success(`Disk imported to ${result.path}`)
      setStep('configure')
    } catch (e: unknown) {
      toast.error(`Import failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreate = async () => {
    if (!vmName.trim() || !importedPath) return
    setSubmitting(true)
    setCreateLog([])
    try {
      const req: CreateVmRequest = {
        name: vmName.trim(),
        vcpus,
        memory_mb: memoryMb,
        disk_gb: 0,
        existing_disk: importedPath,
        network,
        firmware,
      }
      await createVMWithProgress(req, (line) => {
        setCreateLog((prev) => [...prev, line])
      })
      toast.success(`VM '${vmName}' created with imported disk`)
      navigate('/vms')
    } catch (e: unknown) {
      toast.error(`Create failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/vms" className="p-2 hover:bg-slate-700 rounded transition" aria-label="Back"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Upload className="w-6 h-6 text-cyan-400" /> Import guest VM</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">Bring a disk image onto this hypervisor host and define a libvirt domain—useful for bare-metal lab or worker pools before optional KubeVirt migration.</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Wizard steps</h2>
        <ChoiceCardGrid>
          <ChoiceCard
            tone="blue"
            selected={step === 'import'}
            onClick={() => {
              if (step === 'configure') setStep('import')
            }}
            icon={<Upload className="w-4 h-4" />}
            title="1 · Import disk"
            description="Convert or copy the source image to qcow2 on the hypervisor."
          />
          <ChoiceCard
            tone="blue"
            selected={step === 'configure'}
            onClick={() => {}}
            disabled={step === 'import'}
            icon={<Sliders className="w-4 h-4" />}
            title="2 · Configure VM"
            description={step === 'import' ? 'Finish step 1 first, then set CPUs, memory, and network.' : 'Set vCPUs, memory, firmware, and network, then create the VM.'}
          />
        </ChoiceCardGrid>
      </div>

      {step === 'import' && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2"><HardDrive className="w-5 h-5 text-blue-400" /> Import Disk Image</h3>
          <p className="text-sm text-slate-400">Convert VMDK, VDI, VHD, RAW, or IMG disk images to qcow2 format.</p>

          <div>
            <label htmlFor="import-name" className="block text-sm text-slate-400 mb-1">VM Name *</label>
            <input id="import-name" type="text" autoFocus value={vmName} onChange={e => setVmName(e.target.value)} className="input-field" placeholder="imported-vm" />
          </div>

          <div className="space-y-2">
            <label htmlFor="import-source" className="block text-sm text-slate-400 mb-1">Source Disk Image Path *</label>
            <div className="flex gap-2">
              <input
                id="import-source"
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="input-field flex-1 min-w-0"
                placeholder="/path/to/disk.vmdk on the hypervisor"
              />
              <button
                type="button"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-sm text-slate-200 transition"
                onClick={() => setSourceBrowseOpen(true)}
              >
                <FolderOpen className="w-4 h-4" aria-hidden />
                Browse
              </button>
            </div>
            <p className="text-xs text-slate-500">Supported: .vmdk, .vdi, .vhd, .vpc, .raw, .img, .qcow2 — browse from / on the hypervisor (daemon permissions).</p>
          </div>

          {existingDisks.length > 0 && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Or select existing image:</label>
              <select value="" onChange={e => { if (e.target.value) setSource(e.target.value) }} className="input-field">
                <option value="">Browse disk images...</option>
                {existingDisks.map(f => <option key={f.path} value={f.path}>{f.name} ({f.format}, {(f.size_bytes / 1073741824).toFixed(1)} GB)</option>)}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
            <Link to="/vms" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition">Cancel</Link>
            <button onClick={handleImport} disabled={submitting} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm transition">
              {submitting ? 'Importing...' : 'Import & Convert'}
            </button>
          </div>
        </div>
      )}

      {step === 'configure' && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
          <h3 className="text-lg font-semibold">Configure VM</h3>
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
            Disk imported to: <code className="font-mono">{importedPath}</code>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="cfg-vcpus" className="block text-sm text-slate-400 mb-1">vCPUs</label>
              <input id="cfg-vcpus" type="number" min={1} max={256} value={vcpus} onChange={e => setVcpus(parseInt(e.target.value) || 1)} className="input-field" />
            </div>
            <div>
              <label htmlFor="cfg-memory" className="block text-sm text-slate-400 mb-1">Memory (MB)</label>
              <input id="cfg-memory" type="number" min={64} value={memoryMb} onChange={e => setMemoryMb(parseInt(e.target.value) || 1024)} className="input-field" />
            </div>
            <div>
              <label htmlFor="cfg-firmware" className="block text-sm text-slate-400 mb-1">Firmware</label>
              <select id="cfg-firmware" value={firmware} onChange={e => setFirmware(e.target.value)} className="input-field">
                <option value="bios">BIOS</option>
                <option value="uefi">UEFI</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="cfg-network" className="block text-sm text-slate-400 mb-1">Network</label>
            <select id="cfg-network" value={network} onChange={e => setNetwork(e.target.value)} className="input-field">
              {networks.map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
            </select>
          </div>

          {(submitting || createLog.length > 0) && (
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3 space-y-2">
              <h4 className="text-xs font-semibold text-slate-300">virt-install progress</h4>
              <pre className="max-h-56 overflow-y-auto rounded bg-black/50 border border-slate-800 p-2 text-[11px] font-mono text-slate-200 whitespace-pre-wrap break-all">
                {createLog.length ? createLog.join('\n') : <span className="text-slate-500">Starting…</span>}
              </pre>
              <div ref={logEndRef} />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
            <button onClick={() => setStep('import')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition">Back</button>
            <button onClick={handleCreate} disabled={submitting} className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm transition">
              {submitting ? 'Creating...' : 'Create VM'}
            </button>
          </div>
        </div>
      )}

      <BrowseHostPathModal
        open={sourceBrowseOpen}
        onClose={() => setSourceBrowseOpen(false)}
        title="Browse for source disk image"
        canSelectFile={isHostDiskImageFileName}
        onSelectPath={(p) => setSource(p)}
      />
    </div>
  )
}

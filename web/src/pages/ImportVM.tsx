import { useState } from 'react'
import { useNavigate } from 'react-router'
import { importDisk, listDiskImages, ImageFile } from '../api/extras'
import { createVM, CreateVmRequest } from '../api/vm'
import { listNetworks, NetworkInfo } from '../api/network'
import { useToastContext } from '../contexts/ToastContext'
import { ArrowLeft, Upload, HardDrive } from 'lucide-react'
import { Link } from 'react-router'
import { useEffect } from 'react'

export default function ImportVMPage() {
  const [source, setSource] = useState('')
  const [vmName, setVmName] = useState('')
  const [vcpus, setVcpus] = useState(2)
  const [memoryMb, setMemoryMb] = useState(2048)
  const [network, setNetwork] = useState('default')
  const [firmware, setFirmware] = useState('bios')
  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [existingDisks, setExistingDisks] = useState<ImageFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<'import' | 'configure'>('import')
  const [importedPath, setImportedPath] = useState('')
  const toast = useToastContext()
  const navigate = useNavigate()

  useEffect(() => {
    listNetworks().then(setNetworks).catch(() => {})
    listDiskImages().then(setExistingDisks).catch(() => {})
  }, [])

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
      await createVM(req)
      toast.success(`VM '${vmName}' created with imported disk`)
      navigate('/vms')
    } catch (e: unknown) {
      toast.error(`Create failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/vms" className="p-2 hover:bg-slate-700 rounded transition" aria-label="Back"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Upload className="w-6 h-6 text-cyan-400" /> Import Virtual Machine</h1>
      </div>

      <div className="flex gap-2 mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${step === 'import' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>1. Import Disk</span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${step === 'configure' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>2. Configure VM</span>
      </div>

      {step === 'import' && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2"><HardDrive className="w-5 h-5 text-blue-400" /> Import Disk Image</h3>
          <p className="text-sm text-slate-400">Convert VMDK, VDI, VHD, RAW, or IMG disk images to qcow2 format.</p>

          <div>
            <label htmlFor="import-name" className="block text-sm text-slate-400 mb-1">VM Name *</label>
            <input id="import-name" type="text" autoFocus value={vmName} onChange={e => setVmName(e.target.value)} className="input-field" placeholder="imported-vm" />
          </div>

          <div>
            <label htmlFor="import-source" className="block text-sm text-slate-400 mb-1">Source Disk Image Path *</label>
            <input id="import-source" type="text" value={source} onChange={e => setSource(e.target.value)} className="input-field" placeholder="/path/to/disk.vmdk" />
            <p className="text-xs text-slate-500 mt-1">Supported: .vmdk, .vdi, .vhd, .vpc, .raw, .img, .qcow2</p>
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
              <input id="cfg-vcpus" type="number" min={1} max={256} value={vcpus} onChange={e => setVcpus(parseInt(e.target.value) || 2)} className="input-field" />
            </div>
            <div>
              <label htmlFor="cfg-memory" className="block text-sm text-slate-400 mb-1">Memory (MB)</label>
              <input id="cfg-memory" type="number" min={64} value={memoryMb} onChange={e => setMemoryMb(parseInt(e.target.value) || 2048)} className="input-field" />
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

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
            <button onClick={() => setStep('import')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition">Back</button>
            <button onClick={handleCreate} disabled={submitting} className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm transition">
              {submitting ? 'Creating...' : 'Create VM'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

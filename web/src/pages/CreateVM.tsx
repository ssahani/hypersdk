import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { createVM, getTemplates, VmTemplate, CreateVmRequest } from '../api/vm'
import { listNetworks, NetworkInfo } from '../api/network'
import { listIsos, listDiskImages, ImageFile, generateCloudInit } from '../api/extras'
import { useToastContext } from '../contexts/ToastContext'
import { ArrowLeft, Server, Layers, HardDrive, Cloud, Disc } from 'lucide-react'
import { Link } from 'react-router'

type DiskMode = 'new' | 'existing'

export default function CreateVMPage() {
  const [form, setForm] = useState<CreateVmRequest>({ name: '', vcpus: 2, memory_mb: 2048, disk_gb: 20, network: 'default', os_variant: 'linux2022', firmware: 'bios' })
  const [diskMode, setDiskMode] = useState<DiskMode>('new')
  const [templates, setTemplates] = useState<VmTemplate[]>([])
  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [isoFiles, setIsoFiles] = useState<ImageFile[]>([])
  const [diskFiles, setDiskFiles] = useState<ImageFile[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [showCloudInit, setShowCloudInit] = useState(false)
  const [ciUser, setCiUser] = useState('')
  const [ciPass, setCiPass] = useState('')
  const [ciSshKey, setCiSshKey] = useState('')
  const toast = useToastContext()
  const navigate = useNavigate()

  useEffect(() => {
    getTemplates().then(setTemplates).catch(() => {})
    listNetworks().then(setNetworks).catch(() => {})
    listIsos().then(setIsoFiles).catch(() => {})
    listDiskImages().then(setDiskFiles).catch(() => {})
  }, [])

  const applyTemplate = (name: string) => {
    setSelectedTemplate(name)
    const tmpl = templates.find((t) => t.name === name)
    if (tmpl) setForm((f) => ({ ...f, vcpus: tmpl.vcpus, memory_mb: tmpl.memory_mb, disk_gb: tmpl.disk_gb, os_variant: tmpl.os_variant }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.warning('Name is required'); return }
    if (diskMode === 'existing' && !form.existing_disk?.trim()) { toast.warning('Existing disk path is required'); return }
    setSubmitting(true)
    try {
      // Generate cloud-init ISO if configured
      let cloudInitIso: string | undefined
      if (showCloudInit && (ciUser || ciSshKey)) {
        try {
          const ciResult = await generateCloudInit(form.name, ciUser, ciPass, ciSshKey)
          cloudInitIso = ciResult.path
          toast.info(`Cloud-init ISO created: ${ciResult.path}`)
        } catch (e: unknown) {
          toast.error(`Cloud-init failed: ${e instanceof Error ? e.message : e}`)
          setSubmitting(false)
          return
        }
      }
      const req = { ...form }
      if (cloudInitIso) { req.iso = cloudInitIso }
      if (diskMode === 'new') { req.existing_disk = '' }
      else { req.disk_gb = 0 }
      await createVM(req)
      toast.success(`Created VM '${form.name}'`)
      navigate('/vms')
    } catch (e: unknown) {
      toast.error(`Failed to create VM: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/vms" className="p-2 hover:bg-slate-700 rounded transition" aria-label="Back"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold">Create Virtual Machine</h1>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Layers className="w-5 h-5 text-blue-500" /> Templates</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {templates.map((t) => (
              <button
                key={t.name}
                onClick={() => applyTemplate(t.name)}
                className={`p-3 rounded-lg border text-left text-sm transition ${selectedTemplate === t.name ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700/50 hover:border-slate-600'}`}
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-slate-400 mt-1">{t.vcpus} vCPU &middot; {t.memory_mb} MB &middot; {t.disk_gb} GB</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Server className="w-5 h-5 text-green-500" /> Configuration</h3>

        <div>
          <label htmlFor="vm-name" className="block text-sm text-slate-400 mb-1">VM Name *</label>
          <input id="vm-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="my-vm" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="vm-vcpus" className="block text-sm text-slate-400 mb-1">vCPUs</label>
            <input id="vm-vcpus" type="number" min={1} max={256} value={form.vcpus} onChange={(e) => setForm({ ...form, vcpus: parseInt(e.target.value) || 1 })} className="input-field" />
          </div>
          <div>
            <label htmlFor="vm-memory" className="block text-sm text-slate-400 mb-1">Memory (MB)</label>
            <input id="vm-memory" type="number" min={64} value={form.memory_mb} onChange={(e) => setForm({ ...form, memory_mb: parseInt(e.target.value) || 2048 })} className="input-field" />
          </div>
          <div>
            <label htmlFor="vm-firmware" className="block text-sm text-slate-400 mb-1">Firmware</label>
            <select id="vm-firmware" value={form.firmware || 'bios'} onChange={(e) => setForm({ ...form, firmware: e.target.value })} className="input-field">
              <option value="bios">BIOS</option>
              <option value="uefi">UEFI</option>
            </select>
          </div>
        </div>

        {/* Disk Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Storage</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDiskMode('new')} className={`px-3 py-1.5 rounded text-xs transition ${diskMode === 'new' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>New Disk</button>
            <button type="button" onClick={() => setDiskMode('existing')} className={`px-3 py-1.5 rounded text-xs transition ${diskMode === 'existing' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Existing Disk Image</button>
          </div>
          {diskMode === 'new' ? (
            <div>
              <label htmlFor="vm-disk" className="block text-sm text-slate-400 mb-1">Disk Size (GB)</label>
              <input id="vm-disk" type="number" min={1} value={form.disk_gb} onChange={(e) => setForm({ ...form, disk_gb: parseInt(e.target.value) || 20 })} className="input-field" />
            </div>
          ) : (
            <div>
              <label htmlFor="vm-existing-disk" className="block text-sm text-slate-400 mb-1">Disk Image Path *</label>
              {diskFiles.length > 0 ? (
                <select id="vm-existing-disk" value={form.existing_disk || ''} onChange={(e) => setForm({ ...form, existing_disk: e.target.value })} className="input-field">
                  <option value="">Select disk image...</option>
                  {diskFiles.map(f => <option key={f.path} value={f.path}>{f.name} ({(f.size_bytes / 1073741824).toFixed(1)} GB)</option>)}
                </select>
              ) : (
                <input id="vm-existing-disk" type="text" value={form.existing_disk || ''} onChange={(e) => setForm({ ...form, existing_disk: e.target.value })} className="input-field" placeholder="/var/lib/libvirt/images/disk.qcow2" />
              )}
              <p className="text-xs text-slate-500 mt-1">Supports qcow2, raw, and img formats.</p>
            </div>
          )}
        </div>

        {/* Network */}
        <div>
          <label htmlFor="vm-network" className="block text-sm text-slate-400 mb-1">Network</label>
          {networks.length > 0 ? (
            <select id="vm-network" value={form.network || 'default'} onChange={(e) => setForm({ ...form, network: e.target.value })} className="input-field">
              {networks.map((n) => (
                <option key={n.name} value={n.name}>{n.name}{n.active ? '' : ' (inactive)'}</option>
              ))}
            </select>
          ) : (
            <input id="vm-network" type="text" value={form.network || ''} onChange={(e) => setForm({ ...form, network: e.target.value })} className="input-field" />
          )}
        </div>

        {/* ISO selection with browser */}
        <div>
          <label htmlFor="vm-iso" className="block text-sm text-slate-400 mb-1"><Disc className="w-3 h-3 inline -mt-0.5" /> ISO Path (optional)</label>
          {isoFiles.length > 0 ? (
            <select id="vm-iso" value={form.iso || ''} onChange={(e) => setForm({ ...form, iso: e.target.value })} className="input-field">
              <option value="">No ISO</option>
              {isoFiles.map(f => <option key={f.path} value={f.path}>{f.name} ({(f.size_bytes / 1048576).toFixed(0)} MB)</option>)}
            </select>
          ) : (
            <input id="vm-iso" type="text" value={form.iso || ''} onChange={(e) => setForm({ ...form, iso: e.target.value })} className="input-field" placeholder="/path/to/image.iso" />
          )}
        </div>

        {/* Cloud-init */}
        <div className="border-t border-slate-700/50 pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showCloudInit} onChange={e => setShowCloudInit(e.target.checked)} className="rounded border-slate-600" />
            <Cloud className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium">Cloud-Init Configuration</span>
          </label>
          {showCloudInit && (
            <div className="mt-3 space-y-3 pl-6">
              <div>
                <label htmlFor="ci-user" className="block text-sm text-slate-400 mb-1">Username</label>
                <input id="ci-user" type="text" value={ciUser} onChange={e => setCiUser(e.target.value)} className="input-field" placeholder="admin" />
              </div>
              <div>
                <label htmlFor="ci-pass" className="block text-sm text-slate-400 mb-1">Password</label>
                <input id="ci-pass" type="password" value={ciPass} onChange={e => setCiPass(e.target.value)} className="input-field" />
              </div>
              <div>
                <label htmlFor="ci-ssh" className="block text-sm text-slate-400 mb-1">SSH Public Key</label>
                <input id="ci-ssh" type="text" value={ciSshKey} onChange={e => setCiSshKey(e.target.value)} className="input-field" placeholder="ssh-ed25519 AAAA..." />
              </div>
              <p className="text-xs text-slate-500">Generates a cloud-init ISO and attaches it as CD-ROM. The guest OS must support cloud-init.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
          <Link to="/vms" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition">Cancel</Link>
          <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm transition">
            {submitting ? 'Creating...' : 'Create VM'}
          </button>
        </div>
      </form>
    </div>
  )
}

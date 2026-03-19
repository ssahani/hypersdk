import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { createVM, getTemplates, VmTemplate, CreateVmRequest } from '../api/vm'
import { useToastContext } from '../contexts/ToastContext'
import { ArrowLeft, Server, Layers } from 'lucide-react'
import { Link } from 'react-router'

export default function CreateVMPage() {
  const [form, setForm] = useState<CreateVmRequest>({ name: '', vcpus: 2, memory_mb: 2048, disk_gb: 20, network: 'default', os_variant: 'linux2022' })
  const [templates, setTemplates] = useState<VmTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToastContext()
  const navigate = useNavigate()

  useEffect(() => { getTemplates().then(setTemplates).catch(() => {}) }, [])

  const applyTemplate = (name: string) => {
    setSelectedTemplate(name)
    const tmpl = templates.find((t) => t.name === name)
    if (tmpl) setForm((f) => ({ ...f, vcpus: tmpl.vcpus, memory_mb: tmpl.memory_mb, disk_gb: tmpl.disk_gb, os_variant: tmpl.os_variant }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.warning('Name is required'); return }
    setSubmitting(true)
    try {
      await createVM(form)
      toast.success(`Created VM '${form.name}'`)
      navigate('/vms')
    } catch (e: unknown) {
      toast.error(`Failed to create VM: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/vms" className="p-2 hover:bg-gray-700 rounded transition"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold">Create Virtual Machine</h1>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Layers className="w-5 h-5 text-blue-500" /> Templates</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {templates.map((t) => (
              <button
                key={t.name}
                onClick={() => applyTemplate(t.name)}
                className={`p-3 rounded-lg border text-left text-sm transition ${selectedTemplate === t.name ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'}`}
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-gray-400 mt-1">{t.vcpus} vCPU &middot; {t.memory_mb} MB &middot; {t.disk_gb} GB</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Server className="w-5 h-5 text-green-500" /> Configuration</h3>

        <div>
          <label className="block text-sm text-gray-400 mb-1">VM Name *</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500" placeholder="my-vm" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">vCPUs</label>
            <input type="number" min={1} max={256} value={form.vcpus} onChange={(e) => setForm({ ...form, vcpus: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Memory (MB)</label>
            <input type="number" min={64} value={form.memory_mb} onChange={(e) => setForm({ ...form, memory_mb: parseInt(e.target.value) || 2048 })} className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Disk (GB)</label>
            <input type="number" min={1} value={form.disk_gb} onChange={(e) => setForm({ ...form, disk_gb: parseInt(e.target.value) || 20 })} className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Network</label>
          <input type="text" value={form.network || ''} onChange={(e) => setForm({ ...form, network: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">ISO Path (optional)</label>
          <input type="text" value={form.iso || ''} onChange={(e) => setForm({ ...form, iso: e.target.value })} className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500" placeholder="/path/to/image.iso" />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
          <Link to="/vms" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition">Cancel</Link>
          <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm transition">
            {submitting ? 'Creating...' : 'Create VM'}
          </button>
        </div>
      </form>
    </div>
  )
}

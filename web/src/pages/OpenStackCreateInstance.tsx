import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  createOpenStackInstance,
  listOpenStackFlavors,
  listOpenStackImages,
  listOpenStackNetworks,
  listOpenStackKeypairs,
  type OpenStackFlavor,
  type OpenStackImage,
  type OpenStackNetwork,
  type OpenStackKeyPair,
} from '../api/openstack'
import { useToastContext } from '../contexts/ToastContext'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'
import { ChoiceCard, ChoiceCardGrid } from '../components/ChoiceCards'
import { ArrowLeft, Cloud, Disc, Loader2, Network } from 'lucide-react'
import OpenStackFooter from '../components/OpenStackFooter'

const STEPS = ['Source', 'Flavor', 'Network & access', 'Review'] as const

export default function OpenStackCreateInstancePage() {
  const navigate = useNavigate()
  const toast = useToastContext()
  const { info } = usePlatformInfo()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [flavors, setFlavors] = useState<OpenStackFlavor[]>([])
  const [images, setImages] = useState<OpenStackImage[]>([])
  const [networks, setNetworks] = useState<OpenStackNetwork[]>([])
  const [keypairs, setKeypairs] = useState<OpenStackKeyPair[]>([])

  const [name, setName] = useState('')
  const [imageId, setImageId] = useState('')
  const [flavorId, setFlavorId] = useState('')
  const [networkId, setNetworkId] = useState('')
  const [keyName, setKeyName] = useState('')
  const [availabilityZone, setAvailabilityZone] = useState('')
  const [securityGroups, setSecurityGroups] = useState('')
  const [waitActive, setWaitActive] = useState(true)

  useEffect(() => {
    Promise.all([
      listOpenStackFlavors(),
      listOpenStackImages(),
      listOpenStackNetworks(),
      listOpenStackKeypairs(),
    ])
      .then(([f, i, n, k]) => {
        const os = info?.openstack
        const flavorsList = f.flavors
        const imagesList = i.images.filter((img) => img.status === 'ACTIVE')
        const networksList = n.networks
        const keypairsList = k.keypairs
        setFlavors(flavorsList)
        setImages(imagesList)
        setNetworks(networksList)
        setKeypairs(keypairsList)
        if (os?.default_flavor) {
          const match = flavorsList.find(
            (fl) => fl.id === os.default_flavor || fl.name === os.default_flavor,
          )
          if (match) setFlavorId(match.id)
        }
        if (os?.default_network) {
          const match = networksList.find(
            (net) => net.id === os.default_network || net.name === os.default_network,
          )
          if (match) setNetworkId(match.id)
        }
        if (os?.default_key_name) {
          const match = keypairsList.find((kp) => kp.name === os.default_key_name)
          if (match) setKeyName(match.name)
        }
      })
      .catch((e: unknown) => {
        toast.error(`Failed to load catalogs: ${e instanceof Error ? e.message : e}`)
      })
      .finally(() => setLoading(false))
  }, [toast, info])

  const selectedFlavor = flavors.find((f) => f.id === flavorId || f.name === flavorId)
  const selectedImage = images.find((i) => i.id === imageId)
  const selectedNetwork = networks.find((n) => n.id === networkId || n.name === networkId)

  const canNext = () => {
    if (step === 0) return name.trim().length > 0 && imageId.length > 0
    if (step === 1) return flavorId.length > 0
    if (step === 2) return networkId.length > 0
    return true
  }

  const handleCreate = async () => {
    if (!name.trim() || !flavorId || !imageId || !networkId) {
      toast.warning('Complete all required fields')
      return
    }
    setSubmitting(true)
    try {
      const sgList = securityGroups
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const resp = await createOpenStackInstance({
        name: name.trim(),
        flavor: flavorId,
        image: imageId,
        network: networkId,
        key_name: keyName || undefined,
        availability_zone: availabilityZone.trim() || undefined,
        security_groups: sgList.length > 0 ? sgList : undefined,
        wait_until_active: waitActive,
      })
      toast.success(`Instance ${resp.name} created (${resp.status})`)
      navigate(`/openstack/instances/${encodeURIComponent(resp.id)}`)
    } catch (e: unknown) {
      toast.error(`Create failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-slate-500 py-12 text-center">Loading OpenStack catalogs…</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/openstack/instances" className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm">
        <ArrowLeft className="w-4 h-4" />
        Instances
      </Link>

      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Cloud className="w-7 h-7 text-sky-400" />
        Create OpenStack instance
      </h1>

      <div className="flex gap-2 text-xs text-slate-500">
        {STEPS.map((label, i) => (
          <span key={label} className={i === step ? 'text-sky-400 font-medium' : ''}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Instance name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
              placeholder="my-vm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Glance image</label>
            <ChoiceCardGrid>
              {images.map((img) => (
                <ChoiceCard
                  key={img.id}
                  tone="sky"
                  icon={<Disc className="w-4 h-4" />}
                  selected={imageId === img.id}
                  onClick={() => setImageId(img.id)}
                  title={img.name || img.id.slice(0, 8)}
                  description={`${img.min_disk_gb} GB disk · ${img.min_ram_mb} MB RAM min`}
                />
              ))}
            </ChoiceCardGrid>
            {images.length === 0 && (
              <p className="text-slate-500 text-sm">No ACTIVE images in this project.</p>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <label className="block text-sm text-slate-400 mb-2">Flavor</label>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">vCPU</th>
                  <th className="px-3 py-2">RAM</th>
                  <th className="px-3 py-2">Disk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {flavors.map((f) => (
                  <tr
                    key={f.id}
                    className={`cursor-pointer hover:bg-slate-800/50 ${flavorId === f.id ? 'bg-sky-500/10' : ''}`}
                    onClick={() => setFlavorId(f.id)}
                  >
                    <td className="px-3 py-2">
                      <input type="radio" checked={flavorId === f.id} readOnly />
                    </td>
                    <td className="px-3 py-2 text-slate-200">{f.name}</td>
                    <td className="px-3 py-2">{f.vcpus}</td>
                    <td className="px-3 py-2">{f.ram_mb} MB</td>
                    <td className="px-3 py-2">{f.disk_gb} GB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Network</label>
            <ChoiceCardGrid>
              {networks.map((net) => (
                <ChoiceCard
                  key={net.id}
                  tone="cyan"
                  icon={<Network className="w-4 h-4" />}
                  selected={networkId === net.id}
                  onClick={() => setNetworkId(net.id)}
                  title={net.name || net.id.slice(0, 8)}
                  description={net.external ? 'External' : 'Internal'}
                />
              ))}
            </ChoiceCardGrid>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">SSH key pair (optional)</label>
            <select
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
            >
              <option value="">None</option>
              {keypairs.map((kp) => (
                <option key={kp.name} value={kp.name}>{kp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Availability zone (optional)</label>
            <input
              value={availabilityZone}
              onChange={(e) => setAvailabilityZone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
              placeholder="nova"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Security groups (comma-separated, optional)</label>
            <input
              value={securityGroups}
              onChange={(e) => setSecurityGroups(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100"
              placeholder="default"
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-xl border border-slate-700 p-4 space-y-2 text-sm">
          <p><span className="text-slate-500">Name:</span> {name}</p>
          <p><span className="text-slate-500">Image:</span> {selectedImage?.name || imageId}</p>
          <p><span className="text-slate-500">Flavor:</span> {selectedFlavor?.name} ({selectedFlavor?.vcpus} vCPU, {selectedFlavor?.ram_mb} MB)</p>
          <p><span className="text-slate-500">Network:</span> {selectedNetwork?.name || networkId}</p>
          <p><span className="text-slate-500">Key pair:</span> {keyName || '—'}</p>
          <p><span className="text-slate-500">AZ:</span> {availabilityZone || '—'}</p>
          <p><span className="text-slate-500">Security groups:</span> {securityGroups || '—'}</p>
          <label className="flex items-center gap-2 mt-3 text-slate-400">
            <input type="checkbox" checked={waitActive} onChange={(e) => setWaitActive(e.target.checked)} />
            Wait until ACTIVE (may take several minutes)
          </label>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canNext()}
            onClick={() => setStep((s) => s + 1)}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create instance
          </button>
        )}
      </div>

      <OpenStackFooter />
    </div>
  )
}

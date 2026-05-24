import { useCallback, useEffect, useState } from 'react'
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
import { ArrowLeft, Cloud, Disc, Loader2, Network, RefreshCw } from 'lucide-react'
import OpenStackFooter from '../components/OpenStackFooter'
import OpenStackGate from '../components/OpenStackGate'
import OpenStackSubNav from '../components/OpenStackSubNav'
import OpenStackStatusBar from '../components/OpenStackStatusBar'
import ErrorBanner from '../components/ErrorBanner'
import { formatUserError } from '../utils/apiError'
import { openStackErrorHints } from '../utils/openstackHints'

const STEPS = ['Source', 'Flavor', 'Network & access', 'Review'] as const

type CatalogKey = 'flavors' | 'images' | 'networks' | 'keypairs'

export default function OpenStackCreateInstancePage() {
  return (
    <OpenStackGate title="Create OpenStack Instance">
      <OpenStackCreateInstanceContent />
    </OpenStackGate>
  )
}

function OpenStackCreateInstanceContent() {
  const navigate = useNavigate()
  const toast = useToastContext()
  const { info } = usePlatformInfo()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [catalogErrors, setCatalogErrors] = useState<Partial<Record<CatalogKey, string>>>({})

  const [flavors, setFlavors] = useState<OpenStackFlavor[]>([])
  const [images, setImages] = useState<OpenStackImage[]>([])
  const [allImages, setAllImages] = useState<OpenStackImage[]>([])
  const [networks, setNetworks] = useState<OpenStackNetwork[]>([])
  const [keypairs, setKeypairs] = useState<OpenStackKeyPair[]>([])

  const [name, setName] = useState('')
  const [imageId, setImageId] = useState('')
  const [flavorId, setFlavorId] = useState('')
  const [networkId, setNetworkId] = useState('')
  const [keyName, setKeyName] = useState('')
  const [availabilityZone, setAvailabilityZone] = useState('')
  const [securityGroups, setSecurityGroups] = useState('')
  const [userData, setUserData] = useState('')
  const [waitActive, setWaitActive] = useState(true)

  const loadCatalogs = useCallback(async () => {
    setLoading(true)
    setCatalogErrors({})
    const [flavorsR, imagesR, networksR, keypairsR] = await Promise.allSettled([
      listOpenStackFlavors(),
      listOpenStackImages(),
      listOpenStackNetworks(),
      listOpenStackKeypairs(),
    ])

    const errs: Partial<Record<CatalogKey, string>> = {}
    const os = info?.openstack

    if (flavorsR.status === 'fulfilled') {
      const flavorsList = flavorsR.value.flavors
      setFlavors(flavorsList)
      if (os?.default_flavor) {
        const match = flavorsList.find(
          (fl) => fl.id === os.default_flavor || fl.name === os.default_flavor,
        )
        if (match) setFlavorId(match.id)
      }
    } else {
      errs.flavors = formatUserError(flavorsR.reason)
      setFlavors([])
    }

    if (imagesR.status === 'fulfilled') {
      const imagesList = imagesR.value.images
      setAllImages(imagesList)
      const active = imagesList.filter((img) => img.status === 'ACTIVE')
      setImages(active)
    } else {
      errs.images = formatUserError(imagesR.reason)
      setImages([])
      setAllImages([])
    }

    if (networksR.status === 'fulfilled') {
      const networksList = networksR.value.networks
      setNetworks(networksList)
      if (os?.default_network) {
        const match = networksList.find(
          (net) => net.id === os.default_network || net.name === os.default_network,
        )
        if (match) setNetworkId(match.id)
      }
    } else {
      errs.networks = formatUserError(networksR.reason)
      setNetworks([])
    }

    if (keypairsR.status === 'fulfilled') {
      const keypairsList = keypairsR.value.keypairs
      setKeypairs(keypairsList)
      if (os?.default_key_name) {
        const match = keypairsList.find((kp) => kp.name === os.default_key_name)
        if (match) setKeyName(match.name)
      }
    } else {
      errs.keypairs = formatUserError(keypairsR.reason)
      setKeypairs([])
    }

    setCatalogErrors(errs)
    setLoading(false)

    const failed = Object.keys(errs)
    if (failed.length === 4) {
      toast.error('Could not load any OpenStack catalogs — see error panel')
    } else if (failed.length > 0) {
      toast.warning(`Some catalogs failed: ${failed.join(', ')}`)
    }
  }, [info?.openstack, toast])

  useEffect(() => {
    void loadCatalogs()
  }, [loadCatalogs])

  const selectedFlavor = flavors.find((f) => f.id === flavorId || f.name === flavorId)
  const selectedImage = images.find((i) => i.id === imageId)
  const selectedNetwork = networks.find((n) => n.id === networkId || n.name === networkId)

  const catalogErrorSummary = Object.entries(catalogErrors)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const canNext = () => {
    if (step === 0) {
      if (catalogErrors.images) return false
      return name.trim().length > 0 && imageId.length > 0
    }
    if (step === 1) {
      if (catalogErrors.flavors) return false
      return flavorId.length > 0
    }
    if (step === 2) {
      if (catalogErrors.networks) return false
      return networkId.length > 0
    }
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
        user_data: userData.trim() || undefined,
        wait_until_active: waitActive,
      })
      toast.success(`Instance ${resp.name} created (${resp.status})`)
      navigate(`/openstack/instances/${encodeURIComponent(resp.id)}`)
    } catch (e: unknown) {
      const msg = formatUserError(e)
      toast.error(`Create failed: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <OpenStackSubNav />
        <OpenStackStatusBar />
        <div className="text-slate-500 py-12 text-center flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
          Loading OpenStack catalogs…
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <OpenStackSubNav />
      <OpenStackStatusBar />

      {catalogErrorSummary && (
        <ErrorBanner
          title="OpenStack catalog errors"
          headline={
            Object.keys(catalogErrors).length === 4
              ? 'Could not load flavors, images, networks, or keypairs from the API.'
              : `Failed to load: ${Object.keys(catalogErrors).join(', ')}. Other catalogs may still be usable.`
          }
          hints={openStackErrorHints(catalogErrorSummary)}
          technicalDetail={catalogErrorSummary}
          tone="red"
          onRetry={() => void loadCatalogs()}
          retryLabel="Reload catalogs"
        />
      )}

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
            {catalogErrors.images ? (
              <p className="text-sm text-red-300/90">{catalogErrors.images}</p>
            ) : (
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
            )}
            {!catalogErrors.images && images.length === 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90 space-y-2">
                <p>No ACTIVE images in this project.</p>
                {allImages.length > 0 && (
                  <p className="text-xs text-amber-200/70">
                    {allImages.length} image(s) exist but none are ACTIVE yet — wait for upload/import to finish.
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  <Link to="/disk-images" className="text-sky-400 hover:underline">
                    Push qcow2 from Disk images
                  </Link>
                  {' · '}
                  <Link to="/import" className="text-sky-400 hover:underline">
                    Import VM
                  </Link>
                  {' · on host: '}
                  <code className="text-[11px]">openstack image list</code>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <label className="block text-sm text-slate-400 mb-2">Flavor</label>
          {catalogErrors.flavors ? (
            <p className="text-sm text-red-300/90">{catalogErrors.flavors}</p>
          ) : flavors.length === 0 ? (
            <p className="text-sm text-slate-500">No flavors returned from Nova.</p>
          ) : (
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
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Network</label>
            {catalogErrors.networks ? (
              <p className="text-sm text-red-300/90">{catalogErrors.networks}</p>
            ) : networks.length === 0 ? (
              <p className="text-sm text-slate-500">
                No Neutron networks available. Fix Neutron on the host, then reload catalogs.
              </p>
            ) : (
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
            )}
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">SSH key pair (optional)</label>
            {catalogErrors.keypairs && (
              <p className="text-xs text-amber-300/80 mb-1">Keypairs unavailable: {catalogErrors.keypairs}</p>
            )}
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
          <div>
            <label className="block text-sm text-slate-400 mb-1">Cloud-init user_data (optional)</label>
            <textarea
              value={userData}
              onChange={(e) => setUserData(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs"
              placeholder="#cloud-config&#10;ssh_pwauth: true"
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
          <p><span className="text-slate-500">user_data:</span> {userData.trim() ? `${userData.trim().length} chars` : '—'}</p>
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadCatalogs()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
            Reload
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
              disabled={submitting || Boolean(catalogErrors.flavors || catalogErrors.images || catalogErrors.networks)}
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create instance
            </button>
          )}
        </div>
      </div>

      <OpenStackFooter />
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  attachOpenStackVolume,
  associateOpenStackFloatingIp,
  detachOpenStackVolume,
  dissociateOpenStackFloatingIp,
  getOpenStackConsoleOutput,
  getOpenStackRemoteConsole,
  listOpenStackCinderVolumes,
  listOpenStackFlavors,
  listOpenStackFloatingIps,
  listOpenStackInstanceFloatingIps,
  listOpenStackNetworks,
  pauseOpenStackInstance,
  resizeOpenStackInstance,
  resumeOpenStackInstance,
  suspendOpenStackInstance,
  unpauseOpenStackInstance,
  addOpenStackSecurityGroup,
  removeOpenStackSecurityGroup,
  OPENSTACK_CONSOLE_TYPES,
  type OpenStackAttachedVolume,
  type OpenStackConsoleType,
  type OpenStackFloatingIp,
  type OpenStackInstance,
  type OpenStackNetwork,
} from '../api/openstack'
import { useToastContext } from '../contexts/ToastContext'
import OpenStackExportModal from './OpenStackExportModal'
import {
  Globe, HardDrive, Pause, PlayCircle, Terminal, Upload, Shield, Maximize2, ExternalLink,
} from 'lucide-react'
import { isFloatingIpAvailable } from '../utils/openstackFloatingIp'

type Props = {
  inst: OpenStackInstance
  volumes: OpenStackAttachedVolume[]
  onRefresh: () => void
}

export default function OpenStackInstanceAdvanced({ inst, volumes, onRefresh }: Props) {
  const toast = useToastContext()
  const extrasErrorShown = useRef(false)
  const [fips, setFips] = useState<OpenStackFloatingIp[]>([])
  const [poolFips, setPoolFips] = useState<OpenStackFloatingIp[]>([])
  const [cinderVols, setCinderVols] = useState<OpenStackAttachedVolume[]>([])
  const [networks, setNetworks] = useState<OpenStackNetwork[]>([])
  const [flavors, setFlavors] = useState<{ id: string; name: string }[]>([])
  const [attachVolId, setAttachVolId] = useState('')
  const [extNet, setExtNet] = useState('')
  const [existingFipId, setExistingFipId] = useState('')
  const [resizeFlavor, setResizeFlavor] = useState('')
  const [sgName, setSgName] = useState('')
  const [consoleType, setConsoleType] = useState<OpenStackConsoleType>('novnc')
  const [consoleLog, setConsoleLog] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const loadExtras = useCallback(async () => {
    try {
      const [f, allFips, cv, n, fl] = await Promise.all([
        listOpenStackInstanceFloatingIps(inst.id),
        listOpenStackFloatingIps(),
        listOpenStackCinderVolumes(),
        listOpenStackNetworks(),
        listOpenStackFlavors(),
      ])
      setFips(f.floating_ips)
      setPoolFips(allFips.floating_ips.filter((ip) => isFloatingIpAvailable(ip, inst.id)))
      setCinderVols(cv.volumes.filter((v) => !volumes.some((a) => a.id === v.id)))
      setNetworks(n.networks.filter((net) => net.external))
      setFlavors(fl.flavors.map((x) => ({ id: x.id, name: x.name })))
      setExtNet((prev) => {
        if (prev) return prev
        const ext = n.networks.find((net) => net.external)
        return ext ? ext.id : prev
      })
    } catch (e: unknown) {
      if (!extrasErrorShown.current) {
        extrasErrorShown.current = true
        toast.error(
          e instanceof Error ? e.message : 'Failed to load OpenStack networking extras',
        )
      }
    }
  }, [inst.id, volumes, toast])

  useEffect(() => {
    extrasErrorShown.current = false
    void loadExtras()
  }, [loadExtras])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      toast.success(ok)
      onRefresh()
      void loadExtras()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const openRemoteConsole = async () => {
    try {
      const c = await getOpenStackRemoteConsole(inst.id, consoleType)
      window.open(c.url, '_blank', 'noopener,noreferrer')
      toast.success(`Opened ${c.console_type || consoleType} console`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const availablePool = poolFips.filter((ip) => !fips.some((a) => a.id === ip.id))

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-700/80 p-4">
        <h2 className="font-medium text-slate-200 mb-3">Power &amp; lifecycle</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => run(() => pauseOpenStackInstance(inst.id), 'Paused')}
            className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm hover:bg-slate-800">
            <Pause className="w-3.5 h-3.5 inline mr-1" /> Pause
          </button>
          <button type="button" onClick={() => run(() => unpauseOpenStackInstance(inst.id), 'Unpaused')}
            className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm hover:bg-slate-800">
            Unpause
          </button>
          <button type="button" onClick={() => run(() => suspendOpenStackInstance(inst.id), 'Suspended')}
            className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm hover:bg-slate-800">
            Suspend
          </button>
          <button type="button" onClick={() => run(() => resumeOpenStackInstance(inst.id), 'Resumed')}
            className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm hover:bg-slate-800">
            <PlayCircle className="w-3.5 h-3.5 inline mr-1" /> Resume
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Resize to flavor</label>
            <select value={resizeFlavor} onChange={(e) => setResizeFlavor(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm">
              <option value="">Select…</option>
              {flavors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <button type="button" disabled={!resizeFlavor}
            onClick={() => run(() => resizeOpenStackInstance(inst.id, resizeFlavor), 'Resize submitted')}
            className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-sm text-white disabled:opacity-40">
            <Maximize2 className="w-3.5 h-3.5 inline mr-1" /> Resize
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-700/80 p-4">
        <h2 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-400" /> Console
        </h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Remote console type</label>
            <select
              value={consoleType}
              onChange={(e) => setConsoleType(e.target.value as OpenStackConsoleType)}
              className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm min-w-[10rem]"
            >
              {OPENSTACK_CONSOLE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void openRemoteConsole()}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm text-white inline-flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open console
          </button>
          <button type="button" onClick={async () => {
            try {
              const { output } = await getOpenStackConsoleOutput(inst.id, 100)
              setConsoleLog(output || '(empty)')
            } catch (e: unknown) {
              toast.error(e instanceof Error ? e.message : String(e))
            }
          }} className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm hover:bg-slate-800">
            Serial log (100 lines)
          </button>
        </div>
        {consoleLog != null && (
          <pre className="mt-3 p-3 rounded-lg bg-black/60 text-xs text-slate-300 overflow-auto max-h-48 whitespace-pre-wrap">
            {consoleLog}
          </pre>
        )}
      </section>

      <section className="rounded-xl border border-slate-700/80 p-4">
        <h2 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-sky-400" /> Floating IPs
        </h2>
        {fips.length === 0 ? (
          <p className="text-slate-500 text-sm mb-3">No floating IPs on this instance.</p>
        ) : (
          <ul className="space-y-2 mb-3 text-sm font-mono text-slate-300">
            {fips.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2">
                {f.address}
                {f.fixed_address && <span className="text-slate-500">→ {f.fixed_address}</span>}
                <span className="text-xs text-slate-600">({f.status})</span>
                <button type="button" onClick={() => run(() => dissociateOpenStackFloatingIp(f.id), 'Dissociated')}
                  className="text-xs text-red-400 hover:underline">Dissociate</button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-slate-500 mb-2">Associate an existing unbound floating IP</p>
        <div className="flex flex-wrap gap-2 items-end mb-4 pb-4 border-b border-slate-700/60">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Available in project</label>
            <select
              value={existingFipId}
              onChange={(e) => setExistingFipId(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm max-w-md"
            >
              <option value="">Select floating IP…</option>
              {availablePool.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.address} ({f.status}{f.instance_id ? ` · was ${f.instance_id.slice(0, 8)}` : ''})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!existingFipId}
            onClick={() => run(
              () => associateOpenStackFloatingIp(inst.id, { floating_ip_id: existingFipId }),
              'Existing floating IP associated',
            )}
            className="px-3 py-1.5 rounded-lg border border-sky-500/50 text-sky-200 hover:bg-sky-500/10 text-sm disabled:opacity-40"
          >
            Associate existing
          </button>
          {availablePool.length === 0 && (
            <span className="text-xs text-slate-600">No unbound IPs in this project.</span>
          )}
        </div>

        <p className="text-xs text-slate-500 mb-2">Or allocate a new floating IP</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">External network</label>
            <select value={extNet} onChange={(e) => setExtNet(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm max-w-xs">
              <option value="">Select…</option>
              {networks.map((n) => (
                <option key={n.id} value={n.id}>{n.name || n.id}</option>
              ))}
            </select>
          </div>
          <button type="button" disabled={!extNet}
            onClick={() => run(
              () => associateOpenStackFloatingIp(inst.id, { floating_network: extNet }),
              'New floating IP allocated and associated',
            )}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm text-white disabled:opacity-40">
            Allocate &amp; associate
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-700/80 p-4">
        <h2 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-sky-400" /> Cinder volumes
        </h2>
        <div className="flex flex-wrap gap-2 items-end mb-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Attach volume</label>
            <select value={attachVolId} onChange={(e) => setAttachVolId(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm max-w-md">
              <option value="">Select unattached volume…</option>
              {cinderVols.map((v) => (
                <option key={v.id} value={v.id}>{v.name || v.id} ({v.size_gb} GB)</option>
              ))}
            </select>
          </div>
          <button type="button" disabled={!attachVolId}
            onClick={() => run(() => attachOpenStackVolume(inst.id, attachVolId), 'Volume attached')}
            className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm hover:bg-slate-800 disabled:opacity-40">
            Attach
          </button>
        </div>
        {volumes.length > 0 && (
          <ul className="space-y-2 text-sm">
            {volumes.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 font-mono text-slate-300">
                <span>{v.device || '—'}</span>
                <span className="text-slate-500">· {v.name || v.id}</span>
                <button type="button" onClick={() => run(() => detachOpenStackVolume(inst.id, v.id), 'Detached')}
                  className="text-xs text-red-400 hover:underline">Detach</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-700/80 p-4">
        <h2 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-sky-400" /> Security groups
        </h2>
        <div className="flex flex-wrap gap-2 items-end mb-2">
          <input value={sgName} onChange={(e) => setSgName(e.target.value)} placeholder="group name"
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm" />
          <button type="button" disabled={!sgName.trim()}
            onClick={() => run(() => addOpenStackSecurityGroup(inst.id, sgName.trim()), 'Security group added')}
            className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm disabled:opacity-40">Add</button>
        </div>
        {inst.security_groups.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {inst.security_groups.map((g) => (
              <li key={g} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-sm">
                {g}
                <button type="button" className="text-red-400 text-xs ml-1"
                  onClick={() => run(() => removeOpenStackSecurityGroup(inst.id, g), 'Removed')}>×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-700/80 p-4">
        <h2 className="font-medium text-slate-200 mb-2 flex items-center gap-2">
          <Upload className="w-4 h-4 text-sky-400" /> Export to Glance
        </h2>
        <p className="text-slate-500 text-sm mb-3">
          Snapshot to Glance and optionally pull qcow2 to this hypervisor for libvirt import.
        </p>
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm text-white"
        >
          Export to hypervisor…
        </button>
      </section>

      <OpenStackExportModal
        open={exportOpen}
        instanceId={inst.id}
        instanceName={inst.name}
        onClose={() => setExportOpen(false)}
      />
    </div>
  )
}

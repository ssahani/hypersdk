// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import PageLayout from '../../components/PageLayout'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowLeft, ExternalLink, Monitor, RefreshCw, Terminal } from 'lucide-react'
import {
  getConsoleHubPlan,
  getPlatformVm,
  getPlatformVmSpec,
  getVmGuestHealth,
  issuePlatformVmWsToken,
  platformVmSerialWsUrl,
  platformVmVncWsUrl,
} from '../../api/platform'
import { loadVmSshPrefs } from '../../utils/vmSshPrefs'
import { navigateVmSshSession } from '../../components/vm/VmSshConnectDialog'
import { formatUserError } from '../../utils/apiError'
import AiTerminalCompanion from '../../components/ai/AiTerminalCompanion'
import GuacamoleConsoleLink from '../../components/GuacamoleConsoleLink'
import SerialConsole from '../../components/SerialConsole'
import VNCViewer from '../../components/VNCViewer'
import { fillViewportVncProps } from '../../utils/embeddedVnc'
import { isCenterPopoutMode, openCenterPopout } from '../../utils/platformCenterPopout'
import { hubLinkClasses } from '../../utils/semanticColors'

type ConsoleTab = 'serial' | 'vnc'

export default function PlatformConsole() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const isPopout = isCenterPopoutMode(location.search)
  const [vmName, setVmName] = useState<string | null>(null)
  const [vncWsUrl, setVncWsUrl] = useState<string | null>(null)
  const [serialWsUrl, setSerialWsUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ConsoleTab>('serial')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectKey, setConnectKey] = useState(0)
  const [guestIp, setGuestIp] = useState('')
  const [sshUser, setSshUser] = useState('ubuntu')
  const [recommended, setRecommended] = useState<string>('serial')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void Promise.all([
      getConsoleHubPlan(id).catch(() => null),
      issuePlatformVmWsToken(id),
      getPlatformVm(id).catch(() => null),
      getVmGuestHealth(id).catch(() => null),
      getPlatformVmSpec(id).catch(() => null),
    ])
      .then(([plan, tokenRes, vm, gh, spec]) => {
        if (cancelled) return
        const name = vm?.name ?? plan?.vm_name ?? null
        setVmName(name)
        setVncWsUrl(platformVmVncWsUrl(id, tokenRes.token))
        setSerialWsUrl(platformVmSerialWsUrl(id, tokenRes.token))
        const rec = plan?.recommended ?? 'serial'
        setRecommended(rec)
        setActiveTab(rec === 'novnc' ? 'vnc' : 'serial')
        setGuestIp(gh?.guest_ip?.trim() ?? vm?.guest_ip?.trim() ?? '')
        const ci = (spec as { cloud_init?: { user?: string } } | null)?.cloud_init
        const user = ci?.user?.trim() || loadVmSshPrefs(name ?? '')?.user || 'ubuntu'
        setSshUser(user)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(formatUserError(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, connectKey])

  const tabBtn = (tab: ConsoleTab, label: string, Icon: typeof Terminal) => (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
        activeTab === tab
          ? 'bg-slate-700 text-slate-100'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
      onClick={() => setActiveTab(tab)}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  )

  return (
    <PageLayout
      compact
      hideHeader={isPopout}
      loading={loading}
      title={vmName ?? 'VM console'}
      subtitle={<span className="text-slate-500">Serial + VNC · Cockpit-style same-origin proxy</span>}
      icon={<Terminal className="w-6 h-6 text-slate-400" />}
      prepend={
        !isPopout ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link to="/platform/vms" className={`inline-flex items-center gap-1 ${hubLinkClasses()}`}>
              <ArrowLeft className="w-4 h-4" /> VM list
            </Link>
            {id && !error?.toLowerCase().includes('not found') ? (
              <Link to={`/platform/vms/${id}`} className={`inline-flex items-center gap-1 ${hubLinkClasses()}`}>
                Back to VM
              </Link>
            ) : null}
          </div>
        ) : undefined
      }
      actions={
        !isPopout ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-sm inline-flex items-center gap-1"
              onClick={() => setConnectKey((k) => k + 1)}
            >
              <RefreshCw className="w-4 h-4" /> Reconnect
            </button>
            <button
              type="button"
              className="btn-secondary text-sm inline-flex items-center gap-1"
              onClick={() => openCenterPopout(`/platform/vms/${id}/console`)}
            >
              <ExternalLink className="w-4 h-4" /> Pop out
            </button>
            {vmName && <GuacamoleConsoleLink vmName={vmName} className="btn-secondary text-sm inline-flex items-center gap-1 py-1.5 px-3" />}
          </div>
        ) : undefined
      }
      error={error}
      errorHints={
        error?.toLowerCase().includes('not found')
          ? [
              'This VM id is missing from the platform database (deleted VM or stale bookmark / Spotlight entry).',
              'Open Platform → VMs and pick a current machine, or Platform → Hosts → Sync all to refresh inventory.',
            ]
          : error?.toLowerCase().includes('hypervisor') || error?.toLowerCase().includes('libvirt')
            ? [
                'The guest is not running on libvirt, or inventory is out of date.',
                'Start the VM from Platform → VMs, then retry console. Sync hosts if the list looks wrong.',
              ]
            : error?.toLowerCase().includes('transport') || error?.toLowerCase().includes('agent')
              ? [
                  'Ensure machina-agent is running (systemctl status machina-agent).',
                  'Sync hosts from Platform → Hosts if the host shows offline.',
                ]
              : undefined
      }
      onErrorRetry={() => setConnectKey((k) => k + 1)}
    >
      {vmName && (vncWsUrl || serialWsUrl) && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {tabBtn('serial', 'Serial', Terminal)}
            {tabBtn('vnc', 'Graphics (VNC)', Monitor)}
            {recommended === 'serial' && activeTab === 'vnc' ? (
              <span className="text-xs text-amber-300/90 ml-1">
                Linux cloud images often boot on Serial — switch to Serial for login output.
              </span>
            ) : null}
          </div>
          {activeTab === 'serial' && serialWsUrl ? (
            <SerialConsole
              key={`serial-${connectKey}`}
              vmName={vmName}
              wsUrl={serialWsUrl}
            />
          ) : null}
          {activeTab === 'vnc' && vncWsUrl ? (
            <div
              className="flex flex-col min-h-0 overflow-hidden rounded-lg border border-slate-700/50 bg-black"
              style={{ height: isPopout ? 'calc(100dvh - 6rem)' : 'max(520px, calc(100dvh - 18rem))' }}
            >
              <VNCViewer
                key={`vnc-${connectKey}`}
                vmName={vmName}
                wsUrl={vncWsUrl}
                hideInstallerHint
                onReconnect={() => setConnectKey((k) => k + 1)}
                {...fillViewportVncProps}
              />
            </div>
          ) : null}
        </>
      )}
      {id && !isPopout && (vncWsUrl || serialWsUrl) && (
        <div className="flex flex-wrap items-center gap-3 py-2 text-xs text-slate-400 border-t border-slate-800/80 mt-2">
          <span>Serial for cloud boot/login · VNC toolbar includes Ctrl+Alt+Del</span>
          {guestIp && vmName && (
            <>
              <button
                type="button"
                className="font-mono text-emerald-300/90 hover:underline"
                onClick={() => void navigator.clipboard.writeText(guestIp).then(() => undefined)}
              >
                {guestIp}
              </button>
              <button
                type="button"
                className="btn-secondary text-xs py-1"
                onClick={() => navigateVmSshSession(vmName, guestIp, sshUser)}
              >
                SSH
              </button>
            </>
          )}
        </div>
      )}
      {id && !isPopout && (vncWsUrl || serialWsUrl) && (
        <AiTerminalCompanion vmName={vmName ?? id} vmId={id} />
      )}
    </PageLayout>
  )
}

// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Copy, Download, ExternalLink, HelpCircle, Loader2, Monitor, Terminal, ArrowRight } from 'lucide-react'
import type { GuestPortReport } from '../../api/zeusFirewall'
import {
  createVmPortForward,
  deleteVmPortForward,
  listVmPortForwards,
  type VmPortForwardRule,
} from '../../api/platform'
import { hubLinkClasses } from '../../utils/semanticColors'
import { VM_DAILY_ACCESS_GUIDE_URL } from '../../utils/vmDailyAccessGuide'
import { formatUserError } from '../../utils/apiError'
import VmSshConnectDialog, { navigateVmSshSession } from './VmSshConnectDialog'

const HTTP_PORTS = new Set([80, 443, 8080, 8443, 8000, 3000])

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export interface VmDailyAccessStripProps {
  vmName: string
  vmState: string
  sshUser: string
  guestIp?: string
  detectedIps?: string[]
  consoleHref: string
  specJson?: string
  onExportXml?: () => Promise<string>
  guestPorts?: GuestPortReport | null
  guestPortsLoading?: boolean
  onRefreshPorts?: () => void
  onAllPorts?: () => void
  natForwardHref?: string
  /** Platform VM id — enables in-strip NAT expose (host iptables via agent). */
  platformVmId?: string
  guestIpWaiting?: boolean
  onRefreshGuestIp?: () => void
  onInstallGuestTools?: () => void
  guestToolsInstalling?: boolean
  guestIpHint?: string
  helpGuideHref?: string
  disabled?: boolean
  onNotify?: (message: string) => void
}

export default function VmDailyAccessStrip({
  vmName,
  vmState,
  sshUser,
  guestIp = '',
  detectedIps = [],
  consoleHref,
  specJson,
  onExportXml,
  guestPorts,
  guestPortsLoading,
  onRefreshPorts,
  onAllPorts,
  natForwardHref,
  platformVmId,
  guestIpWaiting = false,
  onRefreshGuestIp,
  onInstallGuestTools,
  guestToolsInstalling = false,
  guestIpHint,
  helpGuideHref = VM_DAILY_ACCESS_GUIDE_URL,
  disabled = false,
  onNotify,
}: VmDailyAccessStripProps) {
  const [sshOpen, setSshOpen] = useState(false)
  const [pfRules, setPfRules] = useState<VmPortForwardRule[]>([])
  const [pfLoading, setPfLoading] = useState(false)
  const [pfHostPort, setPfHostPort] = useState('9080')
  const [pfVmPort, setPfVmPort] = useState('80')
  const [pfBusy, setPfBusy] = useState(false)
  const running = vmState === 'running'
  const ip = guestIp.trim()
  const topPorts = (guestPorts?.ports ?? []).slice(0, 5)

  const notify = (msg: string) => onNotify?.(msg)

  const loadPf = useCallback(async () => {
    if (!platformVmId || !ip) {
      setPfRules([])
      return
    }
    setPfLoading(true)
    try {
      setPfRules(await listVmPortForwards(platformVmId))
    } catch {
      setPfRules([])
    } finally {
      setPfLoading(false)
    }
  }, [platformVmId, ip])

  useEffect(() => {
    void loadPf()
  }, [loadPf])

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      notify(label)
    } catch {
      notify('Copy failed')
    }
  }

  const sshCommand = ip ? `ssh ${sshUser}@${ip}` : ''

  const openSsh = (host: string, user: string) => navigateVmSshSession(vmName, host, user)

  const exportBundle = async () => {
    if (specJson) downloadText(`${vmName}-spec.json`, specJson, 'application/json')
    if (onExportXml) {
      try {
        const xml = await onExportXml()
        downloadText(`${vmName}.xml`, xml, 'application/xml')
        notify('Spec and domain XML downloaded')
      } catch {
        notify('Domain XML export failed')
      }
    } else if (specJson) {
      notify('Spec downloaded')
    }
  }

  const createPf = async () => {
    if (!platformVmId) return
    const hostPort = parseInt(pfHostPort, 10)
    const vmPort = parseInt(pfVmPort, 10)
    if (!Number.isFinite(hostPort) || !Number.isFinite(vmPort)) {
      notify('Enter valid port numbers')
      return
    }
    setPfBusy(true)
    try {
      await createVmPortForward(platformVmId, {
        protocol: 'tcp',
        host_port: hostPort,
        vm_port: vmPort,
        description: vmName,
      })
      notify('NAT rule created on hypervisor')
      await loadPf()
    } catch (e: unknown) {
      notify(formatUserError(e))
    } finally {
      setPfBusy(false)
    }
  }

  const removePf = async (r: VmPortForwardRule) => {
    if (!platformVmId) return
    setPfBusy(true)
    try {
      await deleteVmPortForward(platformVmId, {
        protocol: r.protocol,
        host_port: r.host_port,
        vm_port: r.vm_port,
      })
      notify('NAT rule removed')
      await loadPf()
    } catch (e: unknown) {
      notify(formatUserError(e))
    } finally {
      setPfBusy(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 space-y-4" data-testid="vm-daily-access">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Daily access</h3>
          <div className="flex flex-wrap items-center gap-2">
            {ip && (
              <span className="text-xs font-mono text-emerald-300/90">{sshUser}@{ip}</span>
            )}
            {running && !ip && guestIpWaiting && (
              <span className="text-xs text-amber-300/90 inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Waiting for guest IP…
              </span>
            )}
            <a
              href={helpGuideHref}
              target="_blank"
              rel="noreferrer"
              className={`text-xs inline-flex items-center gap-1 ${hubLinkClasses()}`}
              title="Daily access guide"
            >
              <HelpCircle className="w-3 h-3" /> Guide
            </a>
          </div>
        </div>

        {running && !ip && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-slate-300 space-y-2">
            <p>
              Guest IP not available yet. Machina reads DHCP leases, ARP, and the QEMU guest agent.
              If the agent channel is attached but IP stays empty, open <strong className="text-slate-200">VNC</strong>, confirm the VM has DHCP on its NIC, then install{' '}
              <code className="text-slate-300">qemu-guest-agent</code> and reboot.
            </p>
            {guestIpHint && <p className="text-amber-200/90">{guestIpHint}</p>}
            <div className="flex flex-wrap gap-2">
              {onRefreshGuestIp && (
                <button type="button" className="btn-secondary text-xs" onClick={onRefreshGuestIp}>
                  Refresh IP
                </button>
              )}
              {onInstallGuestTools && (
                <button
                  type="button"
                  className="btn-secondary text-xs inline-flex items-center gap-1"
                  disabled={guestToolsInstalling}
                  onClick={onInstallGuestTools}
                >
                  {guestToolsInstalling ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Install guest tools
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Connect</p>
            <div className="flex flex-wrap gap-2">
              <Link
                to={consoleHref}
                className={`btn-primary text-xs inline-flex items-center gap-1 ${!running || disabled ? 'pointer-events-none opacity-50' : ''}`}
                aria-disabled={!running || disabled}
                title={running ? 'Graphical console (noVNC)' : 'Start the VM to open VNC'}
              >
                <Monitor className="w-3.5 h-3.5" /> VNC
              </Link>
              <button
                type="button"
                className="btn-secondary text-xs inline-flex items-center gap-1"
                disabled={disabled}
                title="SSH terminal in browser"
                onClick={() => {
                  if (ip && running) openSsh(ip, sshUser)
                  else setSshOpen(true)
                }}
              >
                <Terminal className="w-3.5 h-3.5" /> SSH
              </button>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Copy</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!ip}
                onClick={() => void copy(ip, 'Guest IP copied')}
              >
                <Copy className="w-3 h-3 inline" /> IP
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!sshCommand}
                onClick={() => void copy(sshCommand, 'SSH command copied (add -i your-key if needed)')}
              >
                <Copy className="w-3 h-3 inline" /> ssh cmd
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => void copy(window.location.origin + consoleHref, 'Console URL copied')}
              >
                <Copy className="w-3 h-3 inline" /> VNC link
              </button>
            </div>
          </section>

          <section className="space-y-2 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Ports</p>
            {guestPortsLoading && <p className="text-xs text-slate-500">Loading…</p>}
            {!guestPortsLoading && !running && (
              <p className="text-xs text-slate-500">Start VM to scan guest ports.</p>
            )}
            {!guestPortsLoading && running && topPorts.length === 0 && (
              <p className="text-xs text-slate-500">
                {guestPorts && !guestPorts.agent_reachable
                  ? 'Install guest tools for port list.'
                  : 'No listening ports reported.'}
              </p>
            )}
            {!guestPortsLoading && topPorts.length > 0 && (
              <ul className="space-y-1 text-xs font-mono">
                {topPorts.map((p) => (
                  <li key={`${p.protocol}-${p.port}`} className="flex flex-wrap items-center gap-1">
                    <span className="text-slate-300">{p.port}/{p.protocol}</span>
                    {p.service_name && <span className="text-slate-500 truncate">{p.service_name}</span>}
                    <button
                      type="button"
                      className="text-sky-400 hover:underline"
                      onClick={() => void copy(ip ? `${ip}:${p.port}` : String(p.port), 'Copied')}
                    >
                      copy
                    </button>
                    {ip && HTTP_PORTS.has(p.port) && (
                      <a
                        href={`http://${ip}:${p.port}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        open <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {onRefreshPorts && (
                <button type="button" className="text-xs text-slate-400 hover:text-slate-200" onClick={onRefreshPorts}>
                  Refresh
                </button>
              )}
              {onAllPorts && (
                <button type="button" className={`text-xs inline-flex items-center gap-0.5 ${hubLinkClasses()}`} onClick={onAllPorts}>
                  All ports <ArrowRight className="w-3 h-3" />
                </button>
              )}
              {natForwardHref && ip && !platformVmId && (
                <Link to={natForwardHref} className={`text-xs inline-flex items-center gap-0.5 ${hubLinkClasses()}`}>
                  NAT rules <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            {platformVmId && ip && (
              <div className="mt-2 space-y-2 rounded-lg border border-slate-800/80 p-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Expose on hypervisor (NAT)</p>
                <div className="flex flex-wrap gap-1 items-center text-xs">
                  <span className="text-slate-500">host</span>
                  <input
                    className="input w-16 py-0.5 text-xs font-mono"
                    value={pfHostPort}
                    onChange={(e) => setPfHostPort(e.target.value)}
                    aria-label="Host port"
                  />
                  <span className="text-slate-500">→ guest</span>
                  <input
                    className="input w-14 py-0.5 text-xs font-mono"
                    value={pfVmPort}
                    onChange={(e) => setPfVmPort(e.target.value)}
                    aria-label="Guest port"
                  />
                  <button
                    type="button"
                    className="btn-secondary text-xs py-0.5"
                    disabled={pfBusy || disabled}
                    onClick={() => void createPf()}
                  >
                    Expose
                  </button>
                </div>
                {pfLoading && <p className="text-xs text-slate-500">Loading rules…</p>}
                {!pfLoading && pfRules.length > 0 && (
                  <ul className="text-xs font-mono space-y-0.5">
                    {pfRules.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-1">
                        <span className="text-slate-400">{r.host_port}→{r.vm_port}</span>
                        <button
                          type="button"
                          className="text-red-400/90 hover:underline"
                          disabled={pfBusy}
                          onClick={() => void removePf(r)}
                        >
                          remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Export</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!specJson}
                onClick={() => {
                  if (specJson) {
                    downloadText(`${vmName}-spec.json`, specJson, 'application/json')
                    notify('Spec downloaded')
                  }
                }}
              >
                <Download className="w-3 h-3 inline" /> Spec
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!onExportXml}
                onClick={() => void (async () => {
                  if (!onExportXml) return
                  try {
                    const xml = await onExportXml()
                    downloadText(`${vmName}.xml`, xml, 'application/xml')
                    notify('Domain XML downloaded')
                  } catch {
                    notify('XML export failed')
                  }
                })()}
              >
                <Download className="w-3 h-3 inline" /> XML
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!specJson && !onExportXml}
                onClick={() => void exportBundle()}
              >
                <Download className="w-3 h-3 inline" /> Both
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!specJson}
                onClick={() => specJson && void copy(specJson, 'Spec JSON copied')}
              >
                <Copy className="w-3 h-3 inline" /> Copy spec
              </button>
            </div>
          </section>
        </div>
      </div>

      <VmSshConnectDialog
        open={sshOpen}
        vmName={vmName}
        defaultIp={ip}
        defaultUser={sshUser}
        detectedIps={detectedIps.length > 0 ? detectedIps : ip ? [ip] : []}
        onClose={() => setSshOpen(false)}
        onConnect={openSsh}
      />
    </>
  )
}

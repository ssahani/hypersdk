// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  ExternalLink,
  HelpCircle,
  Loader2,
  Monitor,
  Terminal,
} from 'lucide-react'
import type { GuestPortReport } from '../../api/zeusFirewall'
import { createVmPortForward, type VmPortForwardRule } from '../../api/platform'
import { formatUserError } from '../../utils/apiError'
import VmPortForwardPanel from './VmPortForwardPanel'
import { hubLinkClasses } from '../../utils/semanticColors'
import { VM_DAILY_ACCESS_GUIDE_URL } from '../../utils/vmDailyAccessGuide'
import VmSshConnectDialog, { navigateVmSshSession } from './VmSshConnectDialog'
import type { GuestAccessHints } from '../../utils/guestAccessHints'
import {
  buildExposePayload,
  isPrivateGuestIp,
  laptopHttpHref,
  laptopSshCommand,
  natRuleForGuestPort,
  sshNatHostPort,
} from '../../utils/vmPortForwardServices'

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export interface VmConnectHubProps {
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
  platformVmId?: string
  hypervisorAddress?: string
  guestAccess?: GuestAccessHints | null
  portForwardRules?: VmPortForwardRule[]
  onRefreshPortForwards?: () => void
  guestIpWaiting?: boolean
  onRefreshGuestIp?: () => void
  onInstallGuestTools?: () => void
  guestToolsInstalling?: boolean
  guestIpHint?: string
  helpGuideHref?: string
  disabled?: boolean
  onNotify?: (message: string) => void
  /** Overview: collapse NAT panel; Access tab: show full panel. */
  natExpanded?: boolean
  onOpenAccessTab?: () => void
  showExport?: boolean
}

export default function VmConnectHub({
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
  hypervisorAddress,
  guestAccess,
  portForwardRules = [],
  onRefreshPortForwards,
  guestIpWaiting = false,
  onRefreshGuestIp,
  onInstallGuestTools,
  guestToolsInstalling = false,
  guestIpHint,
  helpGuideHref = VM_DAILY_ACCESS_GUIDE_URL,
  disabled = false,
  onNotify,
  natExpanded = false,
  onOpenAccessTab,
  showExport = false,
}: VmConnectHubProps) {
  const [sshOpen, setSshOpen] = useState(false)
  const [exposeBusy, setExposeBusy] = useState<number | null>(null)
  const [natOpen, setNatOpen] = useState(natExpanded)
  const running = vmState === 'running'
  const ip = guestIp.trim()
  const topPorts = (guestPorts?.ports ?? []).slice(0, 5)
  const privateIp = ip ? isPrivateGuestIp(ip) : Boolean(guestAccess?.guest_ip_private)
  const sshExposed = Boolean(sshNatHostPort(portForwardRules))
  const sshCommand = ip ? laptopSshCommand(sshUser, ip, hypervisorAddress, portForwardRules) : ''

  const notify = (msg: string) => onNotify?.(msg)

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      notify(label)
    } catch {
      notify('Copy failed')
    }
  }

  const openSsh = (host: string, user: string, port?: number) => {
    if (port && port !== 22) {
      const qs = new URLSearchParams({ host, user, port: String(port) })
      if (platformVmId) qs.set('vmId', platformVmId)
      if (vmName) qs.set('vmName', vmName)
      window.location.href = `/ssh?${qs.toString()}`
      return
    }
    navigateVmSshSession(vmName, host, user, platformVmId)
  }

  const exposeGuestPort = async (guestPort: number) => {
    if (!platformVmId) return
    setExposeBusy(guestPort)
    try {
      const taken = portForwardRules.map((r) => r.host_port)
      await createVmPortForward(platformVmId, buildExposePayload(vmName, guestPort, taken))
      notify(`Exposed guest port ${guestPort} on hypervisor`)
      onRefreshPortForwards?.()
    } catch (e: unknown) {
      notify(formatUserError(e))
    } finally {
      setExposeBusy(null)
    }
  }

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

  const natRuleCount = portForwardRules.length

  return (
    <>
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 space-y-4" data-testid="vm-daily-access">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Connect</h3>
          <div className="flex flex-wrap items-center gap-2">
            {ip && (
              <span className="text-xs font-mono text-emerald-300/90">
                {privateIp ? `${sshUser}@${ip} (NAT)` : `${sshUser}@${ip}`}
                {sshExposed && hypervisorAddress ? ` · SSH :${sshNatHostPort(portForwardRules)}` : ''}
              </span>
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

        {guestAccess?.guest_ip_private && (
          <div className="rounded-lg border border-sky-500/20 bg-sky-950/20 px-3 py-2 space-y-1.5" data-testid="vm-laptop-access-checklist">
            <p className="text-[10px] uppercase tracking-wider text-sky-200/80">Laptop path</p>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-2">
                {running ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Circle className="w-3 h-3 text-slate-500" />}
                <span className="text-slate-300">VM running</span>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                {ip ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Circle className="w-3 h-3 text-slate-500" />}
                <span className="text-slate-400">{ip || 'Guest IP'}</span>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                {sshExposed ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Circle className="w-3 h-3 text-slate-500" />}
                <span className="text-slate-400">{sshExposed ? 'SSH exposed' : 'Expose SSH'}</span>
              </li>
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Link
            to={consoleHref}
            className={`btn-primary text-xs inline-flex items-center gap-1 ${!running || disabled ? 'pointer-events-none opacity-50' : ''}`}
            aria-disabled={!running || disabled}
          >
            <Monitor className="w-3.5 h-3.5" /> Open Cinema
          </Link>
          <button
            type="button"
            className="btn-secondary text-xs inline-flex items-center gap-1"
            disabled={disabled}
            onClick={() => {
              if (ip && running) {
                const nat = natRuleForGuestPort(portForwardRules, 22)
                if (privateIp && nat && hypervisorAddress) openSsh(hypervisorAddress, sshUser, nat.host_port)
                else openSsh(ip, sshUser)
              } else setSshOpen(true)
            }}
          >
            <Terminal className="w-3.5 h-3.5" /> SSH
          </button>
          <button
            type="button"
            className="btn-secondary text-xs inline-flex items-center gap-1"
            disabled={!sshCommand}
            onClick={() => void copy(sshCommand, 'SSH command copied (add -i your-key if needed)')}
          >
            <Copy className="w-3 h-3" /> Copy laptop cmd
          </button>
          <button type="button" className="btn-secondary text-xs" disabled={!ip} onClick={() => void copy(ip, 'Guest IP copied')}>
            <Copy className="w-3 h-3 inline" /> IP
          </button>
        </div>

        {running && !ip && guestIpHint && (
          <p className="text-xs text-amber-200/90">{guestIpHint}</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-2 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Guest ports</p>
            {guestPortsLoading && <p className="text-xs text-slate-500">Loading…</p>}
            {!guestPortsLoading && running && topPorts.length === 0 && (
              <p className="text-xs text-slate-500">
                {guestPorts && !guestPorts.agent_reachable ? 'Install guest tools for port list.' : 'No listening ports reported.'}
              </p>
            )}
            {!guestPortsLoading && topPorts.length > 0 && (
              <ul className="space-y-1 text-xs font-mono">
                {topPorts.map((p) => {
                  const exposed = natRuleForGuestPort(portForwardRules, p.port)
                  const href = laptopHttpHref(p.port, hypervisorAddress, portForwardRules, ip)
                  return (
                    <li key={`${p.protocol}-${p.port}`} className="flex flex-wrap items-center gap-1">
                      <span className="text-slate-300">{p.port}/{p.protocol}</span>
                      {exposed ? (
                        <span className="text-emerald-400/80">{exposed.host_port}→{p.port}</span>
                      ) : platformVmId ? (
                        <button
                          type="button"
                          className="text-emerald-400 hover:underline"
                          disabled={exposeBusy === p.port}
                          data-testid={`expose-guest-port-${p.port}`}
                          onClick={() => void exposeGuestPort(p.port)}
                        >
                          {exposeBusy === p.port ? '…' : 'Expose'}
                        </button>
                      ) : null}
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline inline-flex items-center gap-0.5">
                          open <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : null}
                    </li>
                  )
                })}
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
            </div>
          </section>

          {platformVmId && (
            <section className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Hypervisor NAT</p>
                {!natExpanded && onOpenAccessTab && (
                  <button type="button" className={`text-xs ${hubLinkClasses()}`} onClick={onOpenAccessTab}>
                    Access tab →
                  </button>
                )}
              </div>
              {natExpanded || natOpen ? (
                <VmPortForwardPanel
                  platformVmId={platformVmId}
                  vmName={vmName}
                  guestIp={ip}
                  sshUser={sshUser}
                  hypervisorAddress={hypervisorAddress}
                  disabled={disabled}
                  onNotify={notify}
                />
              ) : (
                <div className="rounded-lg border border-slate-800/80 p-3 text-xs text-slate-400 space-y-2">
                  <p>{natRuleCount > 0 ? `${natRuleCount} NAT rule(s) active` : 'No NAT rules on this hypervisor yet.'}</p>
                  <button type="button" className="btn-secondary text-xs" onClick={() => setNatOpen(true)}>
                    Show expose panel
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {showExport && (
          <section className="space-y-2 border-t border-white/5 pt-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Export</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!specJson}
                onClick={() => specJson && downloadText(`${vmName}-spec.json`, specJson, 'application/json')}
              >
                <Download className="w-3 h-3 inline" /> Spec
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!onExportXml}
                onClick={() => void exportBundle()}
              >
                <Download className="w-3 h-3 inline" /> Spec + XML
              </button>
            </div>
          </section>
        )}
      </div>

      <VmSshConnectDialog
        open={sshOpen}
        vmName={vmName}
        platformVmId={platformVmId}
        defaultIp={ip}
        defaultUser={sshUser}
        detectedIps={detectedIps.length > 0 ? detectedIps : ip ? [ip] : []}
        hypervisorAddress={hypervisorAddress}
        guestIpPrivate={privateIp}
        portForwardRules={portForwardRules}
        onRefreshPortForwards={onRefreshPortForwards}
        onClose={() => setSshOpen(false)}
        onConnect={openSsh}
        onNotify={notify}
      />
    </>
  )
}

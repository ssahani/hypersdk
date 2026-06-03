// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { Terminal, X } from 'lucide-react'
import { loadVmSshPrefs, saveVmSshPrefs } from '../../utils/vmSshPrefs'
import { statusToneClass } from '../../utils/semanticColors'

export interface VmSshConnectDialogProps {
  open: boolean
  vmName: string
  defaultIp?: string
  defaultUser?: string
  detectedIps?: string[]
  onClose: () => void
  onConnect?: (host: string, user: string) => void
}

export function navigateVmSshSession(vmName: string, host: string, user: string) {
  const h = host.trim()
  const u = user.trim() || 'root'
  if (!h) return
  saveVmSshPrefs(vmName, { host: h, user: u })
  window.location.href = `/ssh?host=${encodeURIComponent(h)}&user=${encodeURIComponent(u)}`
}

export default function VmSshConnectDialog({
  open,
  vmName,
  defaultIp = '',
  defaultUser = 'root',
  detectedIps = [],
  onClose,
  onConnect,
}: VmSshConnectDialogProps) {
  const [ip, setIp] = useState(defaultIp)
  const [user, setUser] = useState(defaultUser)

  useEffect(() => {
    if (!open) return
    const prefs = loadVmSshPrefs(vmName)
    const fromGuest = defaultIp.trim() || detectedIps[0]?.trim() || ''
    setIp(fromGuest || prefs?.host?.trim() || '')
    setUser(defaultUser.trim() || prefs?.user?.trim() || 'root')
  }, [open, vmName, defaultIp, defaultUser, detectedIps])

  if (!open) return null

  const connect = () => {
    const h = ip.trim()
    const u = user.trim() || 'root'
    if (!h) return
    if (onConnect) onConnect(h, u)
    else navigateVmSshSession(vmName, h, u)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
          <span className="text-lg font-semibold flex items-center gap-2">
            <Terminal className={`w-5 h-5 ${statusToneClass('ok')}`} /> SSH — {vmName}
          </span>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-700 rounded transition" aria-label="Close">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <label htmlFor="vm-ssh-ip" className="block text-sm text-slate-400 mb-1">
            Guest IP (guest agent first; edit if needed)
          </label>
          <input
            id="vm-ssh-ip"
            type="text"
            autoFocus
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="192.168.122.100"
            className="input w-full"
            onKeyDown={(e) => { if (e.key === 'Enter' && ip.trim()) connect() }}
          />
          <label htmlFor="vm-ssh-user" className="block text-sm text-slate-400 mb-1 mt-3">
            SSH user
          </label>
          <input
            id="vm-ssh-user"
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="ubuntu"
            className="input w-full"
            autoComplete="username"
          />
          {detectedIps.length > 0 && (
            <div>
              <span className="text-xs text-slate-500">Detected IPs:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {detectedIps.map((addr) => (
                  <button
                    key={addr}
                    type="button"
                    onClick={() => setIp(addr)}
                    className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono hover:bg-slate-700 transition text-sky-300"
                  >
                    {addr}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Opens an in-browser SSH terminal (port 22). Use the private key matching your cloud-init public key.
          </p>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="button" onClick={connect} disabled={!ip.trim()} className="btn-primary text-sm">
            Connect
          </button>
        </div>
      </div>
    </div>
  )
}

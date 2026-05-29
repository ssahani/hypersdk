// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import SimpleCreateVmWizard, { sizeToSpec } from './SimpleCreateVmWizard'

interface WindowsCreateWizardProps {
  open: boolean
  onClose: () => void
  onCreate: (payload: {
    name: string
    os: string
    size: string
    network: string
    windows: { virtio: boolean; uefi: boolean; tpm: boolean; secureBoot: boolean; rdp: boolean }
  }) => Promise<void>
}

export default function WindowsCreateWizard({ open, onClose, onCreate }: WindowsCreateWizardProps) {
  const [mode, setMode] = useState<'simple' | 'windows'>('windows')
  const [name, setName] = useState('win-server-01')
  const [template, setTemplate] = useState('windows-server-2022')
  const [size, setSize] = useState('large')
  const [network, setNetwork] = useState('default')
  const [virtio, setVirtio] = useState(true)
  const [uefi, setUefi] = useState(true)
  const [tpm, setTpm] = useState(true)
  const [secureBoot, setSecureBoot] = useState(true)
  const [rdp, setRdp] = useState(true)
  const [busy, setBusy] = useState(false)
  const [advanced, setAdvanced] = useState(false)

  if (!open) return null

  if (mode === 'simple') {
    return (
      <SimpleCreateVmWizard
        open={open}
        onClose={onClose}
        onCreate={async (p) => onCreate({ ...p, windows: { virtio: false, uefi: false, tpm: false, secureBoot: false, rdp: false } })}
      />
    )
  }

  const submit = async () => {
    setBusy(true)
    try {
      await onCreate({ name, os: template, size, network, windows: { virtio, uefi, tpm, secureBoot, rdp } })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-800">
          <h2 className="text-xl font-semibold">Create Windows VM</h2>
          <p className="text-sm text-slate-400 mt-1">VirtIO, UEFI, TPM, and RDP — configured for you.</p>
        </div>
        <div className="p-6 space-y-4">
          <label className="block text-sm">Name<input className="input w-full mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block text-sm">Template
            <select className="input w-full mt-1" value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="windows-server-2022">Windows Server 2022</option>
              <option value="windows-server-2025">Windows Server 2025</option>
              <option value="windows-11">Windows 11</option>
              <option value="custom-iso">Custom ISO</option>
            </select>
          </label>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={virtio} onChange={(e) => setVirtio(e.target.checked)} /> Attach VirtIO driver ISO</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={uefi} onChange={(e) => setUefi(e.target.checked)} /> Enable UEFI</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={tpm} onChange={(e) => setTpm(e.target.checked)} /> Add TPM</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={secureBoot} onChange={(e) => setSecureBoot(e.target.checked)} /> Secure Boot</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={rdp} onChange={(e) => setRdp(e.target.checked)} /> Enable RDP after install</label>
          </div>
          <button type="button" className="flex items-center gap-1 text-xs text-slate-400" onClick={() => setAdvanced((a) => !a)}>
            {advanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Size & network
          </button>
          {advanced && (
            <div className="space-y-2">
              <select className="input w-full" value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="medium">Medium (4 vCPU · 8 GiB)</option>
                <option value="large">Large (8 vCPU · 16 GiB)</option>
              </select>
              <select className="input w-full" value={network} onChange={(e) => setNetwork(e.target.value)}>
                <option value="default">Default network</option>
                <option value="prod">Production VLAN</option>
              </select>
            </div>
          )}
          <button type="button" className="text-xs text-blue-400" onClick={() => setMode('simple')}>Switch to Linux/simple wizard</button>
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit()}>Create</button>
        </div>
      </div>
    </div>
  )
}

export { sizeToSpec }

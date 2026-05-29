// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export interface VmWizardInitial {
  name?: string
  os?: string
  size?: string
  network?: string
}

interface SimpleCreateVmWizardProps {
  open: boolean
  onClose: () => void
  onCreate: (payload: { name: string; os: string; size: string; network: string }) => Promise<void>
  initial?: VmWizardInitial
}

const SIZES = [
  { id: 'small', label: 'Small', detail: '2 vCPU · 4 GiB · 40 GiB' },
  { id: 'medium', label: 'Medium', detail: '4 vCPU · 8 GiB · 80 GiB' },
  { id: 'large', label: 'Large', detail: '8 vCPU · 16 GiB · 160 GiB' },
]

export default function SimpleCreateVmWizard({ open, onClose, onCreate, initial }: SimpleCreateVmWizardProps) {
  const [name, setName] = useState('new-vm')
  const [os, setOs] = useState('ubuntu-24.04')
  const [size, setSize] = useState('medium')
  const [network, setNetwork] = useState('default')
  const [advanced, setAdvanced] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial?.name) setName(initial.name)
    if (initial?.os) setOs(initial.os)
    if (initial?.size) setSize(initial.size)
    if (initial?.network) setNetwork(initial.network)
  }, [open, initial])

  if (!open) return null

  const submit = async () => {
    setBusy(true)
    try {
      await onCreate({ name, os, size, network })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-800">
          <h2 className="text-xl font-semibold">Create Virtual Machine</h2>
          <p className="text-sm text-slate-400 mt-1">Choose OS, size, and network — no libvirt details required.</p>
        </div>
        <div className="p-6 space-y-4">
          <label className="block text-sm">
            Name
            <input className="input w-full mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm">
            Operating system
            <select className="input w-full mt-1" value={os} onChange={(e) => setOs(e.target.value)}>
              <option value="ubuntu-24.04">Ubuntu 24.04 LTS</option>
              <option value="debian-12">Debian 12</option>
              <option value="rocky-9">Rocky Linux 9</option>
              <option value="windows-server-2022">Windows Server 2022</option>
              <option value="custom-iso">Custom ISO</option>
            </select>
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm text-slate-300">Size</legend>
            {SIZES.map((s) => (
              <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${size === s.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-800 hover:border-slate-700'}`}>
                <input type="radio" name="size" checked={size === s.id} onChange={() => setSize(s.id)} />
                <span><span className="font-medium">{s.label}</span> <span className="text-xs text-slate-500">{s.detail}</span></span>
              </label>
            ))}
          </fieldset>
          <label className="block text-sm">
            Network
            <select className="input w-full mt-1" value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="default">Default network (DHCP)</option>
              <option value="prod">Production VLAN</option>
              <option value="isolated">Isolated lab</option>
            </select>
          </label>
          <button type="button" className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200" onClick={() => setAdvanced((a) => !a)}>
            {advanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Pro view — CPU topology, NUMA, firmware, TPM…
          </button>
          {advanced && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-500 space-y-1">
              <p>Advanced placement, virtio model, cloud-init, anti-affinity, and backup policy are available on the VM detail page after creation.</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={busy || !name.trim()} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function sizeToSpec(size: string) {
  switch (size) {
    case 'small':
      return { cores: 2, memory: '4Gi', disk: '40Gi' }
    case 'large':
      return { cores: 8, memory: '16Gi', disk: '160Gi' }
    default:
      return { cores: 4, memory: '8Gi', disk: '80Gi' }
  }
}

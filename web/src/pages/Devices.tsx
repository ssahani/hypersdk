// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useState, useCallback } from 'react'
import { listDevices, getDeviceXml, NodeDeviceInfo } from '../api/advanced'
import { useToastContext } from '../contexts/ToastContext'
import { RefreshCw, Usb, Code, X } from 'lucide-react'
import { formatUserError } from '../utils/apiError'

export default function DevicesPage() {
  const [devices, setDevices] = useState<NodeDeviceInfo[]>([])
  const [filtered, setFiltered] = useState<NodeDeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [capFilter, setCapFilter] = useState('')
  const [xmlContent, setXmlContent] = useState<string | null>(null)
  const [xmlName, setXmlName] = useState('')
  const toast = useToastContext()

  const load = useCallback(async () => {
    try {
      const devs = await listDevices()
      setDevices(devs)
      setFiltered(devs)
    } catch (e: unknown) {
      toast.error(`${formatUserError(e)}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!capFilter) {
      setFiltered(devices)
    } else {
      setFiltered(devices.filter((d) => d.capability_type === capFilter))
    }
  }, [capFilter, devices])

  const capTypes = [...new Set(devices.map((d) => d.capability_type).filter(Boolean))].sort()

  const showXml = async (name: string) => {
    try {
      const xml = await getDeviceXml(name)
      setXmlContent(xml)
      setXmlName(name)
    } catch (e: unknown) {
      toast.error(`${formatUserError(e)}`)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Usb className="w-6 h-6" /> Node Devices</h1>
        <div className="flex items-center gap-3">
          <select value={capFilter} onChange={(e) => setCapFilter(e.target.value)} className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm">
            <option value="">All types</option>
            {capTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={load} className="p-2 hover:bg-slate-700 rounded transition"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {filtered.length === 0 ? <div className="p-8 text-center text-slate-500">No devices found.</div> : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">Name</th><th className="px-6 py-3">Capability</th><th className="px-6 py-3 hidden md:table-cell">Driver</th><th className="px-6 py-3 hidden md:table-cell">Parent</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map((dev) => (
                <tr key={dev.name} className="hover:bg-slate-700/50">
                  <td className="px-6 py-3 font-medium font-mono text-sm">{dev.name}</td>
                  <td className="px-6 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">{dev.capability_type}</span></td>
                  <td className="px-6 py-3 hidden md:table-cell text-sm text-slate-400">{dev.driver || '-'}</td>
                  <td className="px-6 py-3 hidden md:table-cell text-sm text-slate-400 font-mono">{dev.parent || '-'}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => showXml(dev.name)} className="p-1.5 hover:bg-blue-600/20 rounded transition" title="View XML"><Code className="w-4 h-4 text-blue-400" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {xmlContent !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setXmlContent(null)}>
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <span className="text-lg font-semibold font-mono">{xmlName}</span>
              <button onClick={() => setXmlContent(null)} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <pre className="p-5 text-sm text-slate-300 overflow-auto whitespace-pre-wrap font-mono flex-1">{xmlContent}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

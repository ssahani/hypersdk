// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export type VmDetailTab =
  | 'overview'
  | 'doctor'
  | 'console'
  | 'performance'
  | 'disks'
  | 'network'
  | 'security'
  | 'snapshots'
  | 'backup'
  | 'events'
  | 'settings'

const TABS: { id: VmDetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'doctor', label: 'Doctor' },
  { id: 'console', label: 'Console' },
  { id: 'performance', label: 'Performance' },
  { id: 'disks', label: 'Disks' },
  { id: 'network', label: 'Network' },
  { id: 'security', label: 'Security' },
  { id: 'snapshots', label: 'Snapshots' },
  { id: 'backup', label: 'Backup' },
  { id: 'events', label: 'Events' },
  { id: 'settings', label: 'Settings' },
]

interface VmDetailTabsProps {
  active: VmDetailTab
  onChange: (tab: VmDetailTab) => void
}

export default function VmDetailTabs({ active, onChange }: VmDetailTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-800 pb-px -mx-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm whitespace-nowrap rounded-t-lg transition-colors ${
            active === tab.id
              ? 'bg-slate-800/80 text-white font-medium border-b-2 border-blue-500 -mb-px'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

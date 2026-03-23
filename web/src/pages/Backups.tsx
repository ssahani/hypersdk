import { useEffect, useState, useCallback } from 'react'
import {
  fetchBackups, triggerBackup, restoreBackup, deleteBackup, verifyBackup,
  getSchedule, setSchedule, downloadBackupUrl,
  BackupInfo, BackupRequest, VerifyResult, ScheduleInfo,
} from '../api/backup'
import { listVMs, VmInfo } from '../api/vm'
import { useToastContext } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  Archive, Trash2, RotateCcw, RefreshCw, Play, HardDrive, Server,
  Download, ShieldCheck, Clock, ToggleLeft, ToggleRight, CheckCircle,
  XCircle, AlertCircle, Loader2, Layers,
} from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle className="w-3 h-3" /> Done</span>
    case 'running':
      return <span className="flex items-center gap-1 text-blue-400 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Running</span>
    case 'failed':
      return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3 h-3" /> Failed</span>
    default:
      return <span className="flex items-center gap-1 text-gray-400 text-xs"><AlertCircle className="w-3 h-3" /> {status}</span>
  }
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [vms, setVms] = useState<VmInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BackupInfo | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [schedule, setScheduleState] = useState<ScheduleInfo | null>(null)
  const toast = useToastContext()

  // Backup form state
  const [vmName, setVmName] = useState('')
  const [withDisks, setWithDisks] = useState(false)
  const [incremental, setIncremental] = useState(false)
  const [nfsTarget, setNfsTarget] = useState('')
  const [retain, setRetain] = useState(7)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    try {
      const [b, v, s] = await Promise.all([fetchBackups(), listVMs(), getSchedule()])
      setBackups(b)
      setVms(v)
      setScheduleState(s)
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  // Auto-refresh while any backup is running
  useEffect(() => {
    const hasRunning = backups.some(b => b.status === 'running')
    if (!hasRunning) return
    const interval = setInterval(() => load(), 3000)
    return () => clearInterval(interval)
  }, [backups, load])

  const handleBackup = async () => {
    setRunning(true)
    try {
      const req: BackupRequest = { with_disks: withDisks, retain, incremental }
      if (vmName) req.vm_name = vmName
      if (nfsTarget) req.nfs_target = nfsTarget
      const result = await triggerBackup(req)
      toast.success(`Backup started: ${result.backup_id}`)
      setShowForm(false)
      setTimeout(() => load(), 2000)
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    } finally {
      setRunning(false)
    }
  }

  const handleRestore = async () => {
    if (!restoreTarget) return
    try {
      await restoreBackup({ backup_id: restoreTarget.id })
      toast.success(`Restore started from '${restoreTarget.id}'`)
      load()
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
    setRestoreTarget(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteBackup(deleteTarget.id)
      toast.success(`Deleted backup '${deleteTarget.id}'`)
      load()
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
    setDeleteTarget(null)
  }

  const handleVerify = async (b: BackupInfo) => {
    setVerifying(b.id)
    try {
      const result = await verifyBackup(b.id)
      setVerifyResult(result)
      if (result.verified) {
        toast.success(`Backup '${b.id}' verified: ${result.files_ok} files OK`)
      } else {
        toast.error(`Backup '${b.id}' verification failed: ${result.files_failed} files`)
      }
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    } finally {
      setVerifying(null)
    }
  }

  const handleToggleSchedule = async () => {
    if (!schedule) return
    try {
      await setSchedule(!schedule.enabled)
      toast.success(schedule.enabled ? 'Backup timer disabled' : 'Backup timer enabled')
      load()
    } catch (e: unknown) {
      toast.error(`${e instanceof Error ? e.message : e}`)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Archive className="w-6 h-6" /> Backups</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 hover:bg-gray-700 rounded transition" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg transition-all text-sm font-medium shadow-lg shadow-blue-600/20"
          >
            <Play className="w-4 h-4" />
            New Backup
          </button>
        </div>
      </div>

      {/* Schedule card */}
      {schedule && schedule.installed && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <span className="text-sm font-medium">Scheduled Backup</span>
              <span className="text-xs text-gray-400 ml-2">Daily at 2:00 AM</span>
              {schedule.next_run && schedule.enabled && (
                <span className="text-xs text-gray-500 ml-2">Next: {schedule.next_run}</span>
              )}
            </div>
          </div>
          <button onClick={handleToggleSchedule} className="flex items-center gap-2 text-sm" title={schedule.enabled ? 'Disable timer' : 'Enable timer'}>
            {schedule.enabled ? (
              <><ToggleRight className="w-6 h-6 text-green-400" /> <span className="text-green-400">Enabled</span></>
            ) : (
              <><ToggleLeft className="w-6 h-6 text-gray-500" /> <span className="text-gray-500">Disabled</span></>
            )}
          </button>
        </div>
      )}

      {/* Backup form */}
      {showForm && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Create Backup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">VM (leave empty for all)</label>
              <select
                value={vmName}
                onChange={(e) => setVmName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">All VMs</option>
                {vms.map((vm) => (
                  <option key={vm.name} value={vm.name}>{vm.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">NFS Target (optional)</label>
              <input
                type="text"
                value={nfsTarget}
                onChange={(e) => setNfsTarget(e.target.value)}
                placeholder="192.168.1.100:/backups"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Retention (keep last N)</label>
              <input
                type="number"
                value={retain}
                onChange={(e) => setRetain(parseInt(e.target.value) || 0)}
                min={0}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={withDisks}
                  onChange={(e) => { setWithDisks(e.target.checked); if (!e.target.checked) setIncremental(false) }}
                  className="w-4 h-4 rounded bg-gray-900 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Include disk images</span>
                {withDisks && <span className="text-xs text-yellow-400">May be very large</span>}
              </label>
              {withDisks && (
                <label className="flex items-center gap-2 cursor-pointer ml-6">
                  <input
                    type="checkbox"
                    checked={incremental}
                    onChange={(e) => setIncremental(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-900 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm flex items-center gap-1"><Layers className="w-3 h-3" /> Incremental (hardlink unchanged)</span>
                </label>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">Cancel</button>
            <button
              onClick={handleBackup}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition text-sm font-medium"
            >
              {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? 'Running...' : 'Start Backup'}
            </button>
          </div>
        </div>
      )}

      {/* Backup list */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {backups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No backups found. Create one to get started.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                <th className="px-4 py-3">Backup ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3 hidden md:table-cell">VMs</th>
                <th className="px-4 py-3 hidden lg:table-cell">Target</th>
                <th className="px-4 py-3">Disks</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {backups.map((b) => (
                <tr key={b.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium font-mono text-sm">{b.id}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                    {b.status === 'running' && b.progress !== '' && (
                      <div className="mt-1 w-20 bg-gray-700 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${parseInt(b.progress) || 0}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {b.vm_filter === 'all' ? (
                      <span className="flex items-center gap-1 text-blue-400"><Server className="w-3 h-3" /> All</span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-400"><Server className="w-3 h-3" /> {b.vm_filter}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell">{b.vm_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-400 hidden lg:table-cell">
                    {b.nfs_target === 'local' ? 'Local' : b.nfs_target}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {b.with_disks ? (
                      <span className="flex items-center gap-1 text-yellow-400"><HardDrive className="w-3 h-3" /> Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{b.size}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {b.has_checksums && (
                        <button
                          onClick={() => handleVerify(b)}
                          disabled={verifying === b.id}
                          className="p-1.5 hover:bg-green-600/20 rounded transition"
                          title="Verify checksums"
                        >
                          {verifying === b.id ? (
                            <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-4 h-4 text-green-400" />
                          )}
                        </button>
                      )}
                      <a
                        href={downloadBackupUrl(b.id)}
                        className="p-1.5 hover:bg-cyan-600/20 rounded transition"
                        title="Download as tar.gz"
                      >
                        <Download className="w-4 h-4 text-cyan-400" />
                      </a>
                      <button onClick={() => setRestoreTarget(b)} className="p-1.5 hover:bg-blue-600/20 rounded transition" title="Restore">
                        <RotateCcw className="w-4 h-4 text-blue-400" />
                      </button>
                      <button onClick={() => setDeleteTarget(b)} className="p-1.5 hover:bg-red-600/20 rounded transition" title="Delete">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Verify result dialog */}
      {verifyResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setVerifyResult(null)}>
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {verifyResult.verified ? (
                <><CheckCircle className="w-5 h-5 text-green-400" /> Verification Passed</>
              ) : (
                <><XCircle className="w-5 h-5 text-red-400" /> Verification Failed</>
              )}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Backup</span><span className="font-mono">{verifyResult.backup_id}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Files checked</span><span>{verifyResult.files_checked}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">OK</span><span className="text-green-400">{verifyResult.files_ok}</span></div>
              {verifyResult.files_failed > 0 && (
                <>
                  <div className="flex justify-between"><span className="text-gray-400">Failed</span><span className="text-red-400">{verifyResult.files_failed}</span></div>
                  <div className="mt-2 bg-gray-900 rounded p-2 text-xs font-mono text-red-300 max-h-32 overflow-y-auto">
                    {verifyResult.failed_files.map((f, i) => <div key={i}>{f}</div>)}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setVerifyResult(null)} className="mt-4 w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">Close</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Backup"
        message={`Delete backup '${deleteTarget?.id}'? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={!!restoreTarget}
        title="Restore Backup"
        message={`Restore VM/network/pool definitions from backup '${restoreTarget?.id}'? Existing definitions with the same name will be updated.`}
        confirmLabel="Restore"
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  )
}

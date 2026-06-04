// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Webhook, Plus } from 'lucide-react'
import PlatformPageChrome, { PlatformRefreshButton } from '../../components/platform/PlatformPageChrome'
import {
  createWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  listWebhooks,
  purgeWebhookDeliveries,
  retryWebhookDelivery,
  toggleWebhook,
  type WebhookDeliveryRow,
  type WebhookRow,
} from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'
import { hostStateTone, httpStatusTone, migrationReadinessTone, riskTone, statusBadgeClasses, statusPillClasses, statusToneClass, taskStatusTone, webhookDeliveryTone } from '../../utils/semanticColors'

export default function PlatformWebhooks({ embedded }: { embedded?: boolean } = {}) {
  const toast = useToastContext()
  const [rows, setRows] = useState<WebhookRow[]>([])
  const [deliveries, setDeliveries] = useState<WebhookDeliveryRow[]>([])
  const [deliveryFilter, setDeliveryFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState('https://example.com/hook')

  const testWebhooks = rows.filter(
    (w) => w.url.includes('127.0.0.1:19876') || w.url.endsWith('/e2e'),
  )
  const failedCount = deliveries.filter((d) => d.status === 'failed').length

  const load = useCallback(async () => {
    setError(null)
    try {
      const [hooks, dels] = await Promise.all([
        listWebhooks(),
        listWebhookDeliveries(deliveryFilter || undefined),
      ])
      setRows(hooks)
      setDeliveries(dels)
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [deliveryFilter])

  useEffect(() => { void load() }, [load])

  return (
    <PlatformPageChrome
      hideHeader={embedded}
      compact={embedded}
      error={error}
      onErrorRetry={() => void load()}
      title={embedded ? undefined : 'Webhooks'}
      subtitle={embedded ? undefined : 'Event notifications'}
      icon={embedded ? undefined : <Webhook className="w-6 h-6 text-slate-400" />}
      actions={embedded ? undefined : <PlatformRefreshButton onClick={() => void load()} />}
      contentClassName="space-y-4"
    >
      {testWebhooks.length > 0 && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-100">
          <p className="font-medium">E2E test webhooks detected</p>
          <p className="text-xs mt-1 text-amber-200/80">
            These point at <span className="font-mono">127.0.0.1:19876</span> on the controller host — nothing listens there, so
            deliveries fail. Remove them unless you are actively running the E2E receiver.
          </p>
          <button
            type="button"
            className="btn-secondary text-xs mt-2"
            onClick={async () => {
              try {
                for (const w of testWebhooks) await deleteWebhook(w.id)
                toast.success(`Removed ${testWebhooks.length} test webhook(s)`)
                await load()
              } catch (e: unknown) {
                toast.error(formatUserError(e))
              }
            }}
          >
            Remove test webhooks
          </button>
        </div>
      )}
      <div className="card p-4 flex gap-3">
        <input className="input flex-1" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="button" className="btn-primary flex items-center gap-2" onClick={async () => {
          try { await createWebhook({ url, events: ['vm.create', 'vm.delete', 'ha.recover'] }); toast.success('Webhook added'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) }
        }}><Plus className="w-4 h-4" /> Add</button>
      </div>
      <ul className="card p-4 space-y-2 text-sm">{rows.map((w) => (
        <li key={w.id} className="flex justify-between gap-2 text-slate-400">
          <span><span className={statusToneClass(w.enabled ? 'ok' : 'neutral')}>{w.enabled ? 'on' : 'off'}</span> {w.url}</span>
          <span className="flex gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={async () => { try { await toggleWebhook(w.id); await load() } catch (e: unknown) { toast.error(formatUserError(e)) } }}>Toggle</button>
            <button type="button" className="btn-secondary text-xs" onClick={async () => { try { await deleteWebhook(w.id); await load() } catch (e: unknown) { toast.error(formatUserError(e)) } }}>Delete</button>
          </span>
        </li>
      ))}</ul>
      <section className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Recent deliveries</h2>
          {failedCount > 0 && (
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={async () => {
                try {
                  const r = await purgeWebhookDeliveries({ status: 'failed' })
                  toast.success(`Cleared ${r.deleted} failed delivery(ies)`)
                  await load()
                } catch (e: unknown) {
                  toast.error(formatUserError(e))
                }
              }}
            >
              Clear failed ({failedCount})
            </button>
          )}
          <select className="input text-sm w-auto" value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <ul className="space-y-2 text-xs">
          {deliveries.map((d) => (
            <li key={d.id} className="border-b border-slate-800 pb-2 text-slate-400">
              <div className="flex justify-between gap-2">
                <span>{d.event_kind} → {d.url}</span>
                <span className={statusToneClass(webhookDeliveryTone(d.status))}>
                  {d.status} ({d.attempts}/{d.max_attempts})
                </span>
              </div>
              {d.last_error && <p className={`${statusToneClass('error')} opacity-80 mt-1 truncate`}>{d.last_error}</p>}
              {(d.status === 'failed' || d.status === 'pending') && (
                <button type="button" className="btn-secondary text-xs mt-1" onClick={async () => {
                  try { await retryWebhookDelivery(d.id); toast.success('Retry queued'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) }
                }}>Retry</button>
              )}
            </li>
          ))}
          {deliveries.length === 0 && <li className="text-slate-500">No deliveries yet.</li>}
        </ul>
      </section>
    </PlatformPageChrome>
  )
}

// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch } from './platform'
import { readJsonObject } from './client'

const DAEMON_API = '/api/v1'

export interface GuestkitStatus {
  enabled: boolean
  base_url: string
  insecure_tls: boolean
  reachable: boolean
  last_error?: string
  library?: string
}

export interface GuestkitDoctorReport {
  image_path: string
  target: string
  boot_score: number
  confidence: number
  summary: string
  blockers: string[]
  warnings: string[]
  checks_passed: number
  checks_total: number
  root_cause?: string
}

export interface GuestkitMigratePlanReport {
  image_path: string
  target: string
  migration_score: number
  boot_score: number
  estimated_downtime_minutes: number
  driver_injections: string[]
  required_changes: string[]
  licensing_warnings: string[]
  summary: string
}

export const getGuestkitDaemonStatus = () =>
  readJsonObject<GuestkitStatus>(`${DAEMON_API}/guestkit/status`)

export const getGuestkitStatus = () => platformFetch<GuestkitStatus & { library_version: string; worker_url: string; worker_reachable: boolean; summary: string }>(
  '/api/v1/guestkit/status',
)

export const guestkitDoctor = (image_path: string, target = 'kvm', explain = false) =>
  platformFetch<GuestkitDoctorReport>('/api/v1/guestkit/doctor', {
    method: 'POST',
    body: JSON.stringify({ image_path, target, explain }),
  })

export const guestkitMigratePlan = (image_path: string, target = 'kvm') =>
  platformFetch<GuestkitMigratePlanReport>('/api/v1/guestkit/migrate-plan', {
    method: 'POST',
    body: JSON.stringify({ image_path, target }),
  })

export const guestkitVmDoctor = (vmId: string, target = 'kvm', explain = false) => {
  const q = new URLSearchParams({ target })
  if (explain) q.set('explain', 'true')
  return platformFetch<GuestkitDoctorReport>(`/api/v1/guestkit/vms/${vmId}/doctor?${q}`)
}

export const submitGuestkitInspectJob = (image_path: string, name = 'machina-inspect') =>
  platformFetch<{ job_id: string; status: string; summary: string }>('/api/v1/guestkit/jobs', {
    method: 'POST',
    body: JSON.stringify({ image_path, name }),
  })

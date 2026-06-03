// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Per-VM backup + snapshot timeline (Time Machine).

import { platformFetch } from './platform'

export type VmTimelineEntry = {
  kind: 'backup' | 'snapshot' | string
  id: string
  label: string
  status: string
  created_at: string
}

export const listVmTimeline = (vmId: string) =>
  platformFetch<VmTimelineEntry[]>(`/api/v1/vms/${vmId}/timeline`)

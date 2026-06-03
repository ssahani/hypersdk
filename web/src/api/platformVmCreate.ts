// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch } from './platform'

export type CreatePlatformVmBody = {
  api_version: string
  kind: string
  metadata: { name: string; project?: string; labels?: Record<string, string> }
  spec: Record<string, unknown>
  host_id?: string
  tags?: string[]
  desired_state?: string
}

export const createPlatformVm = (body: unknown) =>
  platformFetch<{ task_id: string }>('/api/v1/vms', { method: 'POST', body: JSON.stringify(body) })

export type CreateFromIsoBody = {
  name: string
  iso_path: string
  memory?: string
  disk_gib?: number
  host_id?: string
  desired_state?: string
  cloud_init_user?: string
  cloud_init_password?: string
  cloud_init_ssh_pubkey?: string
}

export const createVmFromIso = (body: CreateFromIsoBody) =>
  platformFetch<{ task_id: string }>('/api/v1/vms/from-iso', {
    method: 'POST',
    body: JSON.stringify(body),
  })

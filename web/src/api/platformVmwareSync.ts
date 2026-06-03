// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch } from './platform'

export const syncVmwareInventory = () =>
  platformFetch<{
    synced: boolean
    imported: number
    message: string
    scope: string
    migration_advisor: string
  }>('/api/v1/vmware/sync', { method: 'POST', body: '{}' })

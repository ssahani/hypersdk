// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch } from './platform'

export const syncProxmoxInventory = () =>
  platformFetch<{ synced: boolean; imported: number; message: string; scope: string }>(
    '/api/v1/proxmox/sync',
    { method: 'POST', body: '{}' },
  )

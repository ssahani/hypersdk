// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Controller inventory sync (distinct from daemon `kubevirt.ts` export bundles).

import { platformFetch } from './platform'

export const syncKubevirtInventory = () =>
  platformFetch<{ synced: boolean; cluster_id?: string; message: string }>('/api/v1/kubevirt/sync', {
    method: 'POST',
    body: '{}',
  })

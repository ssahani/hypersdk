// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Live migration with bandwidth and postcopy options.

import { platformFetch } from './platform'

export type VmMigrateOptions = {
  dest_host_id: string
  live?: boolean
  bandwidth_mib?: number
  postcopy?: boolean
  undefine_source?: boolean
  tunnelled?: boolean
}

export const vmMigrate = (id: string, opts: VmMigrateOptions) =>
  platformFetch<{ task_id: string }>(`/api/v1/vms/${id}/migrate`, {
    method: 'POST',
    body: JSON.stringify({
      dest_host_id: opts.dest_host_id,
      live: opts.live ?? true,
      bandwidth_mib: opts.bandwidth_mib,
      postcopy: opts.postcopy ?? false,
      undefine_source: opts.undefine_source ?? false,
      tunnelled: opts.tunnelled ?? false,
    }),
  })

// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch } from './platform'

export type CloudInitValidation = {
  valid: boolean
  issues: string[]
  preview_hostname?: string | null
}

export const validateCloudInit = (user_data: string) =>
  platformFetch<CloudInitValidation>('/api/v1/cloud-init/validate', {
    method: 'POST',
    body: JSON.stringify({ user_data }),
  })

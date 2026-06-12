// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch } from './platform'

export interface LaunchpadBackend {
  kind: string
  name: string
  port: number
  scheme: string
  path: string
}

export interface LaunchpadVisibility {
  published: boolean
  hidden: boolean
  favorite: boolean
}

export interface LaunchpadApp {
  id: string
  slug: string
  canonicalSlug?: string
  displayName: string
  description?: string
  namespace: string
  category: string
  icon: string
  backend: LaunchpadBackend
  routePath: string
  publicUrl: string
  status: string
  statusMessage?: string
  source: string
  authMode: string
  score: number
  visibility: LaunchpadVisibility
  readyEndpoints: number
  updatedAt: string
  meta?: {
    environment?: string
    owner?: string
    dependsOn?: string[]
    recommended?: boolean
  }
}

export interface LaunchpadSearchHit {
  app: LaunchpadApp
  score: number
}

export interface LaunchpadHealthSummary {
  total: number
  healthy: number
  degraded: number
  broken: number
  apps: LaunchpadApp[]
}

export interface LaunchpadConfig {
  publicBase: string
  pathPrefix: string
  enabled: boolean
}

let cachedConfig: LaunchpadConfig | null = null

export async function getLaunchpadConfig(): Promise<LaunchpadConfig> {
  if (cachedConfig) return cachedConfig
  const cfg = await platformFetch<LaunchpadConfig>('/api/v1/launchpad/config')
  cachedConfig = {
    publicBase: cfg.publicBase ?? '',
    pathPrefix: cfg.pathPrefix ?? '/launchpad',
    enabled: cfg.enabled ?? true,
  }
  return cachedConfig
}

export const listLaunchpadApps = () => platformFetch<LaunchpadApp[]>('/api/v1/launchpad/apps')
export const listLaunchpadCatalog = () => platformFetch<LaunchpadApp[]>('/api/v1/launchpad/catalog')
export const listLaunchpadFavorites = () => platformFetch<LaunchpadApp[]>('/api/v1/launchpad/favorites')
export const launchpadHealthSummary = () => platformFetch<LaunchpadHealthSummary>('/api/v1/launchpad/health/apps')
export const searchLaunchpad = (q: string) =>
  platformFetch<LaunchpadSearchHit[]>(`/api/v1/launchpad/search?q=${encodeURIComponent(q)}&limit=20`)

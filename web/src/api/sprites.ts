// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { readJsonArray, apiGet, apiPost, apiDelete } from './client'

const API = '/api/v1'

export type SpriteState = 'booting' | 'running' | 'reaping' | 'gone'
export type SpriteBackend = 'libvirt' | 'cloudhypervisor'

export interface SpriteHandle {
  sprite_id: string
  state: SpriteState
  /** RFC3339 */
  created_at: string
  /** RFC3339 */
  expires_at: string
  vsock_cid?: number
  backend: SpriteBackend
  /** Attached to the host's "default" NAT network (virbr0) for outbound-only internet access. */
  network_egress: boolean
}

export interface SpriteCreateRequest {
  golden_image: string
  vcpus?: number
  memory_mb?: number
  ttl_seconds?: number
  backend?: SpriteBackend
  network_egress?: boolean
}

export const listSprites = () => readJsonArray<SpriteHandle>(`${API}/sprites`)
export const getSprite = (id: string) => apiGet<SpriteHandle>(`${API}/sprites/${encodeURIComponent(id)}`)
export const createSprite = (body: SpriteCreateRequest) => apiPost<SpriteHandle>(`${API}/sprites`, body)
export const deleteSprite = (id: string) => apiDelete(`${API}/sprites/${encodeURIComponent(id)}`)

/** Golden-image registry keys available to boot a sprite from (bare names, no `.qcow2`). */
export const listSpriteGoldenImages = () => readJsonArray<string>(`${API}/sprites/golden-images`)

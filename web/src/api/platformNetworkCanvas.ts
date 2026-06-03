// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Fleet network canvas — topology + PacketWolf flows.

import { platformFetch, type TopologyGraph } from './platform'

export type PacketWolfFlow = {
  host_id?: string
  verdict?: string
  process?: string
  destination_ip?: string
  destination_port?: number
  summary?: string
  timestamp?: string
}

export type NetworkCanvasPayload = {
  topology: TopologyGraph
  flows: { flows?: PacketWolfFlow[]; note?: string }
  flow_stats: { dropped?: number; forwarded?: number; dropped_count?: number; allowed?: number }
  anomalies: { anomalies?: Array<{ summary?: string; severity?: string; host_id?: string }>; note?: string }
  packetwolf: { enabled: boolean; reachable: boolean; summary: string }
}

export const getNetworkCanvas = () =>
  platformFetch<NetworkCanvasPayload>('/api/v1/network-canvas')

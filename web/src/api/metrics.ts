// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { readJsonObject } from './client'

const API = '/api/v1'

export interface HttpTraceSpan {
  trace_id: string
  span_id: string
  method: string
  route: string
  status: number
  duration_ms: number
  timestamp_ms: number
}

export interface MetricsTracesResponse {
  traces: HttpTraceSpan[]
  count: number
}

export const getMetricsTraces = (limit = 32) =>
  readJsonObject<MetricsTracesResponse>(`${API}/metrics/traces?limit=${limit}`)

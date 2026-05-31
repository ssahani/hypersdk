// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export type TahoeStatTone = 'sky' | 'violet' | 'emerald' | 'amber'

export interface TahoeStat {
  label: string
  value: string
  tone?: TahoeStatTone
}

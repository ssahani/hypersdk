// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { PlatformHost, PlatformVm } from '../../../api/platform'

export type VmPowerAction = 'start' | 'stop' | 'shutdown' | 'pause' | 'resume'

export type FleetCommandCenterActions = {
  onSsh: (vm: PlatformVm) => void
  onMigrate: (vm: PlatformVm, destId: string, destName: string) => void
  onPower: (vm: PlatformVm, action: VmPowerAction) => void | Promise<void>
  onSnapshot: (vm: PlatformVm) => void | Promise<void>
  onDelete: (vm: PlatformVm) => void | Promise<void>
  onAdopt: (vm: PlatformVm) => void | Promise<void>
}

export type FleetCommandCenterProps = FleetCommandCenterActions & {
  selectedVm: PlatformVm | null
  hosts: PlatformHost[]
  hostMap: Map<string, string>
  showTheatrePreview?: boolean
  className?: string
  testId?: string
}

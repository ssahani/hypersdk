// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch } from './platform'

export type HostGpuDevice = {
  pci_address: string
  vendor: string
  device_name: string
  iommu_group: number
  mig_profile: string
}

export const getHostGpus = (hostId: string) =>
  platformFetch<{ devices: HostGpuDevice[]; nvidia_smi_summary: string }>(`/api/v1/hosts/${hostId}/gpus`)

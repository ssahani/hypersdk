// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch } from './platform'

export type VmLibvirtAction =
  | 'block.commit'
  | 'block.pull'
  | 'block.job.abort'
  | 'disk.tune'
  | 'nic.tune'
  | 'memtune.set'
  | 'scheduler.set'
  | 'vcpu.pin'
  | 'live.vcpus'
  | 'live.memory'
  | 'usb.attach'
  | 'usb.detach'
  | 'pci.attach'
  | 'pci.detach'
  | 'firmware.set'
  | 'tpm.attach'
  | 'tpm.detach'
  | 'boot.set'
  | 'domain.xml.update'

export type VmLibvirtQueryAction = 'block.job' | 'cputune.get' | 'memtune.get' | 'boot.get'

export type HostLibvirtQueryAction = 'browse.isos' | 'host.usb' | 'host.pci'

export const queryVmLibvirt = <T = unknown>(
  vmId: string,
  action: VmLibvirtQueryAction,
  params?: Record<string, string | boolean | undefined>,
) => {
  const sp = new URLSearchParams({ action })
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') sp.set(k, String(v))
    }
  }
  return platformFetch<T>(`/api/v1/vms/${vmId}/libvirt?${sp}`)
}

export const invokeVmLibvirt = <T = unknown>(
  vmId: string,
  action: VmLibvirtAction,
  payload: Record<string, unknown> = {},
) =>
  platformFetch<T>(`/api/v1/vms/${vmId}/libvirt`, {
    method: 'POST',
    body: JSON.stringify({ action, payload }),
  })

export const putVmDomainXml = (vmId: string, xml: string) =>
  platformFetch<{ status: string }>(`/api/v1/vms/${vmId}/domain-xml`, {
    method: 'PUT',
    body: JSON.stringify({ xml }),
  })

export const queryHostLibvirt = <T = unknown>(hostId: string, action: HostLibvirtQueryAction) =>
  platformFetch<T>(`/api/v1/hosts/${hostId}/libvirt?action=${encodeURIComponent(action)}`)

export interface BatchTaskItem {
  vm_id: string
  task_id?: string
  error?: string
}

export const batchVmSnapshot = (body: {
  vm_ids: string[]
  name: string
  description?: string
  disk_only?: boolean
  quiesce?: boolean
}) =>
  platformFetch<{ results: BatchTaskItem[] }>('/api/v1/vms/batch/snapshots', {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const batchVmDelete = (vm_ids: string[], confirmed = true) =>
  platformFetch<{ results: BatchTaskItem[] }>('/api/v1/vms/batch/delete', {
    method: 'POST',
    body: JSON.stringify({ vm_ids, confirmed }),
  })

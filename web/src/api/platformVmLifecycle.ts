// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Retire, portable disk export, IaC bundle export.

import { platformFetch } from './platform'

export const retirePlatformVm = (id: string, final_backup = false) =>
  platformFetch<{ task_id: string }>(`/api/v1/vms/${id}/retire`, {
    method: 'POST',
    body: JSON.stringify({ final_backup }),
  })

export const exportVmDisk = (id: string) =>
  platformFetch<{ task_id: string }>(`/api/v1/vms/${id}/disk/export`, { method: 'POST', body: '{}' })

export type VmIacExportBundle = {
  vm_id: string
  vm_name: string
  terraform: string
  ansible_role: string
  cloud_init: string
  domain_xml: string
}

export const exportVmIac = (id: string) => platformFetch<VmIacExportBundle>(`/api/v1/vms/${id}/export`)

/** Download Terraform, Ansible, cloud-init, and domain XML as one JSON bundle. */
export function downloadVmIacBundle(bundle: VmIacExportBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${bundle.vm_name}-iac-bundle.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

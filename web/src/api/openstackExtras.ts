// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { apiPost, readJsonObject } from './client'
import { parseResponseError } from './parseResponseError'

const API = '/api/v1'
const inst = (id: string) => encodeURIComponent(id)

export interface OpenStackCloudEntry {
  name: string
  active: boolean
}

export interface OpenStackSubnet {
  id: string
  name: string
  network_id: string
  cidr: string
  ip_version: number
  gateway_ip?: string
}

export interface OpenStackRouter {
  id: string
  name: string
  status: string
  external_gateway: boolean
}

export interface OpenStackPort {
  id: string
  name: string
  network_id: string
  status: string
  device_id?: string
  fixed_ips: string[]
}

export interface OpenStackVolumeType {
  id: string
  name: string
  is_public: boolean
}

export interface OpenStackServerGroup {
  id: string
  name: string
  policy: string
  members: string[]
}

export interface OpenStackInstanceInterface {
  port_id: string
  net_id: string
  mac_addr: string
  fixed_ips: string[]
}

export function listOpenStackClouds(): Promise<{ clouds: OpenStackCloudEntry[] }> {
  return readJsonObject(`${API}/openstack/clouds`)
}

export function selectOpenStackCloud(cloudName: string): Promise<{ status: string; cloud_name: string }> {
  return apiPost(`${API}/openstack/cloud`, { cloud_name: cloudName })
}

export function getOpenStackQuotas(): Promise<{ quotas: { compute: unknown; cinder?: unknown } }> {
  return readJsonObject(`${API}/openstack/quotas`)
}

export function listOpenStackSubnets(): Promise<{ subnets: OpenStackSubnet[] }> {
  return readJsonObject(`${API}/openstack/subnets`)
}

export function listOpenStackRouters(): Promise<{ routers: OpenStackRouter[] }> {
  return readJsonObject(`${API}/openstack/routers`)
}

export function listOpenStackPorts(deviceId?: string): Promise<{ ports: OpenStackPort[] }> {
  const q = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''
  return readJsonObject(`${API}/openstack/ports${q}`)
}

export function listOpenStackVolumeTypes(): Promise<{ volume_types: OpenStackVolumeType[] }> {
  return readJsonObject(`${API}/openstack/volume-types`)
}

export function listOpenStackServerGroups(): Promise<{ server_groups: OpenStackServerGroup[] }> {
  return readJsonObject(`${API}/openstack/server-groups`)
}

export function createOpenStackKeypair(body: {
  name: string
  public_key?: string
}): Promise<{ keypair: { name: string; fingerprint?: string } }> {
  return apiPost(`${API}/openstack/keypairs`, body)
}

export async function deleteOpenStackKeypair(name: string): Promise<void> {
  const res = await fetch(`${API}/openstack/keypairs/${inst(name)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) throw await parseResponseError(res)
}

export function createOpenStackSecurityGroup(body: {
  name: string
  description?: string
}): Promise<{ security_group: import('./openstack').OpenStackSecurityGroup }> {
  return apiPost(`${API}/openstack/security-groups`, body)
}

export async function deleteOpenStackSecurityGroup(id: string): Promise<void> {
  const res = await fetch(`${API}/openstack/security-groups/${inst(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) throw await parseResponseError(res)
}

export function createOpenStackSecurityGroupRule(
  groupId: string,
  body: {
    direction: string
    protocol?: string
    port_range_min?: number
    port_range_max?: number
    remote_ip_prefix?: string
    ethertype?: string
  },
): Promise<{ rule: import('./openstack').OpenStackSecurityGroupRule }> {
  return apiPost(`${API}/openstack/security-groups/${inst(groupId)}/rules`, body)
}

export async function deleteOpenStackSecurityGroupRule(ruleId: string): Promise<void> {
  const res = await fetch(`${API}/openstack/security-group-rules/${inst(ruleId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) throw await parseResponseError(res)
}

export function extendOpenStackVolume(
  id: string,
  newSizeGb: number,
): Promise<{ volume: import('./openstack').OpenStackAttachedVolume }> {
  return apiPost(`${API}/openstack/volumes/${inst(id)}/extend`, { new_size_gb: newSizeGb })
}

export function snapshotOpenStackVolume(
  id: string,
  name: string,
  force?: boolean,
): Promise<unknown> {
  return apiPost(`${API}/openstack/volumes/${inst(id)}/snapshot`, { name, force })
}

export function shelveOpenStackInstance(id: string): Promise<{ status: string }> {
  return apiPost(`${API}/openstack/instances/${inst(id)}/shelve`, {})
}

export function unshelveOpenStackInstance(id: string): Promise<{ status: string }> {
  return apiPost(`${API}/openstack/instances/${inst(id)}/unshelve`, {})
}

export function migrateOpenStackInstance(
  id: string,
  body: { live?: boolean; block_migration?: boolean; host?: string },
): Promise<{ status: string }> {
  return apiPost(`${API}/openstack/instances/${inst(id)}/migrate`, body)
}

export function rescueOpenStackInstance(
  id: string,
  body?: { image?: string; admin_pass?: string },
): Promise<{ status: string }> {
  return apiPost(`${API}/openstack/instances/${inst(id)}/rescue`, body ?? {})
}

export function unrescueOpenStackInstance(id: string): Promise<{ status: string }> {
  return apiPost(`${API}/openstack/instances/${inst(id)}/unrescue`, {})
}

export function backupOpenStackInstance(
  id: string,
  name: string,
): Promise<{ status: string }> {
  return apiPost(`${API}/openstack/instances/${inst(id)}/backup`, { name })
}

export function listOpenStackInstanceInterfaces(
  id: string,
): Promise<{ interfaces: OpenStackInstanceInterface[] }> {
  return readJsonObject(`${API}/openstack/instances/${inst(id)}/interfaces`)
}

export function attachOpenStackInterface(
  id: string,
  body: { network_id?: string; port_id?: string; fixed_ip?: string },
): Promise<{ interface: OpenStackInstanceInterface }> {
  return apiPost(`${API}/openstack/instances/${inst(id)}/interfaces`, body)
}

export async function detachOpenStackInterface(instanceId: string, portId: string): Promise<void> {
  const res = await fetch(
    `${API}/openstack/instances/${inst(instanceId)}/interfaces/${inst(portId)}`,
    { method: 'DELETE', credentials: 'same-origin' },
  )
  if (!res.ok) throw await parseResponseError(res)
}

export function getOpenStackConsoleTunnel(
  id: string,
  type = 'novnc',
): Promise<{ url: string; proxy_path: string; tunnel: boolean }> {
  return readJsonObject(`${API}/openstack/instances/${inst(id)}/console/tunnel?type=${encodeURIComponent(type)}`)
}

export function getOpenStackInstanceStack(
  id: string,
): Promise<{ stack: { stack_id?: string; stack_name?: string } | null }> {
  return readJsonObject(`${API}/openstack/instances/${inst(id)}/stack`)
}

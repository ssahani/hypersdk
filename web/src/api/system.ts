import { apiGet, apiPut } from './client'

const API = '/api/v1'

export interface OsUserCapability {
  canCreateOsUsers: boolean
  /** Same gate as create; omitted on older daemons (treat like canCreateOsUsers). */
  canDeleteOsUsers?: boolean
  reason: string | null
  /** Host has `getent group libvirt` (typical for qemu:///system). */
  libvirtGroupAvailable?: boolean
  libvirtGroupName?: string
  /** `"traditional"` or `"systemd-homed"` — how new accounts are provisioned. */
  userAccountBackend?: string
  systemdHomedActive?: boolean
  homectlAvailable?: boolean
  /** `wheel` or `sudo` when present in NSS (used for sudo-capable supplementary group). */
  sudoSupplementaryGroup?: string | null
}

export interface CreateOsUserResult {
  libvirt_group_attached: boolean
  account_backend?: string
}

export async function getOsUserCapability(): Promise<OsUserCapability> {
  const res = await fetch(`${API}/system/os-users/capability`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function createOsUser(
  username: string,
  password: string,
  addToLibvirtGroup = true,
): Promise<CreateOsUserResult> {
  const res = await fetch(`${API}/system/os-users`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, add_to_libvirt_group: addToLibvirtGroup }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  const body = (await res.json().catch(() => ({}))) as {
    libvirt_group_attached?: boolean
    account_backend?: string
  }
  return {
    libvirt_group_attached: Boolean(body.libvirt_group_attached),
    account_backend: body.account_backend,
  }
}

export async function deleteOsUser(username: string): Promise<void> {
  const enc = encodeURIComponent(username)
  const res = await fetch(`${API}/system/os-users/${enc}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
}

/** Server-wide Create VM form defaults (`/var/lib/machina/create-vm-defaults.json`). */
export async function getServerCreateVmDefaults(): Promise<Record<string, unknown>> {
  return apiGet(`${API}/system/create-vm-defaults`)
}

export async function putServerCreateVmDefaults(body: Record<string, unknown>): Promise<{ status?: string }> {
  return apiPut(`${API}/system/create-vm-defaults`, body)
}

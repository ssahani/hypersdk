const API = '/api/v1'

export interface OsUserCapability {
  canCreateOsUsers: boolean
  reason: string | null
  /** Host has `getent group libvirt` (typical for qemu:///system). */
  libvirtGroupAvailable?: boolean
  libvirtGroupName?: string
}

export interface CreateOsUserResult {
  libvirt_group_attached: boolean
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
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  const body = await res.json().catch(() => ({})) as { libvirt_group_attached?: boolean }
  return { libvirt_group_attached: Boolean(body.libvirt_group_attached) }
}

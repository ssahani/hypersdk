const API = '/api/v1'

export interface OsUserCapability {
  canCreateOsUsers: boolean
  reason: string | null
}

export async function getOsUserCapability(): Promise<OsUserCapability> {
  const res = await fetch(`${API}/system/os-users/capability`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function createOsUser(username: string, password: string): Promise<void> {
  const res = await fetch(`${API}/system/os-users`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
}

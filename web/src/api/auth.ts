const API = '/api/v1'

/** RBAC role from session or API token (daemon `roles.json` / token metadata). */
export type SessionRole = 'admin' | 'operator' | 'readonly'

export interface AuthSession {
  authenticated: boolean
  username?: string
  /** Opaque id for this browser tab session (root-only admin UI). */
  session_id?: string | null
  /** Present when authenticated via cookie or token-aware session. */
  role?: SessionRole
}

export async function login(username: string, password: string): Promise<{ status: string; username: string }> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function logout(): Promise<void> {
  await fetch(`${API}/auth/logout`, {
    method: 'POST',
    credentials: 'same-origin',
  })
}

export async function getSession(): Promise<AuthSession> {
  const res = await fetch(`${API}/auth/session`, { credentials: 'same-origin' })
  if (!res.ok) return { authenticated: false }
  return res.json()
}

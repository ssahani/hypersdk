const API = '/api/v1'

export interface AdminSessionRow {
  session_id: string
  username: string
  age_secs: number
  expires_in_secs: number
  is_current: boolean
}

export interface AdminSessionsResponse {
  sessions: AdminSessionRow[]
  total_sessions: number
  users_logged_in: number
  sessions_per_username: Record<string, number>
}

export async function listAdminSessions(): Promise<AdminSessionsResponse> {
  const res = await fetch(`${API}/admin/sessions`, { credentials: 'same-origin' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function revokeAdminSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API}/admin/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `HTTP ${res.status}`)
  }
}

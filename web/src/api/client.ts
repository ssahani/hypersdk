const defaultOpts: RequestInit = { credentials: 'same-origin' }

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, defaultOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || `HTTP ${res.status}: ${res.statusText}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  return await res.text() as T
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    ...defaultOpts,
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}: ${res.statusText}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  return await res.text() as T
}

export async function apiPostVoid(url: string, body?: unknown): Promise<void> {
  const res = await fetch(url, {
    ...defaultOpts,
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}: ${res.statusText}`)
  }
}

export async function apiDelete(url: string): Promise<void> {
  const res = await fetch(url, { ...defaultOpts, method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}: ${res.statusText}`)
  }
}

export async function getWsToken(): Promise<string> {
  const res = await fetch('/api/v1/ws-token', { method: 'POST', credentials: 'same-origin' })
  if (!res.ok) throw new Error('Failed to get WebSocket token')
  const data = await res.json()
  return data.token
}

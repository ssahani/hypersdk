const defaultOpts: RequestInit = { credentials: 'same-origin' }

/** Prefer daemon JSON `{ error, error_code? }` for thrown message text. */
function formatHttpErrorBody(status: number, statusText: string, text: string): string {
  const raw = text.trim()
  if (!raw) return `HTTP ${status}: ${statusText}`
  try {
    const j = JSON.parse(raw) as { error?: string; error_code?: string }
    if (typeof j.error === 'string' && j.error.length > 0) {
      return j.error_code ? `${j.error} (${j.error_code})` : j.error
    }
  } catch {
    /* not JSON */
  }
  return raw
}

/** fetch() throws TypeError / "NetworkError" when DNS fails, CORS blocks, TLS errors, or daemon is down. */
async function fetchApi(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (
      e instanceof TypeError
      || msg.includes('NetworkError')
      || msg.includes('Failed to fetch')
      || msg.includes('Load failed')
    ) {
      throw new Error(
        'Cannot reach the machina API (network error). Open the UI from the same URL as the daemon (host + port), ensure machina-daemon is running, and check HTTPS vs HTTP and any browser blockers.',
      )
    }
    throw e
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetchApi(url, defaultOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(formatHttpErrorBody(res.status, res.statusText, body))
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  return await res.text() as T
}

/** GET binary (screenshots, downloads). */
export async function apiGetBlob(url: string): Promise<Blob> {
  const res = await fetchApi(url, defaultOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(formatHttpErrorBody(res.status, res.statusText, body))
  }
  return res.blob()
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetchApi(url, {
    ...defaultOpts,
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(formatHttpErrorBody(res.status, res.statusText, text))
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  return await res.text() as T
}

export async function apiPostVoid(url: string, body?: unknown): Promise<void> {
  const res = await fetchApi(url, {
    ...defaultOpts,
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(formatHttpErrorBody(res.status, res.statusText, text))
  }
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetchApi(url, {
    ...defaultOpts,
    method: 'PUT',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(formatHttpErrorBody(res.status, res.statusText, text))
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  return await res.text() as T
}

export async function apiDelete(url: string): Promise<void> {
  const res = await fetchApi(url, { ...defaultOpts, method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(formatHttpErrorBody(res.status, res.statusText, text))
  }
}

export async function getWsToken(): Promise<string> {
  const res = await fetchApi('/api/v1/ws-token', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to get WebSocket token')
  const data = await res.json()
  return data.token
}

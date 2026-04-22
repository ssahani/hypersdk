const defaultOpts: RequestInit = { credentials: 'same-origin' }

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
        'Cannot reach the virtspawn API (network error). Open the UI from the same URL as the daemon (host + port), ensure virtspawn-daemon is running, and check HTTPS vs HTTP and any browser blockers.',
      )
    }
    throw e
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetchApi(url, defaultOpts)
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
  const res = await fetchApi(url, {
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
  const res = await fetchApi(url, {
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
  const res = await fetchApi(url, { ...defaultOpts, method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}: ${res.statusText}`)
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

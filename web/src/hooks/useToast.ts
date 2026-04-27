import { useState, useCallback, useEffect, useRef } from 'react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

/** Normalize kubectl stderr so duplicate TLS spam dedupes across retries. */
function errorToastDedupeKey(message: string): string {
  const stripped = message
    .replace(/E\d{4}\s+\d{2}:\d{2}:\d{2}\.\d+\s+\d+\s+/g, '')
    .replace(/\b\d{5,7}\b/g, '')
  return stripped.length > 900 ? stripped.slice(0, 900) : stripped
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const lastErrorToastRef = useRef<{ key: string; at: number; id: string } | null>(null)

  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout) }
  }, [])

  const addToast = useCallback((message: string, type: Toast['type'], duration = 5000) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    const timer = setTimeout(() => {
      timersRef.current.delete(timer)
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
    timersRef.current.add(timer)
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const error = useCallback(
    (msg: string, d?: number) => {
      const key = errorToastDedupeKey(msg)
      const now = Date.now()
      const prev = lastErrorToastRef.current
      if (prev && prev.key === key && now - prev.at < 8000) {
        return prev.id
      }
      const id = addToast(msg, 'error', d)
      lastErrorToastRef.current = { key, at: now, id }
      return id
    },
    [addToast],
  )

  return {
    toasts,
    removeToast,
    success: (msg: string, d?: number) => addToast(msg, 'success', d),
    error,
    warning: (msg: string, d?: number) => addToast(msg, 'warning', d),
    info: (msg: string, d?: number) => addToast(msg, 'info', d),
  }
}

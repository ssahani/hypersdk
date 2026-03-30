import { useState, useCallback, useEffect, useRef } from 'react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

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

  return {
    toasts,
    removeToast,
    success: (msg: string, d?: number) => addToast(msg, 'success', d),
    error: (msg: string, d?: number) => addToast(msg, 'error', d),
    warning: (msg: string, d?: number) => addToast(msg, 'warning', d),
    info: (msg: string, d?: number) => addToast(msg, 'info', d),
  }
}

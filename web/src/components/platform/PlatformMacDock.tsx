// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router'
import { Search, Sparkles } from 'lucide-react'
import { useAi } from '../../contexts/AiContext'
import { unlockDockPreviewPath, usePlatformDockItems } from '../../utils/platformDockPins'
import { useToastContext } from '../../contexts/ToastContext'
import { platformDesktopTabActive, platformDesktopTabGroup } from '../../utils/platformDesktopTabs'

function openSpotlight() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
}

function isMachineFinderRoot(pathname: string): boolean {
  if (!pathname.startsWith('/platform/vms')) return false
  const rest = pathname.slice('/platform/vms'.length)
  return rest === '' || rest === '/'
}

export default function PlatformMacDock() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToastContext()
  const { openCopilot } = useAi()
  const dockItems = usePlatformDockItems()
  const [mounted, setMounted] = useState(false)
  const [dockVisible, setDockVisible] = useState(true)
  const hideTimerRef = useRef<number | null>(null)
  const autoHide = isMachineFinderRoot(location.pathname)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!autoHide) {
      setDockVisible(true)
      return
    }

    const scheduleHide = () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = window.setTimeout(() => setDockVisible(false), 2800)
    }

    const onMove = (e: MouseEvent) => {
      const nearBottom = window.innerHeight - e.clientY < 56
      if (nearBottom) {
        setDockVisible(true)
        scheduleHide()
      }
    }

    scheduleHide()
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
  }, [autoHide, location.pathname])

  const goDock = (path: string) => {
    const hub = platformDesktopTabGroup(path)
    navigate(hub)
  }

  const dock = (
    <footer
      className={`mac-dock flex ${autoHide ? 'mac-dock-autohide' : ''} ${autoHide && !dockVisible ? 'mac-dock-hidden' : ''}`}
      role="navigation"
      aria-label="Platform dock"
    >
      <div className="mac-dock-inner mac-dock-inner-scroll">
        {dockItems.map((item) => {
          const Icon = item.icon
          const active = !item.preview && platformDesktopTabActive(location.pathname, item.path)
          const cls = `mac-dock-item ${active ? 'mac-dock-item-active' : ''} ${item.preview ? 'mac-dock-item-preview' : ''}`
          if (item.preview) {
            return (
              <button
                key={`preview-${item.path}`}
                type="button"
                title={`${item.label} — Power user`}
                aria-label={`${item.label} preview`}
                className={cls}
                onClick={() => {
                  if (unlockDockPreviewPath(item.path)) {
                    toast.success('Switched to Power user — hub unlocked')
                    navigate(item.path)
                  }
                }}
              >
                <Icon className="h-6 w-6" strokeWidth={1.75} />
                <span className="mac-dock-tooltip">{item.label}</span>
              </button>
            )
          }
          const hub = platformDesktopTabGroup(item.path)
          return (
            <Link
              key={item.path}
              to={hub}
              title={item.label}
              aria-label={item.label}
              className={cls}
              aria-current={active ? 'page' : undefined}
              onClick={(e) => {
                if (location.pathname === hub) return
                e.preventDefault()
                goDock(item.path)
              }}
            >
              <Icon className="h-6 w-6" strokeWidth={1.75} />
              <span className="mac-dock-tooltip">{item.label}</span>
              {active ? <span className="mac-dock-dot" aria-hidden /> : null}
            </Link>
          )
        })}

        <div className="mac-dock-divider" aria-hidden />

        <button
          type="button"
          onClick={openCopilot}
          className="mac-dock-spotlight mac-dock-ask"
          title="Ask Zeus"
          aria-label="Ask Zeus"
        >
          <Sparkles className="h-4 w-4" />
          <span className="mac-dock-spotlight-label hidden xl:inline">Zeus</span>
        </button>

        <button
          type="button"
          onClick={openSpotlight}
          className="mac-dock-spotlight"
          title="Spotlight (⌘K)"
          aria-label="Open Spotlight"
        >
          <Search className="h-4 w-4" />
          <span className="mac-dock-spotlight-label hidden xl:inline">Spotlight</span>
        </button>
      </div>
    </footer>
  )

  if (!mounted) return null
  return createPortal(dock, document.body)
}

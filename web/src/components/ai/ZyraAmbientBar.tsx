// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useLocation } from 'react-router'
import { usePlatformInfo } from '../../contexts/PlatformInfoContext'
import { useAi } from '../../contexts/AiContext'

/** Floating Zeus pill — superseded by Navbar (classic) and Dynamic Island (platform). */
export default function ZyraAmbientBar() {
  const location = useLocation()
  const { info } = usePlatformInfo()
  const { mode } = useAi()
  const platform = Boolean(info?.control_plane?.proxy_url)

  if (!platform || mode === 'off') return null
  if (location.pathname.startsWith('/platform')) return null
  // Classic shell: Navbar exposes Zeus when AI is on.
  return null
}

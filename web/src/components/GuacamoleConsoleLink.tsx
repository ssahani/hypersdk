// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { getGuacamoleAuth } from '../api/vm'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'
import { useToastContext } from '../contexts/ToastContext'
import { formatUserError } from '../utils/apiError'

type Props = {
  vmName: string
  connection?: string | null
  className?: string
}

/** Open VM display in Apache Guacamole (VNC bridge) when `[guacamole]` is enabled on the daemon. */
export default function GuacamoleConsoleLink({ vmName, connection, className }: Props) {
  const { info } = usePlatformInfo()
  const toast = useToastContext()
  const [busy, setBusy] = useState(false)

  const guac = info?.guacamole
  if (!guac?.enabled || !guac.base_url?.trim()) {
    return null
  }

  const open = async () => {
    setBusy(true)
    try {
      const auth = await getGuacamoleAuth(vmName, connection)
      const base = guac.base_url.replace(/\/$/, '')
      if (auth.token) {
        window.open(`${base}/#/?token=${encodeURIComponent(auth.token)}`, '_blank', 'noopener,noreferrer')
        toast.success(`Opened Guacamole (${auth.protocol}) for ${vmName}`)
        return
      }
      toast.warning(
        'Guacamole token not returned — enable [guacamole] fetch_token in daemon config, or paste guac_data into Guacamole manually.',
      )
    } catch (e: unknown) {
      toast.error(`Guacamole: ${formatUserError(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      className={
        className ??
        'px-3 py-1.5 bg-violet-900/40 hover:bg-violet-800/50 border border-violet-500/30 rounded-lg text-sm transition flex items-center gap-1 text-violet-100'
      }
      title="Open display in Apache Guacamole (HTML5 VNC/RDP gateway)"
    >
      <ExternalLink className="w-4 h-4" />
      {busy ? 'Connecting…' : 'Guacamole'}
    </button>
  )
}

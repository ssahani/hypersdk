// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { consoleAccessHints, type GuestAccessHints } from '../../utils/guestAccessHints'

type Props = {
  hints: GuestAccessHints | null | undefined
  lens: string
  sshUser?: string
  guestIp?: string
  vmId?: string
}

export default function GuestAccessBanner({ hints, lens, sshUser, guestIp, vmId }: Props) {
  const messages = consoleAccessHints(hints, lens, {
    sshUser,
    guestIp,
    hypervisorHost: typeof window !== 'undefined' ? window.location.hostname : undefined,
    vmNetworkHref: vmId ? `/platform/vms/${vmId}?tab=network` : undefined,
  })
  if (messages.length === 0) return null

  return (
    <div className="shrink-0 space-y-1 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/95">
      {messages.map((msg) => (
        <p key={msg}>
          {msg}
          {vmId && msg.includes('Expose SSH') ? (
            <>
              {' '}
              <Link to={`/platform/vms/${vmId}?tab=network`} className="text-sky-300 hover:text-sky-200 underline">
                Network tab →
              </Link>
            </>
          ) : null}
        </p>
      ))}
    </div>
  )
}

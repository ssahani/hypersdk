// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { useState, useEffect } from 'react'
import { getLicense, type LicenseInfo } from '../api/client'

export default function TrialBanner() {
  const [info, setInfo] = useState<LicenseInfo | null>(null)

  useEffect(() => {
    getLicense()
      .then(setInfo)
      .catch(() => {/* ignore — no banner if unreachable */})
  }, [])

  if (!info) return null

  if (info.is_valid && info.days_remaining > 7) return null

  const expired = !info.is_valid

  return (
    <div
      className={`w-full text-center text-sm font-medium py-1.5 px-4 z-50 ${
        expired
          ? 'bg-red-600/90 text-white'
          : 'bg-amber-500/90 text-white'
      }`}
    >
      {expired ? (
        <>
          Trial expired on <strong>{info.expires}</strong>.{' '}
          <a
            href="https://zyvor.dev/contact?intent=trial&product=machina"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Contact sales@zyvor.dev
          </a>{' '}
          to continue using Machina.
        </>
      ) : (
        <>
          Trial expires in <strong>{info.days_remaining} day{info.days_remaining === 1 ? '' : 's'}</strong> ({info.expires}).{' '}
          <a
            href="https://zyvor.dev/contact?intent=trial&product=machina"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Contact sales@zyvor.dev
          </a>{' '}
          to purchase a licence.
        </>
      )}
    </div>
  )
}

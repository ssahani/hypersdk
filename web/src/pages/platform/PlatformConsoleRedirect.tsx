// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Navigate, useParams } from 'react-router'

/** Legacy `/platform/vms/:id/console` → ConsoleHub. */
export default function PlatformConsoleRedirect() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/platform/vms" replace />
  return <Navigate to={`/platform/vms/${id}/consolehub`} replace />
}

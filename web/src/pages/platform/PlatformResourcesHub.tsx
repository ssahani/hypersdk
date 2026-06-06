// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Navigate } from 'react-router'
import PlatformInfrastructureHub from './PlatformInfrastructureHub'

/** @deprecated Use `/platform/infrastructure` — kept for settings embeds and bookmarks. */
export default function PlatformResourcesHub({ embedded }: { embedded?: boolean } = {}) {
  if (embedded) return <PlatformInfrastructureHub embedded />
  return <Navigate to="/platform/infrastructure" replace />
}

// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ToastAction } from '../hooks/useToast'
import type { PlatformDesktopTier } from './platformDesktopTier'
import { tasksHubHref } from './platformHubLinks'

export function taskToastAction(taskId: string, tier: PlatformDesktopTier): ToastAction {
  return {
    label: 'View task',
    href: `${tasksHubHref(tier)}?task=${encodeURIComponent(taskId)}`,
  }
}

export function toastQueuedOperation(
  toast: {
    success: (message: string, duration?: number, action?: ToastAction) => string
  },
  label: string,
  taskId: string,
  tier: PlatformDesktopTier,
) {
  toast.success(label, 10_000, taskToastAction(taskId, tier))
}

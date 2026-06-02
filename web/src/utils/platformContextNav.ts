// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Re-exports from platformNavRegistry for backward compatibility.

export type {
  ContextNavItem,
  PlatformContextNav,
} from './platformNavRegistry'

export {
  SETTINGS_WORKSPACE_PATHS,
  contextNavForPath,
  isContextNavActive,
  isSettingsContextPath,
  isSettingsWorkspacePath,
  MAX_CONTEXT_PILLS,
  operationsNavItemsForTier,
  settingsItemsForTier,
  shouldShowContextBar,
  splitContextNavItems,
  suppressContextBar,
} from './platformNavRegistry'

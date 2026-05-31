// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { HelpTab } from '../components/HelpDialog'

export const OPEN_HELP_EVENT = 'machina-open-help'

export function dispatchOpenHelp(tab: HelpTab = 'shortcuts') {
  window.dispatchEvent(new CustomEvent(OPEN_HELP_EVENT, { detail: { tab } }))
}

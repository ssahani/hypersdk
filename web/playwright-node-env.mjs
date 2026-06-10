// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Node 26+: suppress DEP0205 until @playwright/test ships registerHooks (≥1.61 stable).

const DEP0205 = '--disable-warning=DEP0205'

if (!process.env.NODE_OPTIONS?.includes(DEP0205)) {
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, DEP0205].filter(Boolean).join(' ')
}

if (process.env.FORCE_COLOR) {
  delete process.env.NO_COLOR
}

export {}

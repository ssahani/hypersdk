#!/usr/bin/env node
// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Wrapper: suppress Node 26 DEP0205 from Playwright's module.register() until @playwright/test >= 1.61.

import { spawn } from 'node:child_process'

const extraArgs = process.argv.slice(2)
const env = { ...process.env }

// Playwright sets FORCE_COLOR; NO_COLOR in the shell triggers noisy warnings.
delete env.NO_COLOR

const disable = '--disable-warning=DEP0205'
env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ${disable}` : disable

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['playwright', 'test', ...extraArgs],
  { stdio: 'inherit', env, shell: process.platform === 'win32' },
)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})

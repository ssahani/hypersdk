#!/usr/bin/env node
// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Playwright CLI wrapper for Node 26+: suppress DEP0205 (module.register) and NO_COLOR/FORCE_COLOR noise.

import { spawn } from 'node:child_process'

const PLAYWRIGHT_COMMANDS = new Set([
  'install',
  'test',
  'show-report',
  'codegen',
  'open',
  'merge-reports',
  'clear-cache',
])

const rawArgs = process.argv.slice(2)
const playwrightArgs =
  rawArgs.length > 0 && PLAYWRIGHT_COMMANDS.has(rawArgs[0]) ? rawArgs : ['test', ...rawArgs]

const env = { ...process.env }
// Playwright sets FORCE_COLOR; NO_COLOR in the shell triggers noisy warnings in workers.
delete env.NO_COLOR

const disable = '--disable-warning=DEP0205'
env.NODE_OPTIONS = env.NODE_OPTIONS?.includes(disable)
  ? env.NODE_OPTIONS
  : env.NODE_OPTIONS
    ? `${env.NODE_OPTIONS} ${disable}`
    : disable

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['playwright', ...playwrightArgs],
  { stdio: 'inherit', env, shell: process.platform === 'win32' },
)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})

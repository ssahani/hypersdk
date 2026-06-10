#!/usr/bin/env node
// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Playwright CLI wrapper for Node 26+: set NODE_OPTIONS before Playwright bootstraps (DEP0205).

import '../playwright-node-env.mjs'
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
delete env.NO_COLOR

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['playwright', ...playwrightArgs],
  { stdio: 'inherit', env, shell: process.platform === 'win32' },
)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})

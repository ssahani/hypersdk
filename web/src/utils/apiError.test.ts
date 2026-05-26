// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { describe, expect, it } from 'vitest'
import {
  formatHttpErrorBody,
  formatUserError,
  friendlyErrorCode,
  sanitizeErrorText,
} from './apiError'

describe('sanitizeErrorText', () => {
  it('replaces HTML error pages with a short explanation', () => {
    const html = '<!DOCTYPE html><html><body>503</body></html>'
    const out = sanitizeErrorText(html)
    expect(out).not.toContain('</html>')
    expect(out.toLowerCase()).toContain('html')
  })
})

describe('formatHttpErrorBody', () => {
  it('maps error_code only JSON to a friendly label', () => {
    const body = JSON.stringify({ error_code: 'operation_failed' })
    expect(formatHttpErrorBody(500, 'Internal Server Error', body)).toBe(
      friendlyErrorCode('operation_failed'),
    )
  })

  it('includes message and code without duplicating bare code', () => {
    const body = JSON.stringify({
      error: 'Neutron unavailable',
      error_code: 'operation_failed',
    })
    const out = formatHttpErrorBody(503, 'Service Unavailable', body)
    expect(out).toContain('Neutron unavailable')
    expect(out).toContain(friendlyErrorCode('operation_failed'))
  })

  it('handles HTML responses from proxies', () => {
    const html = '<html><head><title>503</title></head><body>down</body></html>'
    const out = formatHttpErrorBody(503, 'Service Unavailable', html)
    expect(out).not.toContain('</html>')
    expect(out.toLowerCase()).toContain('html')
  })

  it('truncates very long plain text', () => {
    const long = 'x'.repeat(500)
    const out = formatHttpErrorBody(500, 'Error', long)
    expect(out.length).toBeLessThan(450)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('formatUserError', () => {
  it('sanitizes Error messages that embed HTML', () => {
    const err = new Error('</html> (operation_failed)')
    const out = formatUserError(err)
    expect(out).not.toContain('</html>')
  })
})

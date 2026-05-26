// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

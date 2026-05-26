// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { formatHttpErrorBody } from '../utils/apiError'

/** Build a thrown Error from a non-OK fetch Response (JSON, HTML, or plain text). */
export async function parseResponseError(res: Response): Promise<Error> {
  const text = await res.text().catch(() => '')
  return new Error(formatHttpErrorBody(res.status, res.statusText, text))
}

import { formatHttpErrorBody } from '../utils/apiError'

/** Non-OK response before reading an SSE body. */
export async function streamResponseError(res: Response): Promise<Error> {
  const text = await res.text().catch(() => '')
  return new Error(formatHttpErrorBody(res.status, res.statusText, text))
}

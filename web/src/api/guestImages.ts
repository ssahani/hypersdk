import { apiGet, apiPost } from './client'

const API = '/api/v1'

export interface GuestOsRow {
  short_id: string
  name: string
  version: string
}

export async function guestOsList(): Promise<{ oses: GuestOsRow[]; hint?: string }> {
  return apiGet(`${API}/guest-images/os-list`)
}

export async function guestOsDetect(url: string): Promise<{
  exit_code: number | null
  stdout: string
  stderr: string
}> {
  return apiPost(`${API}/guest-images/os-detect`, { url })
}

export async function guestRhelImageUrl(body: {
  access_token: string
  rhel_version?: string
  arch?: string
}): Promise<{ raw?: unknown; error?: string; stderr?: string }> {
  return apiPost(`${API}/guest-images/rhel-url`, body)
}

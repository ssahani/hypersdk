import type { OpenStackFloatingIp } from '../api/openstack'

/** True when a project FIP can be associated to `currentInstanceId`. */
export function isFloatingIpAvailable(
  f: OpenStackFloatingIp,
  currentInstanceId: string,
): boolean {
  const bound = f.instance_id?.trim()
  if (bound && bound !== currentInstanceId) return false
  if (f.fixed_address?.trim()) return false
  const status = f.status.toLowerCase()
  if (status.includes('error')) return false
  return true
}

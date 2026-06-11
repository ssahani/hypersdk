// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export type PortForwardAccessKind = 'ssh' | 'http' | 'https' | 'tcp'

export interface PortForwardServiceTemplate {
  id: string
  name: string
  vmPort: number
  hostPort: number
  access: PortForwardAccessKind
  /** Built-in catalog entry vs user-saved custom template. */
  builtin?: boolean
}

export const KNOWN_PORT_FORWARD_SERVICES: PortForwardServiceTemplate[] = [
  { id: 'ssh', name: 'SSH', vmPort: 22, hostPort: 2222, access: 'ssh', builtin: true },
  { id: 'http', name: 'HTTP', vmPort: 80, hostPort: 9080, access: 'http', builtin: true },
  { id: 'https', name: 'HTTPS', vmPort: 443, hostPort: 9443, access: 'https', builtin: true },
  { id: 'http-alt', name: 'HTTP (8080)', vmPort: 8080, hostPort: 18080, access: 'http', builtin: true },
  { id: 'https-alt', name: 'HTTPS (8443)', vmPort: 8443, hostPort: 18443, access: 'https', builtin: true },
  { id: 'mysql', name: 'MySQL', vmPort: 3306, hostPort: 13306, access: 'tcp', builtin: true },
  { id: 'postgres', name: 'PostgreSQL', vmPort: 5432, hostPort: 15432, access: 'tcp', builtin: true },
  { id: 'redis', name: 'Redis', vmPort: 6379, hostPort: 16379, access: 'tcp', builtin: true },
  { id: 'mongodb', name: 'MongoDB', vmPort: 27017, hostPort: 27017, access: 'tcp', builtin: true },
  { id: 'rdp', name: 'RDP', vmPort: 3389, hostPort: 13389, access: 'tcp', builtin: true },
  { id: 'vnc', name: 'VNC', vmPort: 5900, hostPort: 15900, access: 'tcp', builtin: true },
  { id: 'grafana', name: 'Grafana', vmPort: 3000, hostPort: 13000, access: 'http', builtin: true },
  { id: 'prometheus', name: 'Prometheus', vmPort: 9090, hostPort: 19090, access: 'http', builtin: true },
  { id: 'elasticsearch', name: 'Elasticsearch', vmPort: 9200, hostPort: 19200, access: 'http', builtin: true },
  { id: 'k8s-api', name: 'Kubernetes API', vmPort: 6443, hostPort: 16443, access: 'tcp', builtin: true },
]

const CUSTOM_STORAGE_PREFIX = 'machina-port-forward-custom:'

export function customServicesStorageKey(platformVmId: string): string {
  return `${CUSTOM_STORAGE_PREFIX}${platformVmId}`
}

export function loadCustomPortForwardServices(platformVmId: string): PortForwardServiceTemplate[] {
  if (typeof window === 'undefined' || !platformVmId) return []
  try {
    const raw = window.localStorage.getItem(customServicesStorageKey(platformVmId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as PortForwardServiceTemplate[]
    return Array.isArray(parsed)
      ? parsed.filter((s) => s?.name && s.vmPort > 0 && s.hostPort > 0)
      : []
  } catch {
    return []
  }
}

export function saveCustomPortForwardService(
  platformVmId: string,
  service: PortForwardServiceTemplate,
): PortForwardServiceTemplate[] {
  const existing = loadCustomPortForwardServices(platformVmId)
  const next = [...existing.filter((s) => s.id !== service.id), service]
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(customServicesStorageKey(platformVmId), JSON.stringify(next))
  }
  return next
}

export function deleteCustomPortForwardService(platformVmId: string, id: string): PortForwardServiceTemplate[] {
  const next = loadCustomPortForwardServices(platformVmId).filter((s) => s.id !== id)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(customServicesStorageKey(platformVmId), JSON.stringify(next))
  }
  return next
}

export function suggestHostPort(guestPort: number, taken: number[] = []): number {
  const known = KNOWN_PORT_FORWARD_SERVICES.find((s) => s.vmPort === guestPort)
  if (known && !taken.includes(known.hostPort)) return known.hostPort
  const candidates = [
    guestPort >= 1024 && guestPort <= 49151 ? guestPort : null,
    9000 + guestPort,
    10000 + guestPort,
    20000 + guestPort,
  ].filter((p): p is number => p != null && p <= 65535)
  return candidates.find((p) => !taken.includes(p)) ?? Math.min(65535, guestPort + 40000)
}

export function publicHostname(explicit?: string): string {
  return explicit?.trim() || (typeof window !== 'undefined' ? window.location.hostname : '')
}

export function serviceAccessLabel(
  service: Pick<PortForwardServiceTemplate, 'access' | 'hostPort'>,
  sshUser = 'ubuntu',
  hostname?: string,
): string {
  const host = publicHostname(hostname)
  switch (service.access) {
    case 'ssh':
      return `ssh -p ${service.hostPort} ${sshUser}@${host || 'HOST'}`
    case 'http':
      return `http://${host || 'HOST'}:${service.hostPort}/`
    case 'https':
      return `https://${host || 'HOST'}:${service.hostPort}/`
    default:
      return `${host || 'HOST'}:${service.hostPort}`
  }
}

export function serviceAccessHref(
  service: Pick<PortForwardServiceTemplate, 'access' | 'hostPort'>,
  hostname?: string,
): string | undefined {
  const host = publicHostname(hostname)
  if (!host) return undefined
  if (service.access === 'http') return `http://${host}:${service.hostPort}/`
  if (service.access === 'https') return `https://${host}:${service.hostPort}/`
  return undefined
}

export function ruleMatchesService(
  rule: { host_port: number; vm_port: number; protocol: string },
  service: Pick<PortForwardServiceTemplate, 'hostPort' | 'vmPort'>,
): boolean {
  return rule.protocol === 'tcp' && rule.host_port === service.hostPort && rule.vm_port === service.vmPort
}

export function resolveServiceForRule(
  rule: { host_port: number; vm_port: number; protocol?: string; description?: string },
  catalog: PortForwardServiceTemplate[],
): PortForwardServiceTemplate | null {
  const normalized = { ...rule, protocol: rule.protocol ?? 'tcp' }
  const match = catalog.find((s) => ruleMatchesService(normalized, s))
  if (match) return match
  const desc = rule.description?.trim()
  if (desc) {
    return {
      id: `rule-${rule.host_port}-${rule.vm_port}`,
      name: desc,
      vmPort: rule.vm_port,
      hostPort: rule.host_port,
      access: inferAccessKind(rule.vm_port),
    }
  }
  return {
    id: `rule-${rule.host_port}-${rule.vm_port}`,
    name: `TCP ${rule.vm_port}`,
    vmPort: rule.vm_port,
    hostPort: rule.host_port,
    access: inferAccessKind(rule.vm_port),
  }
}

function inferAccessKind(vmPort: number): PortForwardAccessKind {
  if (vmPort === 22) return 'ssh'
  if (vmPort === 443 || vmPort === 8443) return 'https'
  if (vmPort === 80 || vmPort === 8080 || vmPort === 3000 || vmPort === 9090 || vmPort === 9200) return 'http'
  return 'tcp'
}

export function newCustomServiceId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
  return `custom-${slug || 'service'}-${Date.now().toString(36)}`
}

export function inferAccessFromPorts(vmPort: number, preferHttp = false): PortForwardAccessKind {
  if (preferHttp && (vmPort === 80 || vmPort === 8080 || vmPort === 3000)) return 'http'
  return inferAccessKind(vmPort)
}

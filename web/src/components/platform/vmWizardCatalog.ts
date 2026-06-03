// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// OS flavors and size presets aligned with controller template_catalog.

export type OsFlavor = {
  id: string
  label: string
  subtitle: string
  category: 'Linux' | 'Windows' | 'Database' | 'Appliance' | 'Special'
  icon: string
  featured?: boolean
  windows?: boolean
}

export const OS_FLAVORS: OsFlavor[] = [
  { id: 'ubuntu-24.04', label: 'Ubuntu 24.04 LTS', subtitle: 'Default cloud-init image', category: 'Linux', icon: '🐧', featured: true },
  { id: 'ubuntu-22.04', label: 'Ubuntu 22.04 LTS', subtitle: 'Long-term support', category: 'Linux', icon: '🐧', featured: true },
  { id: 'debian-12', label: 'Debian 12', subtitle: 'Minimal stable server', category: 'Linux', icon: '🐧' },
  { id: 'rocky-9', label: 'Rocky Linux 9', subtitle: 'Enterprise Linux', category: 'Linux', icon: '🐧' },
  { id: 'alma-9', label: 'AlmaLinux 9', subtitle: 'RHEL-compatible', category: 'Linux', icon: '🐧' },
  { id: 'centos-stream-9', label: 'CentOS Stream 9', subtitle: 'RHEL upstream', category: 'Linux', icon: '🐧', featured: true },
  { id: 'fedora-40', label: 'Fedora 40', subtitle: 'Latest packages', category: 'Linux', icon: '🐧' },
  { id: 'rhel-9', label: 'RHEL 9 profile', subtitle: 'Rocky/Alma disk path', category: 'Linux', icon: '🐧' },
  { id: 'photon-os', label: 'Photon OS', subtitle: 'Container host appliance', category: 'Appliance', icon: '📦', featured: true },
  { id: 'nginx-proxy', label: 'Nginx proxy', subtitle: 'TLS & load balancing', category: 'Appliance', icon: '📦' },
  { id: 'wireguard-vpn', label: 'WireGuard VPN', subtitle: 'Secure remote access', category: 'Appliance', icon: '📦' },
  { id: 'postgresql-16', label: 'PostgreSQL 16', subtitle: 'Database appliance', category: 'Database', icon: '🗄️', featured: true },
  { id: 'mysql-8', label: 'MySQL 8', subtitle: 'InnoDB ready', category: 'Database', icon: '🗄️' },
  { id: 'mariadb-11', label: 'MariaDB 11', subtitle: 'MySQL-compatible', category: 'Database', icon: '🗄️' },
  { id: 'redis-7', label: 'Redis 7', subtitle: 'Cache node', category: 'Database', icon: '🗄️' },
  { id: 'gpu-worker', label: 'GPU worker', subtitle: 'CUDA / passthrough', category: 'Special', icon: '🎮', featured: true },
  { id: 'k8s-node', label: 'Kubernetes node', subtitle: 'containerd + kubeadm', category: 'Special', icon: '☸', featured: true },
  { id: 'ai-inference-node', label: 'AI inference', subtitle: 'Model serving stack', category: 'Special', icon: '🤖', featured: true },
  { id: 'windows-server-2022', label: 'Windows Server 2022', subtitle: 'UEFI + VirtIO', category: 'Windows', icon: '🪟', featured: true, windows: true },
  { id: 'windows-11', label: 'Windows 11', subtitle: 'Desktop / TPM', category: 'Windows', icon: '🪟', featured: true, windows: true },
  { id: 'custom-iso', label: 'Custom ISO', subtitle: 'Install from your image', category: 'Special', icon: '💿' },
]

export const OS_CATEGORIES = ['All', 'Linux', 'Windows', 'Database', 'Appliance', 'Special'] as const

export const SIZE_PRESETS = [
  { id: 'small', label: 'Small', cores: 2, memoryGiB: 4, diskGiB: 40, detail: 'Dev / CI' },
  { id: 'medium', label: 'Medium', cores: 4, memoryGiB: 8, diskGiB: 80, detail: 'General purpose' },
  { id: 'large', label: 'Large', cores: 8, memoryGiB: 16, diskGiB: 160, detail: 'Production' },
  { id: 'xlarge', label: 'X-Large', cores: 16, memoryGiB: 32, diskGiB: 320, detail: 'Heavy workloads' },
] as const

export const WIZARD_STEPS = ['Name', 'Operating system', 'Size', 'Network & review'] as const

export function cloudInitUserForOs(os: string): string {
  if (os.startsWith('debian')) return 'debian'
  if (os.startsWith('fedora')) return 'fedora'
  if (
    os.startsWith('rocky') ||
    os.startsWith('alma') ||
    os.startsWith('centos') ||
    os.startsWith('rhel')
  ) {
    return 'rocky'
  }
  return 'ubuntu'
}

export function osFlavorById(id: string): OsFlavor | undefined {
  return OS_FLAVORS.find((o) => o.id === id)
}

export type ApiTemplateLike = {
  name: string
  version: string
  description?: string | null
  category?: string | null
  os_family?: string | null
  featured?: boolean
  icon?: string | null
}

function categoryFromTemplate(t: ApiTemplateLike): OsFlavor['category'] {
  const c = (t.category ?? '').toLowerCase()
  if (c.includes('windows')) return 'Windows'
  if (c.includes('database')) return 'Database'
  if (c.includes('appliance')) return 'Appliance'
  const fam = (t.os_family ?? '').toLowerCase()
  if (fam === 'windows') return 'Windows'
  if (t.name.startsWith('windows')) return 'Windows'
  if (['postgresql', 'mysql', 'mariadb', 'redis'].some((d) => t.name.includes(d))) return 'Database'
  if (['nginx', 'wireguard', 'photon'].some((a) => t.name.includes(a))) return 'Appliance'
  if (['gpu', 'k8s', 'ai-'].some((s) => t.name.includes(s))) return 'Special'
  return 'Linux'
}

export function templateToFlavor(t: ApiTemplateLike): OsFlavor {
  const cat = categoryFromTemplate(t)
  return {
    id: t.name,
    label: t.description?.split('—')[0]?.trim() || t.name.replace(/-/g, ' '),
    subtitle: t.description ?? `${t.name}@${t.version}`,
    category: cat,
    icon: t.icon ?? (cat === 'Windows' ? '🪟' : cat === 'Database' ? '🗄️' : cat === 'Appliance' ? '📦' : '🐧'),
    featured: t.featured,
    windows: cat === 'Windows',
  }
}

/** Merge API templates with static fallbacks (custom-iso). */
export function buildOsFlavorList(templates: ApiTemplateLike[]): OsFlavor[] {
  const byId = new Map<string, OsFlavor>()
  for (const t of templates) {
    byId.set(t.name, templateToFlavor(t))
  }
  for (const f of OS_FLAVORS) {
    if (!byId.has(f.id)) byId.set(f.id, f)
  }
  return [...byId.values()].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return a.label.localeCompare(b.label)
  })
}

export function findTemplate(templates: ApiTemplateLike[], osId: string): ApiTemplateLike | undefined {
  return templates.find((t) => t.name === osId)
}

export type VmSpecNumbers = { cores: number; memory: string; disk: string }

export function sizeToSpec(size: string, custom?: { cores: number; memoryGiB: number; diskGiB: number }): VmSpecNumbers {
  if (size === 'custom' && custom) {
    return {
      cores: Math.max(1, custom.cores),
      memory: `${Math.max(1, custom.memoryGiB)}Gi`,
      disk: `${Math.max(10, custom.diskGiB)}Gi`,
    }
  }
  const preset = SIZE_PRESETS.find((p) => p.id === size)
  if (preset) {
    return { cores: preset.cores, memory: `${preset.memoryGiB}Gi`, disk: `${preset.diskGiB}Gi` }
  }
  switch (size) {
    case 'small':
      return { cores: 2, memory: '4Gi', disk: '40Gi' }
    case 'large':
      return { cores: 8, memory: '16Gi', disk: '160Gi' }
    case 'xlarge':
      return { cores: 16, memory: '32Gi', disk: '320Gi' }
    default:
      return { cores: 4, memory: '8Gi', disk: '80Gi' }
  }
}

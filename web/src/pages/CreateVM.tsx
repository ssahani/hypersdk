import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, Link } from 'react-router'
import { createVMWithProgress, getTemplates, VmTemplate, CreateVmRequest } from '../api/vm'
import { listNetworks, NetworkInfo } from '../api/network'
import { listIsos, listDiskImages, ImageFile, generateCloudInit, listSavedTemplates, listVirtBuilderTemplates, VirtBuilderTemplateRow, getVirtBuilderNotes, listMkosiWorkspaces, MkosiWorkspace } from '../api/extras'
import { startVirtImageBuildJob, streamJobLogs } from '../api/jobs'
import { BrowseHostPathModal, isHostDiskImageFileName, isIsoFileName } from '../components/BrowseHostPathModal'
import { useToastContext } from '../contexts/ToastContext'
import { ArrowLeft, Server, Layers, HardDrive, Cloud, Disc, Boxes, FileText, Check, FolderOpen, ChevronLeft, ChevronRight, RefreshCw, Hammer } from 'lucide-react'

function linesToList(s: string): string[] {
  return s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
}

/** Enough virt-install context to create without a classic install ISO (Cockpit-style options). */
function hasVirtInstallBootOrShell(f: CreateVmRequest): boolean {
  const pool = f.root_disk_storage_pool?.trim()
  const vol = f.root_disk_storage_volume?.trim()
  return Boolean(
    f.iso?.trim()
    || f.virt_install_define_only
    || f.virt_install_location?.trim()
    || f.virt_install_pxe
    || f.virt_install_install_os?.trim()
    || f.virt_install_disk_backing_store?.trim()
    || (pool && vol)
  )
}

// ── Distro logo SVGs ──────────────────────────────────────────────────────────

function FedoraLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="20" fill="#294172"/>
      {/* Fedora "f" — vertical bar + top bar + mid bar forming the F */}
      <rect x="11" y="10" width="5" height="20" rx="1.5" fill="white"/>
      <rect x="11" y="10" width="15" height="5" rx="1.5" fill="white"/>
      <rect x="11" y="19" width="12" height="4" rx="1.5" fill="white"/>
      {/* Fedora cyan accent — the loop on the right side */}
      <path d="M26 19 a5 5 0 1 1 0 5" stroke="#60A5FA" strokeWidth="3" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

function DebianLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="20" fill="#A21942"/>
      {/* Debian swirl — nested arcs approximating the famous swirl */}
      <path d="M20 8 a12 12 0 1 1-8.5 20.5" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M20 12 a8 8 0 1 1-5.5 13.5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"/>
      <path d="M20 16 a4 4 0 1 1-2.8 6.8" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/>
      <circle cx="20" cy="20" r="2" fill="white"/>
    </svg>
  )
}

function UbuntuLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="20" fill="#E95420"/>
      {/* Ubuntu circle of friends — 3 circles connected by arcs */}
      <circle cx="20" cy="10" r="3.5" fill="white"/>
      <circle cx="10" cy="27" r="3.5" fill="white"/>
      <circle cx="30" cy="27" r="3.5" fill="white"/>
      <path d="M20 13.5 A8.5 8.5 0 0 0 12 23.5" stroke="white" strokeWidth="2.2" fill="none"/>
      <path d="M20 13.5 A8.5 8.5 0 0 1 28 23.5" stroke="white" strokeWidth="2.2" fill="none"/>
      <path d="M13.5 26.5 A8.5 8.5 0 0 0 26.5 26.5" stroke="white" strokeWidth="2.2" fill="none"/>
    </svg>
  )
}

function AlmaLinuxLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="20" fill="#0F3B5E"/>
      {/* AlmaLinux — butterfly/shield stylised A */}
      <path d="M20 7 L9 33 H15 L20 21 L25 33 H31 Z" fill="#6DC8E8"/>
      <path d="M13 27 Q20 15 27 27" fill="#1A6FA8" opacity="0.6"/>
      <circle cx="20" cy="20" r="2.5" fill="#0F3B5E"/>
    </svg>
  )
}

function RockyLinuxLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="20" fill="#10522A"/>
      <path d="M20 8 L10 26 H17 L20 20 L23 26 H30 Z" fill="#10B981"/>
      <path d="M14 26 Q20 16 26 26 Z" fill="#6EE7B7" opacity="0.7"/>
    </svg>
  )
}

function OpenSUSELogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="20" fill="#1A5C2A"/>
      <path d="M20 9 a11 11 0 1 0 0.01 0Z" fill="none" stroke="#73BA25" strokeWidth="3"/>
      <path d="M15 20 a5 5 0 0 1 10 0 a5 5 0 0 1-10 0Z" fill="#73BA25"/>
      <circle cx="20" cy="20" r="2" fill="#1A5C2A"/>
    </svg>
  )
}

function GenericDistroLogo({ name, size }: { name: string; size: number }) {
  const letter = name.charAt(0).toUpperCase()
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="20" fill="#374151"/>
      <text x="20" y="26" textAnchor="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="system-ui,sans-serif">{letter}</text>
    </svg>
  )
}

// ── Distro metadata ───────────────────────────────────────────────────────────

interface DistroMeta {
  label: string
  version: string
  desc: string
  cardBg: string        // card background gradient
  borderIdle: string
  borderSelected: string
  ringSelected: string
  versionColor: string
  Logo: React.FC<{ size: number }>
}

function getDistroMeta(name: string): DistroMeta {
  const n = name.toLowerCase()

  if (n === 'fedora43')
    return { label: 'Fedora', version: '43', desc: 'Bleeding edge Linux', cardBg: 'bg-gradient-to-br from-blue-950/80 to-blue-900/40', borderIdle: 'border-blue-800/50', borderSelected: 'border-blue-400', ringSelected: 'ring-blue-500/40', versionColor: 'text-blue-400', Logo: FedoraLogo }
  if (n === 'fedora42')
    return { label: 'Fedora', version: '42', desc: 'Current stable release', cardBg: 'bg-gradient-to-br from-blue-950/70 to-blue-900/30', borderIdle: 'border-blue-800/50', borderSelected: 'border-blue-400', ringSelected: 'ring-blue-500/40', versionColor: 'text-blue-400', Logo: FedoraLogo }
  if (n === 'fedora41')
    return { label: 'Fedora', version: '41', desc: 'Previous stable release', cardBg: 'bg-gradient-to-br from-blue-950/60 to-blue-900/20', borderIdle: 'border-blue-800/40', borderSelected: 'border-blue-400', ringSelected: 'ring-blue-500/40', versionColor: 'text-blue-400', Logo: FedoraLogo }
  if (n === 'fedora41-minimal' || n.startsWith('fedora') && n.includes('minimal'))
    return { label: 'Fedora', version: '41 Minimal', desc: 'Slim — fewer packages', cardBg: 'bg-gradient-to-br from-blue-950/50 to-slate-900/40', borderIdle: 'border-blue-900/50', borderSelected: 'border-blue-400', ringSelected: 'ring-blue-500/40', versionColor: 'text-blue-300', Logo: FedoraLogo }
  if (n.startsWith('fedora'))
    return { label: 'Fedora', version: n.replace('fedora', 'F'), desc: '', cardBg: 'bg-gradient-to-br from-blue-950/70 to-blue-900/30', borderIdle: 'border-blue-800/50', borderSelected: 'border-blue-400', ringSelected: 'ring-blue-500/40', versionColor: 'text-blue-400', Logo: FedoraLogo }

  if (n === 'debian12')
    return { label: 'Debian', version: '12 Bookworm', desc: 'LTS — rock solid', cardBg: 'bg-gradient-to-br from-red-950/80 to-rose-900/30', borderIdle: 'border-red-900/50', borderSelected: 'border-red-400', ringSelected: 'ring-red-500/40', versionColor: 'text-red-400', Logo: DebianLogo }
  if (n === 'debian13')
    return { label: 'Debian', version: '13 Trixie', desc: 'Testing branch', cardBg: 'bg-gradient-to-br from-red-950/70 to-rose-900/20', borderIdle: 'border-red-900/50', borderSelected: 'border-red-400', ringSelected: 'ring-red-500/40', versionColor: 'text-red-300', Logo: DebianLogo }
  if (n.startsWith('debian'))
    return { label: 'Debian', version: n.replace('debian', 'Debian '), desc: '', cardBg: 'bg-gradient-to-br from-red-950/70 to-rose-900/20', borderIdle: 'border-red-900/50', borderSelected: 'border-red-400', ringSelected: 'ring-red-500/40', versionColor: 'text-red-400', Logo: DebianLogo }

  if (n === 'ubuntu2404' || n === 'ubuntu24.04')
    return { label: 'Ubuntu', version: '24.04 LTS', desc: 'Noble Numbat', cardBg: 'bg-gradient-to-br from-orange-950/80 to-amber-900/30', borderIdle: 'border-orange-800/50', borderSelected: 'border-orange-400', ringSelected: 'ring-orange-500/40', versionColor: 'text-orange-400', Logo: UbuntuLogo }
  if (n === 'ubuntu2204' || n === 'ubuntu22.04')
    return { label: 'Ubuntu', version: '22.04 LTS', desc: 'Jammy Jellyfish', cardBg: 'bg-gradient-to-br from-orange-950/70 to-amber-900/20', borderIdle: 'border-orange-800/50', borderSelected: 'border-orange-400', ringSelected: 'ring-orange-500/40', versionColor: 'text-orange-400', Logo: UbuntuLogo }
  if (n.startsWith('ubuntu'))
    return { label: 'Ubuntu', version: n.replace('ubuntu', 'Ubuntu '), desc: '', cardBg: 'bg-gradient-to-br from-orange-950/70 to-amber-900/20', borderIdle: 'border-orange-800/50', borderSelected: 'border-orange-400', ringSelected: 'ring-orange-500/40', versionColor: 'text-orange-400', Logo: UbuntuLogo }

  if (n.startsWith('almalinux') || n.startsWith('alma'))
    return { label: 'AlmaLinux', version: n.replace('almalinux', '').replace('alma', '') || '9', desc: 'RHEL Compatible', cardBg: 'bg-gradient-to-br from-cyan-950/80 to-sky-900/30', borderIdle: 'border-cyan-800/50', borderSelected: 'border-cyan-400', ringSelected: 'ring-cyan-500/40', versionColor: 'text-cyan-400', Logo: AlmaLinuxLogo }

  if (n.startsWith('rocky'))
    return { label: 'Rocky Linux', version: n.replace('rocky', '').replace('linux', '') || '9', desc: 'RHEL Compatible', cardBg: 'bg-gradient-to-br from-green-950/80 to-emerald-900/30', borderIdle: 'border-green-800/50', borderSelected: 'border-green-400', ringSelected: 'ring-green-500/40', versionColor: 'text-green-400', Logo: RockyLinuxLogo }

  if (n.startsWith('opensuse') || n.startsWith('suse'))
    return { label: 'openSUSE', version: n.includes('tumbleweed') ? 'Tumbleweed' : n.replace('opensuse', '').replace('suse', '') || 'Leap', desc: n.includes('tumbleweed') ? 'Rolling release' : 'Stable', cardBg: 'bg-gradient-to-br from-green-950/70 to-lime-900/20', borderIdle: 'border-green-800/50', borderSelected: 'border-lime-400', ringSelected: 'ring-lime-500/40', versionColor: 'text-lime-400', Logo: OpenSUSELogo }

  return { label: name, version: '', desc: '', cardBg: 'bg-gradient-to-br from-slate-800/60 to-slate-900/40', borderIdle: 'border-slate-700/50', borderSelected: 'border-slate-400', ringSelected: 'ring-slate-500/40', versionColor: 'text-slate-400', Logo: ({ size }) => <GenericDistroLogo name={name} size={size} /> }
}

type DiskMode = 'new' | 'existing' | 'virt_builder' | 'mkosi'

type CreateUiMode = 'wizard' | 'classic'

const WIZARD_STEP_LABELS = [
  'Basics',
  'CPU, RAM & OS',
  'Storage',
  'Network & install',
  'Review',
] as const

const WIZARD_LAST = WIZARD_STEP_LABELS.length - 1

function diskModeLabel(m: DiskMode): string {
  switch (m) {
    case 'new':
      return 'New disk (virt-install)'
    case 'existing':
      return 'Existing disk image'
    case 'mkosi':
      return 'mkosi workspace'
    case 'virt_builder':
      return 'virt-builder'
  }
}

function validateWizardStep(
  step: number,
  ctx: { form: CreateVmRequest; diskMode: DiskMode; goldenSaved: boolean },
): string | null {
  const { form, diskMode, goldenSaved } = ctx
  switch (step) {
    case 0:
      if (!form.name.trim()) return 'VM name is required.'
      return null
    case 1:
      return null
    case 2:
      if (diskMode === 'existing' && !form.existing_disk?.trim()) {
        return 'Choose or enter an existing disk image path.'
      }
      if (diskMode === 'virt_builder') {
        if (!form.virt_builder_os?.trim()) return 'Enter a virt-builder OS template (e.g. ubuntu-22.04).'
        if (goldenSaved) return 'Clear the golden saved template or switch away from virt-builder.'
      }
      if (diskMode === 'mkosi') {
        if (!form.mkosi_workspace?.trim()) {
          return 'Enter the mkosi workspace directory (absolute path with mkosi.conf).'
        }
        if (goldenSaved) return 'Clear the golden saved template or switch away from mkosi.'
      }
      return null
    case 3: {
      if (diskMode === 'new' && form.create_backend === 'virt_install' && !hasVirtInstallBootOrShell(form)) {
        return 'Set an install ISO or use Advanced virt-install / Native libvirt XML.'
      }
      const pPool = form.root_disk_storage_pool?.trim()
      const pVol = form.root_disk_storage_volume?.trim()
      if ((pPool && !pVol) || (!pPool && pVol)) {
        return 'Set both root disk pool and volume name, or leave both empty.'
      }
      return null
    }
    default:
      return null
  }
}

/** Fedora mkosi workspaces (bundled e.g. fedora43, or any path whose last segment starts with fedora). */
function isFedoraMkosiPath(path: string): boolean {
  const seg = (path.split('/').pop() || path).toLowerCase()
  return seg.startsWith('fedora') || /\/fedora/i.test(path)
}

/** Defaults used successfully for Fedora Bootable=yes / systemd-boot images (UEFI + headroom). */
const FEDORA_MKOSI_DEFAULTS: Pick<CreateVmRequest, 'vcpus' | 'memory_mb' | 'disk_gb' | 'firmware'> = {
  vcpus: 2,
  memory_mb: 2048,
  disk_gb: 20,
  firmware: 'uefi',
}

function fedoraMkosiOsVariant(path: string): string {
  const seg = (path.split('/').pop() || path).toLowerCase()
  const m = seg.match(/^fedora(\d+)/)
  if (m) return `fedora${m[1]}`
  const m2 = path.toLowerCase().match(/fedora(\d+)/)
  return m2 ? `fedora${m2[1]}` : 'fedora43'
}

function mkosiPathDefaults(path: string): Partial<CreateVmRequest> {
  if (!isFedoraMkosiPath(path.trim())) return {}
  return { ...FEDORA_MKOSI_DEFAULTS, os_variant: fedoraMkosiOsVariant(path.trim()) }
}

/** Guest OS variants that default to SPICE+QXL (`graphics_type` → server XML in core `create.rs`). */
function isWindowsOsVariant(os: string | undefined): boolean {
  if (!os?.trim()) return false
  const v = os.trim().toLowerCase()
  return v.startsWith('win') || /\bwindows\b/.test(v)
}

/** Common `virt-install --os-variant` ids (alphanumeric + dot/underscore/hyphen per server validation). */
const OS_VARIANT_PRESETS: { value: string; label: string }[] = [
  { value: 'generic', label: 'generic — any Linux' },
  { value: 'win11', label: 'Windows 11' },
  { value: 'win10', label: 'Windows 10' },
  { value: 'win2k25', label: 'Windows Server 2025 (win2k25)' },
  { value: 'win2k22', label: 'Windows Server 2022' },
  { value: 'win2k19', label: 'Windows Server 2019' },
  { value: 'win2k16', label: 'Windows Server 2016' },
  { value: 'win8.1', label: 'Windows 8.1' },
  { value: 'win8', label: 'Windows 8' },
  { value: 'win7', label: 'Windows 7' },
  { value: 'almalinux9', label: 'AlmaLinux 9' },
  { value: 'centosstream9', label: 'CentOS Stream 9' },
  { value: 'debian12', label: 'Debian 12 (bookworm)' },
  { value: 'debian13', label: 'Debian 13 (trixie)' },
  { value: 'fedora40', label: 'Fedora 40' },
  { value: 'fedora41', label: 'Fedora 41' },
  { value: 'fedora42', label: 'Fedora 42' },
  { value: 'fedora43', label: 'Fedora 43' },
  { value: 'ubuntu22.04', label: 'Ubuntu 22.04 LTS' },
  { value: 'ubuntu24.04', label: 'Ubuntu 24.04 LTS' },
  { value: 'opensuse15.6', label: 'openSUSE Leap 15.6' },
  { value: 'opensuseTumbleweed', label: 'openSUSE Tumbleweed' },
  { value: 'rockylinux9', label: 'Rocky Linux 9' },
]

export default function CreateVMPage() {
  const [form, setForm] = useState<CreateVmRequest>({
    name: '',
    vcpus: 1,
    memory_mb: 1024,
    disk_gb: 10,
    network: 'default',
    os_variant: 'generic',
    firmware: 'uefi',
    graphics_type: 'vnc',
    template_disk_mode: 'backing',
    saved_template: '',
    create_backend: 'virt_install',
    virt_builder_os: '',
    virt_builder_hostname: '',
    virt_builder_ssh_pubkey: '',
    virt_builder_root_password_file: '',
    virt_builder_selinux_relabel: false,
    virt_builder_sysprep: false,
    mkosi_workspace: '',
    mkosi_image: '',
    virt_install_define_only: false,
    virt_install_location: '',
    virt_install_pxe: false,
    virt_install_pxe_network: '',
    virt_install_install_os: '',
    virt_install_extra_args: '',
    root_disk_storage_pool: '',
    root_disk_storage_volume: '',
    virt_install_path_in_use_check_off: false,
    virt_install_disk_backing_store: '',
  })
  const [diskMode, setDiskMode] = useState<DiskMode>('new')
  const [mkosiWorkspaces, setMkosiWorkspaces] = useState<MkosiWorkspace[]>([])
  const [vbItems, setVbItems] = useState<VirtBuilderTemplateRow[]>([])
  const [vbCatalogFilter, setVbCatalogFilter] = useState('')
  const [vbCatalogMeta, setVbCatalogMeta] = useState<{ cached?: boolean; cacheAgeSecs?: number }>({})
  const [vbPkgLines, setVbPkgLines] = useState('')
  const [vbFirstbootLines, setVbFirstbootLines] = useState('')
  const [vbPostInstLines, setVbPostInstLines] = useState('')
  const [vbPostRunLines, setVbPostRunLines] = useState('')
  const [vbNotesText, setVbNotesText] = useState<string | null>(null)
  /** Optional pre-build via POST /browse/virt-image-build (same template list as above). */
  const [vibOutputPath, setVibOutputPath] = useState('')
  const [vibSizeStr, setVibSizeStr] = useState('20G')
  const [vibFormatStr, setVibFormatStr] = useState('qcow2')
  const [vibHostnameOverride, setVibHostnameOverride] = useState('')
  const [vibRootPwInline, setVibRootPwInline] = useState('')
  const [vibFirstbootHostPath, setVibFirstbootHostPath] = useState('')
  const [vibUpdate, setVibUpdate] = useState(false)
  const [vibBuilding, setVibBuilding] = useState(false)
  const [vibJobId, setVibJobId] = useState<string | null>(null)
  const [vibJobLogs, setVibJobLogs] = useState<string[]>([])
  const [vmCreateJobId, setVmCreateJobId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<VmTemplate[]>([])
  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [isoFiles, setIsoFiles] = useState<ImageFile[]>([])
  const [isoBrowseOpen, setIsoBrowseOpen] = useState(false)
  const [existingDiskBrowseOpen, setExistingDiskBrowseOpen] = useState(false)
  const [diskFiles, setDiskFiles] = useState<ImageFile[]>([])
  const [savedTemplates, setSavedTemplates] = useState<VmTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [createLog, setCreateLog] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)
  const isoPathRef = useRef<HTMLInputElement>(null)
  const [showCloudInit, setShowCloudInit] = useState(false)
  const [createUiMode, setCreateUiMode] = useState<CreateUiMode>('classic')
  const [wizardStep, setWizardStep] = useState(0)
  const [ciUser, setCiUser] = useState('')
  const [ciPass, setCiPass] = useState('')
  const [ciSshKey, setCiSshKey] = useState('')
  const toast = useToastContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (createLog.length) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [createLog])

  useEffect(() => {
    if (createUiMode !== 'wizard') return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [wizardStep])

  useEffect(() => {
    if (!vibJobId) {
      setVibJobLogs([])
      return
    }
    const ac = new AbortController()
    let cancelled = false
    setVibJobLogs([])
    setVibBuilding(true)
    ;(async () => {
      try {
        await streamJobLogs(vibJobId, {
          signal: ac.signal,
          onLogChunk: (chunk) => {
            if (cancelled) return
            const lines = chunk.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0)
            if (lines.length) setVibJobLogs((p) => [...p, ...lines])
          },
          onComplete: (data) => {
            if (cancelled) return
            let path: string | undefined
            try {
              const j = JSON.parse(data) as { path?: string }
              path = j.path
            } catch {
              /* ignore */
            }
            toast.success(path ? `Disk image built: ${path}` : 'Disk image build completed')
            setVibRootPwInline('')
            listDiskImages()
              .then((r) => setDiskFiles(r.files))
              .catch(() => {})
            if (path) {
              setDiskMode('existing')
              setForm((f) => ({ ...f, existing_disk: path! }))
            }
          },
          onError: (msg) => {
            if (!cancelled) toast.error(msg || 'virt-image-build failed')
          },
        })
      } catch (e: unknown) {
        if (!cancelled && (e as Error)?.name !== 'AbortError') {
          toast.error(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setVibBuilding(false)
      }
    })()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [vibJobId, toast])

  useEffect(() => {
    getTemplates().then(setTemplates).catch(() => {})
    listSavedTemplates().then(setSavedTemplates).catch(() => {})
    listNetworks().then(setNetworks).catch(() => {})
    listIsos().then((r) => setIsoFiles(r.files)).catch(() => {})
    listDiskImages().then((r) => setDiskFiles(r.files)).catch(() => {})
    listVirtBuilderTemplates()
      .then((r) => {
        setVbCatalogMeta({ cached: r.cached, cacheAgeSecs: r.cache_age_secs ?? undefined })
        setVbItems(r.items?.length ? r.items : (r.templates || []).map((name) => ({ name })))
      })
      .catch(() => {
        setVbItems([])
        setVbCatalogMeta({})
      })
    listMkosiWorkspaces().then(setMkosiWorkspaces).catch(() => setMkosiWorkspaces([]))
  }, [])

  const hadWindowsOsRef = useRef(false)

  useEffect(() => {
    const win = isWindowsOsVariant(form.os_variant)
    const wasWin = hadWindowsOsRef.current
    setForm((prev) => {
      let graphics_type = prev.graphics_type || 'vnc'
      if (win) graphics_type = 'spice'
      else if (wasWin && !win) graphics_type = 'vnc'
      if (prev.graphics_type === graphics_type) return prev
      return { ...prev, graphics_type }
    })
    hadWindowsOsRef.current = win
  }, [form.os_variant])

  const applyTemplate = (tmpl: VmTemplate, opts: { saved: boolean }) => {
    if ((diskMode === 'virt_builder' || diskMode === 'mkosi') && tmpl.base_image) {
      toast.warning('Golden saved templates are not compatible with image-build modes. Switch storage mode or pick a template without a golden disk.')
      return
    }
    setSelectedTemplate(tmpl.name)
    setForm((f) => ({
      ...f,
      vcpus: tmpl.vcpus,
      memory_mb: tmpl.memory_mb,
      disk_gb: tmpl.disk_gb,
      os_variant: tmpl.os_variant,
      saved_template: opts.saved ? tmpl.name : '',
      template_disk_mode: f.template_disk_mode || 'backing',
    }))
  }

  const goldenSaved = savedTemplates.find((t) => t.name === form.saved_template && t.base_image)

  const vbFiltered = useMemo(() => {
    const q = vbCatalogFilter.trim().toLowerCase()
    if (!q) return vbItems
    return vbItems.filter((i) => {
      if (i.name.toLowerCase().includes(q)) return true
      if ((i.summary ?? '').toLowerCase().includes(q)) return true
      if ((i.arch ?? '').toLowerCase().includes(q)) return true
      return false
    })
  }, [vbItems, vbCatalogFilter])

  const refreshVirtBuilderCatalog = () => {
    listVirtBuilderTemplates({ refresh: true })
      .then((r) => {
        setVbCatalogMeta({ cached: r.cached, cacheAgeSecs: r.cache_age_secs ?? undefined })
        setVbItems(r.items?.length ? r.items : (r.templates || []).map((name) => ({ name })))
        toast.info('virt-builder catalog refreshed')
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : String(e))
      })
  }

  const stepVisible = (step: number) =>
    createUiMode === 'classic' || wizardStep === step

  const goWizardNext = () => {
    const err = validateWizardStep(wizardStep, { form, diskMode, goldenSaved: !!goldenSaved })
    if (err) {
      toast.warning(err)
      return
    }
    setWizardStep((s) => Math.min(WIZARD_LAST, s + 1))
  }

  const goWizardBack = () => setWizardStep((s) => Math.max(0, s - 1))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (createUiMode === 'wizard' && wizardStep !== WIZARD_LAST) return
    if (!form.name.trim()) { toast.warning('Name is required'); return }
    if (diskMode === 'new' && form.create_backend === 'virt_install' && !hasVirtInstallBootOrShell(form)) {
      toast.warning('Set an install ISO (absolute path), or use Advanced virt-install (define-only halted VM, --location, PXE, --install os=…, backing image, or pool/volume root disk). Or switch Create engine to Native libvirt XML for an empty disk.')
      return
    }
    const pPool = form.root_disk_storage_pool?.trim()
    const pVol = form.root_disk_storage_volume?.trim()
    if ((pPool && !pVol) || (!pPool && pVol)) {
      toast.warning('Set both root disk pool and volume name, or leave both empty.')
      return
    }
    if (diskMode === 'existing' && !form.existing_disk?.trim()) { toast.warning('Existing disk path is required'); return }
    if (diskMode === 'virt_builder') {
      if (!form.virt_builder_os?.trim()) { toast.warning('virt-builder OS name is required (e.g. ubuntu-22.04)'); return }
      if (goldenSaved) { toast.warning('Clear the golden saved template or switch to New disk / Existing disk'); return }
    }
    if (diskMode === 'mkosi') {
      if (!form.mkosi_workspace?.trim()) {
        toast.warning('Set mkosi workspace: absolute hypervisor path to a folder containing mkosi.conf. Distro comes from that recipe, not Guest OS hint.')
        return
      }
      if (goldenSaved) { toast.warning('Clear the golden saved template or switch to New disk / Existing disk'); return }
    }
    setSubmitting(true)
    setCreateLog([])
    setVmCreateJobId(null)
    try {
      // Generate cloud-init ISO if configured
      let cloudInitIso: string | undefined
      if (showCloudInit && (ciUser || ciSshKey)) {
        try {
          const ciResult = await generateCloudInit(form.name, ciUser, ciPass, ciSshKey)
          cloudInitIso = ciResult.path
          toast.info(`Cloud-init ISO created: ${ciResult.path}`)
        } catch (e: unknown) {
          toast.error(`Cloud-init failed: ${e instanceof Error ? e.message : e}`)
          setSubmitting(false)
          return
        }
      }
      const req = { ...form }
      if (!req.os_variant?.trim()) req.os_variant = 'generic'
      if (cloudInitIso) { req.cloud_init_iso = cloudInitIso }
      if (diskMode === 'new') { req.existing_disk = '' }
      else if (diskMode === 'existing') { req.disk_gb = 0 }
      else if (diskMode === 'virt_builder' || diskMode === 'mkosi') {
        req.existing_disk = ''
        req.iso = ''
      }
      const gl = req.graphics_listen?.trim()
      if (!gl || gl === '127.0.0.1') { delete req.graphics_listen }
      const gtype = req.graphics_type?.trim().toLowerCase()
      if (!gtype || gtype === 'vnc') { delete req.graphics_type }
      const cb = req.create_backend?.trim()
      if (!cb) { delete req.create_backend }
      const st = req.saved_template?.trim()
      if (!st) {
        delete req.saved_template
        delete req.template_disk_mode
      } else {
        const hasGolden = savedTemplates.some((t) => t.name === st && !!t.base_image)
        if (!hasGolden) {
          delete req.template_disk_mode
        } else if (req.template_disk_mode === 'backing') {
          delete req.template_disk_mode
        }
      }
      if (diskMode !== 'virt_builder' && diskMode !== 'mkosi') {
        delete req.virt_builder_os
        delete req.virt_builder_hostname
        delete req.virt_builder_ssh_pubkey
        delete req.virt_builder_root_password_file
        delete req.virt_builder_packages
        delete req.virt_builder_firstboot_commands
        delete req.virt_builder_selinux_relabel
        delete req.virt_builder_post_customize_install
        delete req.virt_builder_post_customize_run
        delete req.virt_builder_sysprep
        delete req.mkosi_workspace
        delete req.mkosi_image
      } else if (diskMode === 'virt_builder') {
        delete req.mkosi_workspace
        const vh = req.virt_builder_hostname?.trim()
        if (!vh) { delete req.virt_builder_hostname }
        const vpk = req.virt_builder_ssh_pubkey?.trim()
        if (!vpk) { delete req.virt_builder_ssh_pubkey }
        const vpf = req.virt_builder_root_password_file?.trim()
        if (!vpf) { delete req.virt_builder_root_password_file }
        const pkgs = linesToList(vbPkgLines)
        const fb = linesToList(vbFirstbootLines)
        const pci = linesToList(vbPostInstLines)
        const pcr = linesToList(vbPostRunLines)
        if (pkgs.length) { req.virt_builder_packages = pkgs } else { delete req.virt_builder_packages }
        if (fb.length) { req.virt_builder_firstboot_commands = fb } else { delete req.virt_builder_firstboot_commands }
        if (pci.length) { req.virt_builder_post_customize_install = pci } else { delete req.virt_builder_post_customize_install }
        if (pcr.length) { req.virt_builder_post_customize_run = pcr } else { delete req.virt_builder_post_customize_run }
        if (!req.virt_builder_selinux_relabel) { delete req.virt_builder_selinux_relabel }
        if (!req.virt_builder_sysprep) { delete req.virt_builder_sysprep }
      } else if (diskMode === 'mkosi') {
        delete req.virt_builder_os
        delete req.virt_builder_hostname
        delete req.virt_builder_ssh_pubkey
        delete req.virt_builder_root_password_file
        delete req.virt_builder_packages
        delete req.virt_builder_firstboot_commands
        delete req.virt_builder_selinux_relabel
        delete req.virt_builder_post_customize_install
        delete req.virt_builder_post_customize_run
        delete req.virt_builder_sysprep
        const m = req.mkosi_workspace?.trim()
        if (!m) { delete req.mkosi_workspace }
        const mi = req.mkosi_image?.trim()
        if (!mi) { delete req.mkosi_image }
      }
      const backendEff = (req.create_backend ?? 'virt_install').trim()
      if (diskMode === 'virt_builder' || diskMode === 'mkosi' || backendEff === 'libvirt_xml') {
        delete req.virt_install_define_only
        delete req.virt_install_location
        delete req.virt_install_pxe
        delete req.virt_install_pxe_network
        delete req.virt_install_install_os
        delete req.virt_install_extra_args
        delete req.root_disk_storage_pool
        delete req.root_disk_storage_volume
        delete req.virt_install_path_in_use_check_off
        delete req.virt_install_disk_backing_store
      } else {
        if (!req.virt_install_define_only) delete req.virt_install_define_only
        if (!req.virt_install_pxe) delete req.virt_install_pxe
        if (!req.virt_install_path_in_use_check_off) delete req.virt_install_path_in_use_check_off
        const li = req.virt_install_location?.trim()
        if (li) req.virt_install_location = li
        else delete req.virt_install_location
        const pn = req.virt_install_pxe_network?.trim()
        if (pn) req.virt_install_pxe_network = pn
        else delete req.virt_install_pxe_network
        const ios = req.virt_install_install_os?.trim()
        if (ios) req.virt_install_install_os = ios
        else delete req.virt_install_install_os
        const ex = req.virt_install_extra_args?.trim()
        if (ex) req.virt_install_extra_args = ex
        else delete req.virt_install_extra_args
        const rp = req.root_disk_storage_pool?.trim()
        const rv = req.root_disk_storage_volume?.trim()
        if (rp && rv) {
          req.root_disk_storage_pool = rp
          req.root_disk_storage_volume = rv
        } else {
          delete req.root_disk_storage_pool
          delete req.root_disk_storage_volume
        }
        const bs = req.virt_install_disk_backing_store?.trim()
        if (bs) req.virt_install_disk_backing_store = bs
        else delete req.virt_install_disk_backing_store
      }
      await createVMWithProgress(
        req,
        (line) => {
          setCreateLog((prev) => [...prev, line])
        },
        (job) => {
          setVmCreateJobId(job.id)
          toast.info(
            `Create VM job ${job.id.slice(0, 8)}… — open Jobs to follow if you leave this page.`,
            7000,
          )
        },
      )
      toast.success(`Created VM '${form.name}'`)
      navigate('/vms')
    } catch (e: unknown) {
      toast.error(`Failed to create VM: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`mx-auto space-y-6 animate-fade-in ${createUiMode === 'wizard' ? 'max-w-3xl' : 'max-w-2xl'}`}>
      <div className="flex items-center gap-4">
        <Link to="/vms" className="p-2 hover:bg-slate-700 rounded transition" aria-label="Back"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold">Create Virtual Machine</h1>
      </div>

      {/* Templates (wizard: Basics step only) */}
      {(createUiMode === 'classic' || wizardStep === 0) && (templates.length > 0 || savedTemplates.length > 0) && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Layers className="w-5 h-5 text-blue-500" /> Templates</h3>
          {templates.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {templates.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => applyTemplate(t, { saved: false })}
                  className={`p-3 rounded-lg border text-left text-sm transition ${selectedTemplate === t.name ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700/50 hover:border-slate-600'}`}
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{t.vcpus} vCPU &middot; {t.memory_mb} MB &middot; {t.disk_gb} GB</div>
                </button>
              ))}
            </div>
          )}
          {savedTemplates.length > 0 && (
            <>
              <label className="block text-sm text-slate-400 mt-4">Saved templates (golden disk when captured)</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {savedTemplates.map((t) => (
                  <button key={t.name} type="button" onClick={() => applyTemplate(t, { saved: true })}
                    className={`p-3 rounded-lg border text-left text-sm transition ${
                      selectedTemplate === t.name ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700/50 hover:border-slate-600'
                    }`}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{t.name}</span>
                      <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[9px] font-medium">saved</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{t.vcpus} vCPU &middot; {t.memory_mb} MB &middot; {t.disk_gb} GB</div>
                    {t.base_image ? (
                      <div className="text-[10px] text-amber-400/90 mt-1 truncate" title={t.base_image}>golden: {t.base_image}</div>
                    ) : null}
                  </button>
                ))}
              </div>
            </>
          )}
          {goldenSaved ? (
            <div className="mt-4 space-y-2">
              <label className="block text-sm text-slate-400">Clone from golden image</label>
              <select
                className="input-field max-w-md"
                value={form.template_disk_mode || 'backing'}
                onChange={(e) => setForm({ ...form, template_disk_mode: e.target.value })}
              >
                <option value="backing">Fast clone (qcow2 backing file)</option>
                <option value="copy">Full copy (standalone qcow2)</option>
              </select>
              <p className="text-xs text-slate-500">The server creates a new disk under the default pool before defining the VM.</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Server className="w-5 h-5 text-green-500" /> Configuration</h3>
          <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 hidden sm:block text-right">Layout</span>
            <div className="inline-flex rounded-lg border border-slate-600 p-0.5 bg-slate-900/60 self-start sm:self-end">
              <button
                type="button"
                onClick={() => { setCreateUiMode('wizard'); setWizardStep(0) }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${createUiMode === 'wizard' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Wizard
              </button>
              <button
                type="button"
                onClick={() => { setCreateUiMode('classic'); setWizardStep(0) }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${createUiMode === 'classic' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Single page
              </button>
            </div>
          </div>
        </div>
        {createUiMode === 'wizard' && (
          <nav className="flex flex-wrap gap-1.5" aria-label="Create VM wizard steps">
            {WIZARD_STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition ${
                  i === wizardStep
                    ? 'bg-blue-600/90 text-white border-blue-500/80'
                    : i < wizardStep
                      ? 'bg-slate-600/80 text-slate-100 border-slate-500/50'
                      : 'bg-slate-900/60 text-slate-500 border-slate-700/60'
                }`}
                aria-current={i === wizardStep ? 'step' : undefined}
              >
                {i + 1}. {label}
              </span>
            ))}
          </nav>
        )}

        {stepVisible(0) && (
        <>
        <div>
          <label htmlFor="create-backend" className="block text-sm text-slate-400 mb-1">Create engine</label>
          <select
            id="create-backend"
            className="input-field"
            value={form.create_backend || ''}
            onChange={(e) => setForm({ ...form, create_backend: e.target.value })}
          >
            <option value="">Server default (virt_install unless config says otherwise)</option>
            <option value="libvirt_xml">Native libvirt XML (virtspawn)</option>
            <option value="virt_install">virt-install (hyper2kvm-style)</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">Use virt-install for libvirt&apos;s installer flow; use native XML for full graphics, cloud-init CD layout, and UEFI XML control.</p>
        </div>

        <div>
          <label htmlFor="vm-name" className="block text-sm text-slate-400 mb-1">VM Name *</label>
          <input id="vm-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="my-vm" />
        </div>
        </>
        )}

        {stepVisible(1) && (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="vm-vcpus" className="block text-sm text-slate-400 mb-1">vCPUs</label>
            <input id="vm-vcpus" type="number" min={1} max={256} value={form.vcpus} onChange={(e) => setForm({ ...form, vcpus: parseInt(e.target.value) || 1 })} className="input-field" />
          </div>
          <div>
            <label htmlFor="vm-memory" className="block text-sm text-slate-400 mb-1">Memory (MB)</label>
            <input id="vm-memory" type="number" min={64} value={form.memory_mb} onChange={(e) => setForm({ ...form, memory_mb: parseInt(e.target.value) || 1024 })} className="input-field" />
          </div>
          <div>
            <label htmlFor="vm-firmware" className="block text-sm text-slate-400 mb-1">Firmware</label>
            <select id="vm-firmware" value={form.firmware || 'uefi'} onChange={(e) => setForm({ ...form, firmware: e.target.value })} className="input-field">
              <option value="bios">BIOS</option>
              <option value="uefi">UEFI</option>
            </select>
            {diskMode === 'mkosi' && (
              <p className="text-xs text-slate-500 mt-1">Bootable mkosi images (e.g. Fedora in <code className="text-slate-500">contrib/mkosi-defs</code>) use GPT + systemd-boot and need UEFI. BIOS shows only SeaBIOS with no disk boot.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-600/40 bg-slate-900/30 p-3 space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[14rem]">
              <label htmlFor="vm-os-variant" className="block text-sm text-slate-400 mb-1">Guest OS hint (<code className="text-slate-500">os_variant</code>)</label>
              <select
                id="vm-os-variant"
                className="input-field"
                value={OS_VARIANT_PRESETS.some((o) => o.value === form.os_variant) ? form.os_variant : '__custom__'}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '__custom__') {
                    setForm({ ...form, os_variant: '' })
                    return
                  }
                  setForm({ ...form, os_variant: v })
                }}
              >
                {OS_VARIANT_PRESETS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
            </div>
            {!OS_VARIANT_PRESETS.some((o) => o.value === form.os_variant) && (
              <div className="flex-1 min-w-[12rem]">
                <label htmlFor="vm-os-variant-custom" className="block text-sm text-slate-400 mb-1">Custom value</label>
                <input
                  id="vm-os-variant-custom"
                  type="text"
                  className="input-field font-mono text-sm"
                  value={form.os_variant}
                  onChange={(e) => setForm({ ...form, os_variant: e.target.value })}
                  placeholder="e.g. archlinux, win11"
                  spellCheck={false}
                />
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {diskMode === 'mkosi' ? (
              <>
                <strong className="text-slate-400">mkosi:</strong> Fedora, Debian, Ubuntu, etc. come from your workspace&apos;s{' '}
                <code className="text-slate-400">mkosi.conf</code> (see{' '}
                <a href="https://mkosi.systemd.io/distribution-policy.html" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">mkosi distribution docs</a>
                ). This field does <em>not</em> change what <code className="text-slate-400">mkosi build</code> produces; it sets <code className="text-slate-400">os_variant</code> on the API for the{' '}
                <strong className="text-slate-400">virt-install</strong> create engine and related metadata. Native XML mode currently uses a fixed guest OS block; you can still align this hint for when you switch engine or use templates.
              </>
            ) : diskMode === 'virt_builder' ? (
              <>
                <strong className="text-slate-400">virt-builder:</strong> the real distro is the <strong className="text-slate-400">OS template</strong> under Storage. Use this for <code className="text-slate-400">virt-install</code> / libvirt hints when the create engine is virt-install.
              </>
            ) : (
              <>
                Matches <code className="text-slate-400">virt-install --os-variant</code> when the create engine is <strong className="text-slate-400">virt-install</strong>. Choose <strong className="text-slate-400">generic</strong> if unsure.
              </>
            )}
          </p>
        </div>
        </>
        )}

        {stepVisible(2) && (
        <>
        {/* Disk Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Storage</span>
          </div>
          <p className="text-xs text-slate-500 -mt-1">Default: <strong className="text-slate-400 font-medium">New disk + virt-install</strong> — set an install ISO, or open <strong className="text-slate-400">Advanced virt-install</strong> below for define-only, kickstart <code className="text-slate-400">--location</code>, PXE, <code className="text-slate-400">--install os=…</code>, backing qcow2, or a pool volume root disk. <strong className="text-slate-400">Native libvirt XML</strong> is for empty disks without those options. <strong className="text-slate-400">mkosi</strong> builds pre-baked images; <code className="text-slate-500">install.sh</code> can install upstream mkosi (v16+) to <code className="text-slate-500">/usr/local/bin</code> when needed.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({
                  ...f,
                  create_backend: 'virt_install',
                  virt_builder_os: '',
                  mkosi_workspace: '',
                  mkosi_image: '',
                  virt_builder_hostname: '',
                  virt_builder_ssh_pubkey: '',
                  virt_builder_root_password_file: '',
                  virt_builder_selinux_relabel: false,
                  virt_builder_sysprep: false,
                }))
                setVbPkgLines(''); setVbFirstbootLines(''); setVbPostInstLines(''); setVbPostRunLines(''); setVbNotesText(null)
                setDiskMode('new')
              }}
              className={`px-3 py-1.5 rounded text-xs transition ${diskMode === 'new' ? 'bg-blue-600 text-white ring-1 ring-blue-400/50' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              New disk (virt-install)
            </button>
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({
                  ...f,
                  create_backend: 'virt_install',
                  virt_builder_os: '',
                  mkosi_workspace: '',
                  mkosi_image: '',
                  virt_builder_hostname: '',
                  virt_builder_ssh_pubkey: '',
                  virt_builder_root_password_file: '',
                  virt_builder_selinux_relabel: false,
                  virt_builder_sysprep: false,
                }))
                setVbPkgLines(''); setVbFirstbootLines(''); setVbPostInstLines(''); setVbPostRunLines(''); setVbNotesText(null)
                setDiskMode('existing')
              }}
              className={`px-3 py-1.5 rounded text-xs transition ${diskMode === 'existing' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Existing disk
            </button>
            <button
              type="button"
              onClick={() => {
                if (goldenSaved) {
                  setForm((f) => ({ ...f, saved_template: '', template_disk_mode: 'backing' }))
                  setSelectedTemplate('')
                  toast.info('Cleared golden saved template for mkosi.')
                }
                setForm((f) => ({
                  ...f,
                  create_backend: 'virt_install',
                  virt_builder_os: '',
                  virt_builder_hostname: '',
                  virt_builder_ssh_pubkey: '',
                  virt_builder_root_password_file: '',
                  virt_builder_selinux_relabel: false,
                  virt_builder_sysprep: false,
                }))
                setVbPkgLines(''); setVbFirstbootLines(''); setVbPostInstLines(''); setVbPostRunLines(''); setVbNotesText(null)
                setDiskMode('mkosi')
              }}

              className={`px-3 py-1.5 rounded text-xs transition ${diskMode === 'mkosi' ? 'bg-blue-600 text-white ring-1 ring-blue-400/50' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              mkosi workspace (optional)
            </button>
            <button
              type="button"
              onClick={() => {
                if (goldenSaved) {
                  setForm((f) => ({ ...f, saved_template: '', template_disk_mode: 'backing' }))
                  setSelectedTemplate('')
                  toast.info('Cleared golden saved template for virt-builder.')
                }
                setForm((f) => ({
                  ...f,
                  create_backend: 'virt_install',
                  mkosi_workspace: '',
                  mkosi_image: '',
                  virt_builder_hostname: '',
                  virt_builder_ssh_pubkey: '',
                  virt_builder_root_password_file: '',
                  virt_builder_selinux_relabel: false,
                  virt_builder_sysprep: false,
                }))
                setVbPkgLines(''); setVbFirstbootLines(''); setVbPostInstLines(''); setVbPostRunLines(''); setVbNotesText(null)
                setDiskMode('virt_builder')
              }}
              className={`px-3 py-1.5 rounded text-xs transition flex items-center gap-1 ${diskMode === 'virt_builder' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              <Boxes className="w-3.5 h-3.5" /> virt-builder
            </button>
            <button
              type="button"
              onClick={() => {
                if (goldenSaved) {
                  setForm((f) => ({ ...f, saved_template: '', template_disk_mode: 'backing' }))
                  setSelectedTemplate('')
                  toast.info('Cleared golden saved template for ISO install.')
                }
                setForm((f) => ({
                  ...f,
                  create_backend: 'virt_install',
                  mkosi_workspace: '',
                  mkosi_image: '',
                  virt_builder_os: '',
                  virt_builder_hostname: '',
                  virt_builder_ssh_pubkey: '',
                  virt_builder_root_password_file: '',
                  virt_builder_selinux_relabel: false,
                  virt_builder_sysprep: false,
                  existing_disk: '',
                  disk_gb: f.disk_gb >= 8 ? f.disk_gb : 20,
                }))
                setVbPkgLines('')
                setVbFirstbootLines('')
                setVbPostInstLines('')
                setVbPostRunLines('')
                setVbNotesText(null)
                setDiskMode('new')
                queueMicrotask(() => isoPathRef.current?.focus())
              }}
              className="px-3 py-1.5 rounded text-xs transition flex items-center gap-1 bg-emerald-900/60 text-emerald-100 border border-emerald-700/50 hover:bg-emerald-800/60"
              title="New qcow2 from virt-install + install ISO (clears mkosi / virt-builder fields)"
            >
              <Disc className="w-3.5 h-3.5" /> Install from ISO
            </button>
          </div>
          {goldenSaved ? (
            <p className="text-xs text-amber-400/90">A saved template with a golden disk is active: the root disk is created from that image; the &quot;New disk&quot; size below does not apply to the root volume.</p>
          ) : null}
          {diskMode === 'mkosi' ? (
            <div className="space-y-3 rounded-lg border border-slate-600/50 bg-slate-900/40 p-4">
              <p className="text-xs text-slate-400">
                Runs <code className="text-slate-300">mkosi build</code> in a directory that contains <code className="text-slate-300">mkosi.conf</code> (
                <a href="https://github.com/systemd/mkosi" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">systemd/mkosi</a>
                ). The daemon passes <code className="text-slate-300">--output-dir</code> and <code className="text-slate-300">--workspace-directory</code> into an ephemeral directory under <code className="text-slate-300">/var/tmp/virtspawn-mkosi-ws/</code>; the resulting <code className="text-slate-300">.raw</code> or <code className="text-slate-300">.qcow2</code> is converted and moved to your libvirt image pool — nothing is left in your recipe workspace under <code className="text-slate-300">mkosi-defs</code>. Install.sh installs upstream mkosi (v16+) from GitHub when not already present and symlinks <code className="text-slate-300">/usr/local/bin/mkosi</code>.
              </p>
              <p className="text-xs text-amber-100/85 border border-amber-800/40 rounded-md px-2 py-1.5 bg-amber-950/15">
                <strong className="text-amber-50/90">Disk space:</strong> failed builds can leave large trees under <code className="text-amber-100/90">/var/tmp/virtspawn-mkosi-ws/</code>.
                Remove stale directories when you no longer need the logs (successful builds remove them automatically unless <code className="text-amber-100/90">VIRTSPAWN_MKOSI_KEEP_WORKSPACE</code> is set for debugging).
              </p>
              <p className="text-xs text-sky-200/85 border border-sky-800/40 rounded-md px-2 py-1.5 bg-sky-950/25">
                <strong className="text-sky-100/90">Alma / RHEL / Rocky 9:</strong> if <code className="text-sky-100/80">mkosi</code> says <code className="text-sky-100/80">systemd-repart</code> must be <strong className="text-sky-100/90">254+</strong> but the host ships 252, add <code className="text-sky-100/80">ToolsTree=yes</code> under <code className="text-sky-100/80">[Build]</code> in <code className="text-sky-100/80">mkosi.conf</code> so mkosi uses its default tools tree (newer repart). See{' '}
                <a href="https://github.com/systemd/mkosi/blob/main/mkosi/resources/man/mkosi.1.md" className="text-blue-300 hover:underline" target="_blank" rel="noreferrer">mkosi(1)</a> — TOOLS TREES.
              </p>
              <p className="text-xs text-amber-200/80 border border-amber-700/40 rounded-md px-2 py-1.5 bg-amber-950/20">
                There is no “Linux flavour” picker here on purpose: the image contents and distro family come from your <strong className="text-amber-100/90">mkosi</strong> recipe. Use <strong className="text-amber-100/90">Guest OS hint</strong> above only to match what you built (helps virt-install / templates), or switch to <strong className="text-amber-100/90">virt-builder</strong> for a template list on the host.
              </p>
              <div className="space-y-2">
                <label htmlFor="mkosi-ws" className="block text-sm text-slate-400">Workspace directory *</label>
                {mkosiWorkspaces.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Select a workspace from the hypervisor</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {mkosiWorkspaces.map((ws) => {
                        const meta = getDistroMeta(ws.name)
                        const selected = form.mkosi_workspace === ws.path
                        return (
                          <button
                            key={ws.path}
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                mkosi_workspace: ws.path,
                                mkosi_image: '',
                                ...mkosiPathDefaults(ws.path),
                              }))}
                            className={`relative flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all duration-150 ${meta.cardBg} ${
                              selected
                                ? `${meta.borderSelected} ring-1 ${meta.ringSelected} shadow-lg`
                                : `${meta.borderIdle} hover:border-slate-500/70 hover:brightness-110`
                            }`}
                          >
                            <meta.Logo size={36} />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm text-white leading-snug truncate">{meta.label}</div>
                              <div className={`text-[11px] font-medium leading-tight ${meta.versionColor}`}>{meta.version || ws.name}</div>
                              {meta.desc && <div className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">{meta.desc}</div>}
                              {ws.images.length > 0 && (
                                <div className="text-[10px] text-cyan-400/80 mt-0.5">{ws.images.length} sub-image{ws.images.length !== 1 ? 's' : ''}</div>
                              )}
                            </div>
                            {selected && (
                              <div className="absolute top-1.5 right-1.5 bg-green-500 rounded-full p-0.5">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <input
                  id="mkosi-ws"
                  type="text"
                  value={form.mkosi_workspace || ''}
                  onChange={(e) => {
                    const p = e.target.value
                    setForm({ ...form, mkosi_workspace: p, mkosi_image: '', ...mkosiPathDefaults(p) })
                  }}
                  className="input-field font-mono text-sm"
                  placeholder="/var/lib/virtspawn/mkosi-defs/my-guest"
                />
                <p className="text-xs text-slate-500">Must be an absolute path on the <strong className="text-slate-400">hypervisor</strong>; directory must contain <code className="text-slate-500">mkosi.conf</code>. Place workspaces under <code className="text-slate-500">/var/lib/virtspawn/mkosi-defs/</code> to see them above.</p>
              </div>
              {/* Image selector for multi-image workspaces */}
              {(() => {
                const ws = mkosiWorkspaces.find((w) => w.path === form.mkosi_workspace)
                if (!ws || ws.images.length === 0) return null
                return (
                  <div>
                    <label htmlFor="mkosi-image" className="block text-sm text-slate-400 mb-1">
                      Image <span className="text-slate-500 font-normal">(multi-image workspace — pick one or leave blank for default)</span>
                    </label>
                    <select
                      id="mkosi-image"
                      className="input-field"
                      value={form.mkosi_image || ''}
                      onChange={(e) => setForm({ ...form, mkosi_image: e.target.value })}
                    >
                      <option value="">— default / all —</option>
                      {ws.images.map((img) => (
                        <option key={img} value={img}>{img}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Selects a specific image via <code className="text-slate-400">mkosi --image &lt;name&gt;</code>. Leave blank to build the workspace normally.</p>
                  </div>
                )
              })()}
              {/* Manual image name when workspace is typed rather than picked */}
              {form.mkosi_workspace && !mkosiWorkspaces.find((w) => w.path === form.mkosi_workspace) && (
                <div>
                  <label htmlFor="mkosi-image-manual" className="block text-sm text-slate-400 mb-1">
                    Image name <span className="text-slate-500 font-normal">(optional — for multi-image workspaces)</span>
                  </label>
                  <input
                    id="mkosi-image-manual"
                    type="text"
                    value={form.mkosi_image || ''}
                    onChange={(e) => setForm({ ...form, mkosi_image: e.target.value })}
                    className="input-field font-mono text-sm"
                    placeholder="e.g. base, initrd, addon…"
                  />
                  <p className="text-xs text-slate-500 mt-1">Passed as <code className="text-slate-400">mkosi --image &lt;name&gt;</code>. Leave blank to build all images.</p>
                </div>
              )}
            </div>
          ) : diskMode === 'virt_builder' ? (
            <div className="space-y-3 rounded-lg border border-slate-600/50 bg-slate-900/40 p-4">
              <p className="text-xs text-slate-400">
                Builds a bootable qcow2 from the libguestfs index on the host. The daemon runs{' '}
                <code className="text-slate-300">virt-builder --list --list-format json</code> (falls back to plain <code className="text-slate-300">--list</code>).
                The template list is <strong className="text-slate-300">cached for about 5 minutes</strong> per daemon process — use <strong className="text-slate-300">Refresh</strong> to pull a fresh index after installing templates.
              </p>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex-1 min-w-0">
                    <label htmlFor="vb-cat-filter" className="block text-sm text-slate-400 mb-1">Search templates</label>
                    <input
                      id="vb-cat-filter"
                      type="search"
                      value={vbCatalogFilter}
                      onChange={(e) => setVbCatalogFilter(e.target.value)}
                      className="input-field"
                      placeholder="Name, arch, or description…"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={refreshVirtBuilderCatalog}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800/80 text-xs text-slate-200 hover:bg-slate-700 transition"
                    title="Bypass cache and re-run virt-builder --list --list-format json"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden />
                    Refresh catalog
                  </button>
                </div>
                {vbCatalogMeta.cached && vbCatalogMeta.cacheAgeSecs !== undefined ? (
                  <p className="text-[10px] text-slate-500">
                    Last catalog fetch was served from server cache ({vbCatalogMeta.cacheAgeSecs}s ago).
                  </p>
                ) : null}
                <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-600/60 bg-slate-950/50 divide-y divide-slate-800/80">
                  {vbFiltered.length === 0 ? (
                    <p className="text-xs text-slate-500 p-3">No templates match this filter. Clear search or refresh the catalog.</p>
                  ) : (
                    vbFiltered.map((row) => (
                      <button
                        key={row.name}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, virt_builder_os: row.name }))
                          setVbNotesText(null)
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm transition hover:bg-slate-800/90 ${
                          (form.virt_builder_os || '') === row.name ? 'bg-blue-600/20 border-l-2 border-l-blue-500 pl-[10px]' : ''
                        }`}
                      >
                        <div className="font-mono text-slate-100">{row.name}</div>
                        {row.summary ? (
                          <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{row.summary}</div>
                        ) : null}
                        {[row.arch, row.size].filter(Boolean).length > 0 ? (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            {[row.arch, row.size].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[12rem]">
                  <label htmlFor="vb-os" className="block text-sm text-slate-400 mb-1">Selected OS template id *</label>
                  <input
                    id="vb-os"
                    type="text"
                    value={form.virt_builder_os || ''}
                    onChange={(e) => { setForm({ ...form, virt_builder_os: e.target.value }); setVbNotesText(null) }}
                    className="input-field font-mono text-sm"
                    placeholder="Pick from the list above or type a custom id"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border border-slate-600 text-xs text-slate-300 hover:bg-slate-700/60 flex items-center gap-1 shrink-0"
                  onClick={async () => {
                    const os = form.virt_builder_os?.trim()
                    if (!os) { toast.warning('Enter an OS template name first'); return }
                    try {
                      const r = await getVirtBuilderNotes(os)
                      setVbNotesText(r.notes || '(empty)')
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : String(e))
                    }
                  }}
                >
                  <FileText className="w-3.5 h-3.5" /> Notes
                </button>
              </div>
              {vbNotesText !== null ? (
                <pre className="text-[11px] text-slate-400 whitespace-pre-wrap break-words max-h-48 overflow-y-auto rounded border border-slate-700/50 p-2 bg-slate-950/50">{vbNotesText}</pre>
              ) : null}
              <div>
                <label htmlFor="vb-disk-gb" className="block text-sm text-slate-400 mb-1">Root disk size (GB)</label>
                <input id="vb-disk-gb" type="number" min={1} value={form.disk_gb} onChange={(e) => setForm({ ...form, disk_gb: parseInt(e.target.value) || 10 })} className="input-field" />
              </div>
              <div>
                <label htmlFor="vb-hostname" className="block text-sm text-slate-400 mb-1">Guest hostname (optional)</label>
                <input
                  id="vb-hostname"
                  type="text"
                  value={form.virt_builder_hostname || ''}
                  onChange={(e) => setForm({ ...form, virt_builder_hostname: e.target.value })}
                  className="input-field"
                  placeholder="Defaults from VM name"
                />
              </div>
              <div>
                <label htmlFor="vb-pubkey" className="block text-sm text-slate-400 mb-1">Root SSH public key (optional)</label>
                <input
                  id="vb-pubkey"
                  type="text"
                  value={form.virt_builder_ssh_pubkey || ''}
                  onChange={(e) => setForm({ ...form, virt_builder_ssh_pubkey: e.target.value })}
                  className="input-field"
                  placeholder="ssh-ed25519 AAAA…"
                />
              </div>
              <div>
                <label htmlFor="vb-root-pw-file" className="block text-sm text-slate-400 mb-1">Root password file on host (optional)</label>
                <input
                  id="vb-root-pw-file"
                  type="text"
                  value={form.virt_builder_root_password_file || ''}
                  onChange={(e) => setForm({ ...form, virt_builder_root_password_file: e.target.value })}
                  className="input-field font-mono text-sm"
                  placeholder="/run/secrets/guest_root_password"
                />
                <p className="text-xs text-slate-500 mt-1">Absolute path on the <strong>server</strong> (not uploaded). One line; passed as <code className="text-slate-400">--root-password file:…</code> — never on argv.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={!!form.virt_builder_selinux_relabel} onChange={(e) => setForm({ ...form, virt_builder_selinux_relabel: e.target.checked })} className="rounded border-slate-600" />
                  SELinux relabel (<code className="text-xs text-slate-500">virt-builder --selinux-relabel</code>)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={!!form.virt_builder_sysprep} onChange={(e) => setForm({ ...form, virt_builder_sysprep: e.target.checked })} className="rounded border-slate-600" />
                  Seal with virt-sysprep (clone-safe template)
                </label>
              </div>
              <div>
                <label htmlFor="vb-pkgs" className="block text-sm text-slate-400 mb-1">virt-builder packages (one per line)</label>
                <textarea id="vb-pkgs" rows={2} value={vbPkgLines} onChange={(e) => setVbPkgLines(e.target.value)} className="input-field font-mono text-xs" placeholder="qemu-guest-agent" />
              </div>
              <div>
                <label htmlFor="vb-fb" className="block text-sm text-slate-400 mb-1">virt-builder first-boot commands (one per line)</label>
                <textarea id="vb-fb" rows={2} value={vbFirstbootLines} onChange={(e) => setVbFirstbootLines(e.target.value)} className="input-field font-mono text-xs" placeholder="systemctl enable qemu-guest-agent" />
              </div>
              <div>
                <label htmlFor="vb-pci" className="block text-sm text-slate-400 mb-1">virt-customize —install (after build, one per line)</label>
                <textarea id="vb-pci" rows={2} value={vbPostInstLines} onChange={(e) => setVbPostInstLines(e.target.value)} className="input-field font-mono text-xs" placeholder="vim" />
              </div>
              <div>
                <label htmlFor="vb-pcr" className="block text-sm text-slate-400 mb-1">virt-customize —run-command (one per line)</label>
                <textarea id="vb-pcr" rows={2} value={vbPostRunLines} onChange={(e) => setVbPostRunLines(e.target.value)} className="input-field font-mono text-xs" placeholder="mkdir -p /opt/virtspawn" />
              </div>
              <p className="text-xs text-slate-500">
                Provide an SSH key and/or root password <strong>file</strong>, or configure <code className="text-slate-400">[libvirt] virt_builder_default_ssh_pubkey_path</code> on the server.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-600/50 space-y-3">
                <p className="text-xs text-slate-400">
                  <Hammer className="w-3.5 h-3.5 inline-block mr-1 align-text-bottom text-amber-400/90" aria-hidden />
                  <strong className="text-slate-300">Pre-build a disk</strong> with the same <code className="text-slate-500">virt-builder</code> flow as the CLI crate <code className="text-slate-500">virt-image-build</code>: the daemon runs an async <strong className="text-slate-300">job</strong> with live <code className="text-slate-500">virt-builder</code> stdout/stderr below, and you can open <strong className="text-slate-300">Jobs</strong> anytime to keep watching. When it finishes, switch to <strong className="text-slate-300">Existing disk</strong> and the new path is selected automatically.
                </p>
                <div>
                  <label htmlFor="vib-out" className="block text-sm text-slate-400 mb-1">Output path on server *</label>
                  <input
                    id="vib-out"
                    type="text"
                    value={vibOutputPath}
                    onChange={(e) => setVibOutputPath(e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="/var/lib/libvirt/images/my-guest.qcow2"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Absolute path; must not exist. Parent directory must be under a libvirt pool or default images path.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="vib-size" className="block text-sm text-slate-400 mb-1">Size</label>
                    <input id="vib-size" type="text" value={vibSizeStr} onChange={(e) => setVibSizeStr(e.target.value)} className="input-field font-mono text-sm" placeholder="20G" />
                  </div>
                  <div>
                    <label htmlFor="vib-fmt" className="block text-sm text-slate-400 mb-1">Format</label>
                    <input id="vib-fmt" type="text" value={vibFormatStr} onChange={(e) => setVibFormatStr(e.target.value)} className="input-field font-mono text-sm" placeholder="qcow2" />
                  </div>
                  <div>
                    <label htmlFor="vib-hn" className="block text-sm text-slate-400 mb-1">Hostname override</label>
                    <input
                      id="vib-hn"
                      type="text"
                      value={vibHostnameOverride}
                      onChange={(e) => setVibHostnameOverride(e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder="Uses guest hostname field if empty"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="vib-pw-inline" className="block text-sm text-slate-400 mb-1">Root password (optional, one-time over HTTPS)</label>
                  <input
                    id="vib-pw-inline"
                    type="password"
                    value={vibRootPwInline}
                    onChange={(e) => setVibRootPwInline(e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="Prefer root password file above when possible"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label htmlFor="vib-fb-path" className="block text-sm text-slate-400 mb-1">First-boot script on server (optional)</label>
                  <input
                    id="vib-fb-path"
                    type="text"
                    value={vibFirstbootHostPath}
                    onChange={(e) => setVibFirstbootHostPath(e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="/path/on/hypervisor/firstboot.sh"
                    spellCheck={false}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={vibUpdate} onChange={(e) => setVibUpdate(e.target.checked)} className="rounded border-slate-600" />
                  <code className="text-xs text-slate-500">virt-builder --update</code> (full OS update during build)
                </label>
                <button
                  type="button"
                  disabled={vibBuilding}
                  onClick={async () => {
                    const os = form.virt_builder_os?.trim()
                    const out = vibOutputPath.trim()
                    if (!os) {
                      toast.warning('Select or enter a virt-builder OS template first')
                      return
                    }
                    if (!out) {
                      toast.warning('Enter an absolute output path on the server')
                      return
                    }
                    const pk = form.virt_builder_ssh_pubkey?.trim()
                    const pwf = form.virt_builder_root_password_file?.trim()
                    const pwi = vibRootPwInline.trim()
                    if (!pk && !pwf && !pwi) {
                      toast.warning('Provide root password file, one-time root password, or SSH public key above')
                      return
                    }
                    const hn = (vibHostnameOverride.trim() || form.virt_builder_hostname?.trim() || 'virtbuilder-guest.local').trim()
                    setVibJobId(null)
                    setVibJobLogs([])
                    try {
                      const started = await startVirtImageBuildJob({
                        os,
                        output: out,
                        size: vibSizeStr.trim() || undefined,
                        format: vibFormatStr.trim() || undefined,
                        hostname: hn,
                        install: linesToList(vbPkgLines).join(','),
                        run_command: linesToList(vbFirstbootLines),
                        firstboot_script: vibFirstbootHostPath.trim() || undefined,
                        root_password_file: pwf || undefined,
                        root_password_inline: pwi || undefined,
                        ssh_pubkey_inline: pk || undefined,
                        update: vibUpdate,
                        selinux_relabel: !!form.virt_builder_selinux_relabel,
                      })
                      setVibJobId(started.id)
                      toast.info(`Build started — job ${started.id.slice(0, 8)}…`, 5000)
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : String(e))
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-700/90 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-50 disabled:pointer-events-none transition"
                >
                  {vibBuilding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                      Building…
                    </>
                  ) : (
                    <>
                      <Hammer className="w-4 h-4" aria-hidden />
                      Build disk on server
                    </>
                  )}
                </button>
                {vibJobId ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400">
                      Job <span className="font-mono text-slate-300">{vibJobId}</span> —{' '}
                      <Link to={`/jobs/${encodeURIComponent(vibJobId)}`} className="text-amber-300/90 hover:underline">
                        Open in Jobs
                      </Link>{' '}
                      to keep watching if you leave this page.
                    </p>
                    {vibJobLogs.length > 0 ? (
                      <pre className="text-[10px] font-mono text-slate-400 bg-slate-950/70 border border-slate-800 rounded-lg p-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                        {vibJobLogs.join('\n')}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : diskMode === 'new' ? (
            <div>
              <label htmlFor="vm-disk" className="block text-sm text-slate-400 mb-1">Disk Size (GB)</label>
              <input id="vm-disk" type="number" min={1} value={form.disk_gb} onChange={(e) => setForm({ ...form, disk_gb: parseInt(e.target.value) || 10 })} className="input-field" />
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="vm-existing-disk" className="block text-sm text-slate-400 mb-1">Disk Image Path *</label>
              {diskFiles.length > 0 ? (
                <select id="vm-existing-disk" value={form.existing_disk || ''} onChange={(e) => setForm({ ...form, existing_disk: e.target.value })} className="input-field">
                  <option value="">Select disk image (from scan)…</option>
                  {diskFiles.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.name} ({(f.size_bytes / 1073741824).toFixed(1)} GB)
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="flex gap-2">
                <input
                  id="vm-existing-disk"
                  type="text"
                  value={form.existing_disk || ''}
                  onChange={(e) => setForm({ ...form, existing_disk: e.target.value })}
                  className="input-field flex-1 min-w-0"
                  placeholder="/var/lib/libvirt/images/disk.qcow2"
                />
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-sm text-slate-200 transition"
                  onClick={() => setExistingDiskBrowseOpen(true)}
                >
                  <FolderOpen className="w-4 h-4" aria-hidden />
                  Browse
                </button>
              </div>
              <p className="text-xs text-slate-500">qcow2, raw, img, vmdk, … — browse starts at / on the hypervisor (same permissions as the daemon).</p>
            </div>
          )}
        </div>
        </>
        )}

        {stepVisible(3) && (
        <>
        {/* Network */}
        <div>
          <label htmlFor="vm-network" className="block text-sm text-slate-400 mb-1">Network</label>
          {networks.length > 0 ? (
            <select id="vm-network" value={form.network || 'default'} onChange={(e) => setForm({ ...form, network: e.target.value })} className="input-field">
              {networks.map((n) => (
                <option key={n.name} value={n.name}>{n.name}{n.active ? '' : ' (inactive)'}</option>
              ))}
            </select>
          ) : (
            <input id="vm-network" type="text" value={form.network || ''} onChange={(e) => setForm({ ...form, network: e.target.value })} className="input-field" />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="vm-graphics-type" className="block text-sm text-slate-400 mb-1">Display / remote</label>
            <select
              id="vm-graphics-type"
              value={form.graphics_type || 'vnc'}
              onChange={(e) => setForm({ ...form, graphics_type: e.target.value })}
              className="input-field"
            >
              <option value="vnc">VNC (noVNC in browser)</option>
              <option value="spice">SPICE (QXL + spice-html5)</option>
            </select>
          </div>
          <div>
            <label htmlFor="vm-vnc-listen" className="block text-sm text-slate-400 mb-1">Graphics listen (VNC / SPICE)</label>
            <input
              id="vm-vnc-listen"
              type="text"
              value={form.graphics_listen ?? ''}
              onChange={(e) => setForm({ ...form, graphics_listen: e.target.value })}
              className="input-field"
              placeholder="127.0.0.1"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          Default listen 127.0.0.1. Use 0.0.0.0 for all interfaces; access still goes through the daemon WebSocket proxy.
          {isWindowsOsVariant(form.os_variant ?? '') && (
            <span className="block mt-1 text-slate-400">
              Windows guests default to <strong className="font-medium text-slate-300">SPICE</strong> — the daemon generates QXL video for smoother remote desktop than VNC; install VirtIO/SPICE guest drivers after install.
            </span>
          )}
        </p>

        {/* ISO selection with browser */}
        <div>
          <label htmlFor="vm-iso" className="block text-sm text-slate-400 mb-1"><Disc className="w-3 h-3 inline -mt-0.5" /> ISO Path (optional)</label>
          {diskMode === 'virt_builder' || diskMode === 'mkosi' ? (
            <p className="text-xs text-slate-500">Install ISO is not used when the root disk is built from virt-builder or mkosi.</p>
          ) : (
            <div className="space-y-2">
              {isoFiles.length > 0 ? (
                <select id="vm-iso-scan" value={form.iso || ''} onChange={(e) => setForm({ ...form, iso: e.target.value })} className="input-field">
                  <option value="">No ISO (from scan)</option>
                  {isoFiles.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.name} ({(f.size_bytes / 1048576).toFixed(0)} MB)
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="flex gap-2">
                <input
                  ref={isoPathRef}
                  id="vm-iso"
                  type="text"
                  value={form.iso || ''}
                  onChange={(e) => setForm({ ...form, iso: e.target.value })}
                  className="input-field flex-1 min-w-0"
                  placeholder="/path/to/ubuntu.iso on the hypervisor"
                />
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-sm text-slate-200 transition"
                  onClick={() => setIsoBrowseOpen(true)}
                >
                  <FolderOpen className="w-4 h-4" aria-hidden />
                  Browse
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Browse opens at <code className="text-slate-400">/</code> on the hypervisor; chips include pools,{' '}
                <code className="text-slate-400">/data</code>, <code className="text-slate-400">/home</code>, etc. Directories the daemon cannot read are skipped or error.
              </p>
            </div>
          )}
        </div>

        {diskMode !== 'virt_builder' && diskMode !== 'mkosi' && form.create_backend !== 'libvirt_xml' && (
          <details className="rounded-lg border border-slate-700/50 bg-slate-900/30 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-200 flex items-center gap-2 list-none [&::-webkit-details-marker]:hidden">
              <FileText className="w-4 h-4 text-amber-400 shrink-0" aria-hidden />
              Advanced virt-install (PXE, kickstart tree, define-only, …)
            </summary>
            <p className="text-xs text-slate-500 mt-2 mb-3">
              Same primitives as <a href="https://github.com/cockpit-project/cockpit-machines" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">Cockpit Machines</a> (via <code className="text-slate-400">virt-install</code>); combine carefully — the API rejects conflicting combinations.
            </p>
            <div className="space-y-3 text-sm">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.virt_install_define_only} onChange={(e) => setForm({ ...form, virt_install_define_only: e.target.checked })} className="rounded border-slate-600 mt-0.5" />
                <span>
                  <strong className="text-slate-300">Define only</strong> — <code className="text-xs text-slate-400">--print-xml</code> then define a halted VM (no ISO, location, PXE, backing import, or cloud-init ISO).
                </span>
              </label>
              <div>
                <label htmlFor="vi-loc" className="block text-xs text-slate-400 mb-1">Install URL / tree (<code className="text-slate-500">--location</code>)</label>
                <input id="vi-loc" type="text" value={form.virt_install_location || ''} onChange={(e) => setForm({ ...form, virt_install_location: e.target.value })} className="input-field font-mono text-xs" placeholder="https://… or nfs:host:/export or /srv/install-tree" spellCheck={false} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.virt_install_pxe} onChange={(e) => setForm({ ...form, virt_install_pxe: e.target.checked })} className="rounded border-slate-600" />
                <span><strong className="text-slate-300">PXE boot</strong> — adds <code className="text-xs text-slate-400">--pxe</code> and a second NIC</span>
              </label>
              <div>
                <label htmlFor="vi-pxenet" className="block text-xs text-slate-400 mb-1">PXE network name (defaults to main Network)</label>
                <input id="vi-pxenet" type="text" value={form.virt_install_pxe_network || ''} onChange={(e) => setForm({ ...form, virt_install_pxe_network: e.target.value })} className="input-field font-mono text-xs" placeholder="default" spellCheck={false} />
              </div>
              <div>
                <label htmlFor="vi-instalos" className="block text-xs text-slate-400 mb-1"><code className="text-slate-500">--install os=</code> (libosinfo id)</label>
                <input id="vi-instalos" type="text" value={form.virt_install_install_os || ''} onChange={(e) => setForm({ ...form, virt_install_install_os: e.target.value })} className="input-field font-mono text-xs" placeholder="fedora40" spellCheck={false} />
              </div>
              <div>
                <label htmlFor="vi-extra" className="block text-xs text-slate-400 mb-1"><code className="text-slate-500">--extra-args</code></label>
                <input id="vi-extra" type="text" value={form.virt_install_extra_args || ''} onChange={(e) => setForm({ ...form, virt_install_extra_args: e.target.value })} className="input-field font-mono text-xs" placeholder="inst.ks=…" spellCheck={false} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label htmlFor="vi-pool" className="block text-xs text-slate-400 mb-1">Root disk pool</label>
                  <input id="vi-pool" type="text" value={form.root_disk_storage_pool || ''} onChange={(e) => setForm({ ...form, root_disk_storage_pool: e.target.value })} className="input-field font-mono text-xs" placeholder="default" spellCheck={false} />
                </div>
                <div>
                  <label htmlFor="vi-vol" className="block text-xs text-slate-400 mb-1">Volume name</label>
                  <input id="vi-vol" type="text" value={form.root_disk_storage_volume || ''} onChange={(e) => setForm({ ...form, root_disk_storage_volume: e.target.value })} className="input-field font-mono text-xs" placeholder="myvm.qcow2" spellCheck={false} />
                </div>
              </div>
              <div>
                <label htmlFor="vi-back" className="block text-xs text-slate-400 mb-1">Backing image for new overlay (<code className="text-slate-500">backing_store=</code> + import)</label>
                <input id="vi-back" type="text" value={form.virt_install_disk_backing_store || ''} onChange={(e) => setForm({ ...form, virt_install_disk_backing_store: e.target.value })} className="input-field font-mono text-xs" placeholder="/var/lib/libvirt/images/Fedora-Cloud-Base.qcow2" spellCheck={false} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.virt_install_path_in_use_check_off} onChange={(e) => setForm({ ...form, virt_install_path_in_use_check_off: e.target.checked })} className="rounded border-slate-600" />
                <span><code className="text-xs text-slate-400">--check path_in_use=off</code></span>
              </label>
            </div>
          </details>
        )}

        {/* Cloud-init */}
        <div className="border-t border-slate-700/50 pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showCloudInit} onChange={e => setShowCloudInit(e.target.checked)} className="rounded border-slate-600" />
            <Cloud className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium">Cloud-Init Configuration</span>
          </label>
          {showCloudInit && (
            <div className="mt-3 space-y-3 pl-6">
              <div>
                <label htmlFor="ci-user" className="block text-sm text-slate-400 mb-1">Username</label>
                <input id="ci-user" type="text" value={ciUser} onChange={e => setCiUser(e.target.value)} className="input-field" placeholder="admin" />
              </div>
              <div>
                <label htmlFor="ci-pass" className="block text-sm text-slate-400 mb-1">Password</label>
                <input id="ci-pass" type="password" value={ciPass} onChange={e => setCiPass(e.target.value)} className="input-field" />
              </div>
              <div>
                <label htmlFor="ci-ssh" className="block text-sm text-slate-400 mb-1">SSH Public Key</label>
                <input id="ci-ssh" type="text" value={ciSshKey} onChange={e => setCiSshKey(e.target.value)} className="input-field" placeholder="ssh-ed25519 AAAA..." />
              </div>
              <p className="text-xs text-slate-500">Generates a cloud-init seed ISO and attaches it as a second CD-ROM (sdc) while install media stays on the first CD-ROM (sda) when both are set. The guest must support cloud-init.</p>
            </div>
          )}
        </div>
        </>
        )}

        {createUiMode === 'wizard' && wizardStep === WIZARD_LAST && (
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-emerald-100 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden />
            Review &amp; create
          </h4>
          <p className="text-xs text-slate-500">Confirm settings. Use <strong className="text-slate-400">Back</strong> to change an earlier step.</p>
          <dl className="grid grid-cols-1 sm:grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2 text-sm border-t border-slate-700/40 pt-3">
            <dt className="text-slate-500">VM name</dt>
            <dd className="font-mono text-slate-100 break-all">{form.name.trim() || '—'}</dd>
            <dt className="text-slate-500">Create engine</dt>
            <dd className="text-slate-200">{form.create_backend?.trim() || 'Server default (virt_install)'}</dd>
            <dt className="text-slate-500">vCPU / RAM</dt>
            <dd className="text-slate-200">{form.vcpus} vCPU · {form.memory_mb} MiB</dd>
            <dt className="text-slate-500">Firmware / OS hint</dt>
            <dd className="text-slate-200">{(form.firmware || 'uefi').toUpperCase()} · <span className="font-mono text-xs">{(form.os_variant || 'generic').trim() || 'generic'}</span></dd>
            <dt className="text-slate-500">Storage</dt>
            <dd className="text-slate-200">
              {diskModeLabel(diskMode)}
              {diskMode === 'new' && !goldenSaved && (
                <span className="block text-xs text-slate-400 mt-0.5">{form.disk_gb} GiB new disk</span>
              )}
              {diskMode === 'existing' && form.existing_disk?.trim() && (
                <span className="block font-mono text-xs text-slate-400 mt-0.5 break-all">{form.existing_disk}</span>
              )}
              {diskMode === 'mkosi' && form.mkosi_workspace?.trim() && (
                <span className="block font-mono text-xs text-slate-400 mt-0.5 break-all">{form.mkosi_workspace}{form.mkosi_image?.trim() ? ` (image: ${form.mkosi_image})` : ''}</span>
              )}
              {diskMode === 'virt_builder' && form.virt_builder_os?.trim() && (
                <span className="block font-mono text-xs text-slate-400 mt-0.5">{form.virt_builder_os}</span>
              )}
            </dd>
            {form.saved_template?.trim() ? (
              <>
                <dt className="text-slate-500">Saved template</dt>
                <dd className="font-mono text-xs text-slate-200 break-all">{form.saved_template}</dd>
              </>
            ) : null}
            <dt className="text-slate-500">Network</dt>
            <dd className="font-mono text-xs text-slate-200">{form.network || 'default'}</dd>
            <dt className="text-slate-500">Display</dt>
            <dd className="text-slate-200">{(form.graphics_type || 'vnc').toUpperCase()}{form.graphics_listen?.trim() && form.graphics_listen !== '127.0.0.1' ? ` · listen ${form.graphics_listen}` : ''}</dd>
            <dt className="text-slate-500">Install / boot</dt>
            <dd className="text-slate-200 text-xs">
              {form.iso?.trim() ? <span className="font-mono break-all block">ISO: {form.iso}</span> : null}
              {form.virt_install_define_only ? <span className="block text-amber-200/90">Define-only (halted, no install media)</span> : null}
              {form.virt_install_location?.trim() ? <span className="block font-mono break-all">location: {form.virt_install_location}</span> : null}
              {form.virt_install_pxe ? <span className="block">PXE boot</span> : null}
              {form.virt_install_install_os?.trim() ? <span className="block font-mono">install os={form.virt_install_install_os}</span> : null}
              {form.virt_install_disk_backing_store?.trim() ? <span className="block font-mono break-all">backing: {form.virt_install_disk_backing_store}</span> : null}
              {(form.root_disk_storage_pool?.trim() && form.root_disk_storage_volume?.trim()) ? (
                <span className="block font-mono">vol {form.root_disk_storage_pool}/{form.root_disk_storage_volume}</span>
              ) : null}
              {!form.iso?.trim() && !form.virt_install_define_only && !form.virt_install_location?.trim() && !form.virt_install_pxe && !form.virt_install_install_os?.trim() && !form.virt_install_disk_backing_store?.trim() && !(form.root_disk_storage_pool?.trim() && form.root_disk_storage_volume?.trim()) && diskMode === 'new' && form.create_backend === 'libvirt_xml' ? (
                <span className="text-slate-400">Native XML — empty / installer path per engine</span>
              ) : null}
              {diskMode === 'new' && form.create_backend === 'virt_install' && hasVirtInstallBootOrShell(form) && !form.iso?.trim() ? (
                <span className="block text-slate-400">Advanced virt-install / volume / backing (no classic ISO path)</span>
              ) : null}
            </dd>
            <dt className="text-slate-500">Cloud-init</dt>
            <dd className="text-slate-200 text-xs">{showCloudInit && (ciUser || ciSshKey) ? `Seed ISO will be generated (${ciUser || 'user TBD'})` : 'Off'}</dd>
          </dl>
        </div>
        )}

        {(createUiMode === 'classic' || wizardStep === WIZARD_LAST) && (submitting || createLog.length > 0) && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              Create progress
            </h3>
            <p className="text-xs text-slate-500">Live output from mkosi, virt-builder, virt-install, and qemu-img on the hypervisor (same request as Create VM).</p>
            {vmCreateJobId ? (
              <p className="text-xs text-slate-400">
                Track this run in{' '}
                <Link to={`/jobs/${encodeURIComponent(vmCreateJobId)}`} className="text-amber-300/90 hover:underline font-mono">
                  Jobs
                </Link>{' '}
                <span className="font-mono text-slate-500">({vmCreateJobId.slice(0, 8)}…)</span>
              </p>
            ) : null}
            <pre className="max-h-72 overflow-y-auto rounded-lg bg-black/50 border border-slate-800 p-3 text-[11px] leading-snug font-mono text-slate-200 whitespace-pre-wrap break-all">
              {createLog.length ? createLog.join('\n') : <span className="text-slate-500">Starting…</span>}
            </pre>
            <div ref={logEndRef} />
          </div>
        )}

        {createUiMode === 'classic' ? (
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
            <Link to="/vms" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition">Cancel</Link>
            <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm transition">
              {submitting ? 'Creating...' : 'Create VM'}
            </button>
          </div>
        ) : wizardStep < WIZARD_LAST ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:items-center pt-4 border-t border-slate-700/50">
            <Link to="/vms" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition text-center sm:text-left">Cancel</Link>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={goWizardBack}
                disabled={wizardStep === 0 || submitting}
                className="inline-flex items-center gap-1 px-4 py-2 rounded text-sm border border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden />
                Back
              </button>
              <button
                type="button"
                onClick={goWizardNext}
                disabled={submitting}
                className="inline-flex items-center gap-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm transition"
              >
                Next
                <ChevronRight className="w-4 h-4 shrink-0" aria-hidden />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:items-center pt-4 border-t border-slate-700/50">
            <Link to="/vms" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition text-center sm:text-left">Cancel</Link>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={goWizardBack}
                disabled={submitting}
                className="inline-flex items-center gap-1 px-4 py-2 rounded text-sm border border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden />
                Back
              </button>
              <button type="submit" disabled={submitting} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded text-sm transition font-medium">
                {submitting ? 'Creating...' : 'Create VM'}
              </button>
            </div>
          </div>
        )}
      </form>

      <BrowseHostPathModal
        open={isoBrowseOpen && diskMode !== 'virt_builder' && diskMode !== 'mkosi'}
        onClose={() => setIsoBrowseOpen(false)}
        title="Browse for install ISO"
        canSelectFile={isIsoFileName}
        onSelectPath={(p) => setForm((prev) => ({ ...prev, iso: p }))}
      />
      <BrowseHostPathModal
        open={existingDiskBrowseOpen}
        onClose={() => setExistingDiskBrowseOpen(false)}
        title="Browse for disk image"
        canSelectFile={isHostDiskImageFileName}
        onSelectPath={(p) => setForm((prev) => ({ ...prev, existing_disk: p }))}
      />
    </div>
  )
}

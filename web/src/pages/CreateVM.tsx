import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router'
import { createVM, getTemplates, VmTemplate, CreateVmRequest } from '../api/vm'
import { listNetworks, NetworkInfo } from '../api/network'
import { listIsos, listDiskImages, ImageFile, generateCloudInit, listSavedTemplates, listVirtBuilderTemplates, getVirtBuilderNotes, listMkosiWorkspaces, MkosiWorkspace } from '../api/extras'
import { useToastContext } from '../contexts/ToastContext'
import { ArrowLeft, Server, Layers, HardDrive, Cloud, Disc, Boxes, FileText, Check } from 'lucide-react'

function linesToList(s: string): string[] {
  return s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
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
    create_backend: '',
    virt_builder_os: '',
    virt_builder_hostname: '',
    virt_builder_ssh_pubkey: '',
    virt_builder_root_password_file: '',
    virt_builder_selinux_relabel: false,
    virt_builder_sysprep: false,
    mkosi_workspace: '',
    mkosi_image: '',
  })
  const [diskMode, setDiskMode] = useState<DiskMode>('mkosi')
  const [mkosiWorkspaces, setMkosiWorkspaces] = useState<MkosiWorkspace[]>([])
  const [vbTemplates, setVbTemplates] = useState<string[]>([])
  const [vbPkgLines, setVbPkgLines] = useState('')
  const [vbFirstbootLines, setVbFirstbootLines] = useState('')
  const [vbPostInstLines, setVbPostInstLines] = useState('')
  const [vbPostRunLines, setVbPostRunLines] = useState('')
  const [vbNotesText, setVbNotesText] = useState<string | null>(null)
  const [templates, setTemplates] = useState<VmTemplate[]>([])
  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [isoFiles, setIsoFiles] = useState<ImageFile[]>([])
  const [diskFiles, setDiskFiles] = useState<ImageFile[]>([])
  const [savedTemplates, setSavedTemplates] = useState<VmTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [showCloudInit, setShowCloudInit] = useState(false)
  const [ciUser, setCiUser] = useState('')
  const [ciPass, setCiPass] = useState('')
  const [ciSshKey, setCiSshKey] = useState('')
  const toast = useToastContext()
  const navigate = useNavigate()

  useEffect(() => {
    getTemplates().then(setTemplates).catch(() => {})
    listSavedTemplates().then(setSavedTemplates).catch(() => {})
    listNetworks().then(setNetworks).catch(() => {})
    listIsos().then(setIsoFiles).catch(() => {})
    listDiskImages().then(setDiskFiles).catch(() => {})
    listVirtBuilderTemplates().then((r) => setVbTemplates(r.templates || [])).catch(() => setVbTemplates([]))
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.warning('Name is required'); return }
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
      await createVM(req)
      toast.success(`Created VM '${form.name}'`)
      navigate('/vms')
    } catch (e: unknown) {
      toast.error(`Failed to create VM: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/vms" className="p-2 hover:bg-slate-700 rounded transition" aria-label="Back"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold">Create Virtual Machine</h1>
      </div>

      {/* Templates */}
      {(templates.length > 0 || savedTemplates.length > 0) && (
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
        <h3 className="text-lg font-semibold flex items-center gap-2"><Server className="w-5 h-5 text-green-500" /> Configuration</h3>

        <div>
          <label htmlFor="create-backend" className="block text-sm text-slate-400 mb-1">Create engine</label>
          <select
            id="create-backend"
            className="input-field"
            value={form.create_backend || ''}
            onChange={(e) => setForm({ ...form, create_backend: e.target.value })}
          >
            <option value="">Server default (see virtspawn config)</option>
            <option value="libvirt_xml">Native libvirt XML (virtspawn)</option>
            <option value="virt_install">virt-install (hyper2kvm-style)</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">Use virt-install for libvirt&apos;s installer flow; use native XML for full graphics, cloud-init CD layout, and UEFI XML control.</p>
        </div>

        <div>
          <label htmlFor="vm-name" className="block text-sm text-slate-400 mb-1">VM Name *</label>
          <input id="vm-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="my-vm" />
        </div>

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

        {/* Disk Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Storage</span>
          </div>
          <p className="text-xs text-slate-500 -mt-1">Default: <strong className="text-slate-400 font-medium">mkosi</strong> — <code className="text-slate-500">install.sh</code> / deploy installs upstream systemd/mkosi (v16+) to <code className="text-slate-500">/usr/local/bin</code> when needed. On Alma/RHEL/Rocky 9, <code className="text-slate-500">dnf install mkosi</code> from EPEL is often <strong className="text-slate-400">mkosi 12</strong>; prefer install.sh/pipx for current recipes.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, virt_builder_os: '', mkosi_workspace: '', virt_builder_hostname: '', virt_builder_ssh_pubkey: '', virt_builder_root_password_file: '', virt_builder_selinux_relabel: false, virt_builder_sysprep: false }))
                setVbPkgLines(''); setVbFirstbootLines(''); setVbPostInstLines(''); setVbPostRunLines(''); setVbNotesText(null)
                setDiskMode('new')
              }}
              className={`px-3 py-1.5 rounded text-xs transition ${diskMode === 'new' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              New Disk
            </button>
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, virt_builder_os: '', mkosi_workspace: '', virt_builder_hostname: '', virt_builder_ssh_pubkey: '', virt_builder_root_password_file: '', virt_builder_selinux_relabel: false, virt_builder_sysprep: false }))
                setVbPkgLines(''); setVbFirstbootLines(''); setVbPostInstLines(''); setVbPostRunLines(''); setVbNotesText(null)
                setDiskMode('existing')
              }}
              className={`px-3 py-1.5 rounded text-xs transition ${diskMode === 'existing' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Existing Disk Image
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
              mkosi workspace (default)
            </button>
            <button
              type="button"
              onClick={() => {
                if (goldenSaved) {
                  setForm((f) => ({ ...f, saved_template: '', template_disk_mode: 'backing' }))
                  setSelectedTemplate('')
                  toast.info('Cleared golden saved template for virt-builder.')
                }
                setForm((f) => ({ ...f, mkosi_workspace: '', mkosi_image: '', virt_builder_hostname: '', virt_builder_ssh_pubkey: '', virt_builder_root_password_file: '', virt_builder_selinux_relabel: false, virt_builder_sysprep: false }))
                setVbPkgLines(''); setVbFirstbootLines(''); setVbPostInstLines(''); setVbPostRunLines(''); setVbNotesText(null)
                setDiskMode('virt_builder')
              }}
              className={`px-3 py-1.5 rounded text-xs transition flex items-center gap-1 ${diskMode === 'virt_builder' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              <Boxes className="w-3.5 h-3.5" /> virt-builder
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
                ). The daemon passes <code className="text-slate-300">--output-dir</code> and <code className="text-slate-300">--workspace-directory</code> into an ephemeral directory under <code className="text-slate-300">/var/tmp</code>; the resulting <code className="text-slate-300">.raw</code> or <code className="text-slate-300">.qcow2</code> is converted and moved to the libvirt image pool — nothing is left in your workspace. Install.sh installs upstream mkosi (v16+) from GitHub when not already present and symlinks <code className="text-slate-300">/usr/local/bin/mkosi</code>.
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
                Builds a bootable qcow2 from the libguestfs template index on the host (<code className="text-slate-300">virt-builder --list</code>). Requires <code className="text-slate-300">virt-builder</code> installed and network for first-time template cache. No golden image per OS.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[12rem]">
                  <label htmlFor="vb-os" className="block text-sm text-slate-400 mb-1">OS template *</label>
                  <input
                    id="vb-os"
                    list="vb-os-datalist"
                    type="text"
                    value={form.virt_builder_os || ''}
                    onChange={(e) => { setForm({ ...form, virt_builder_os: e.target.value }); setVbNotesText(null) }}
                    className="input-field"
                    placeholder="ubuntu-22.04"
                    autoComplete="off"
                  />
                  <datalist id="vb-os-datalist">
                    {vbTemplates.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
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
            </div>
          ) : diskMode === 'new' ? (
            <div>
              <label htmlFor="vm-disk" className="block text-sm text-slate-400 mb-1">Disk Size (GB)</label>
              <input id="vm-disk" type="number" min={1} value={form.disk_gb} onChange={(e) => setForm({ ...form, disk_gb: parseInt(e.target.value) || 10 })} className="input-field" />
            </div>
          ) : (
            <div>
              <label htmlFor="vm-existing-disk" className="block text-sm text-slate-400 mb-1">Disk Image Path *</label>
              {diskFiles.length > 0 ? (
                <select id="vm-existing-disk" value={form.existing_disk || ''} onChange={(e) => setForm({ ...form, existing_disk: e.target.value })} className="input-field">
                  <option value="">Select disk image...</option>
                  {diskFiles.map(f => <option key={f.path} value={f.path}>{f.name} ({(f.size_bytes / 1073741824).toFixed(1)} GB)</option>)}
                </select>
              ) : (
                <input id="vm-existing-disk" type="text" value={form.existing_disk || ''} onChange={(e) => setForm({ ...form, existing_disk: e.target.value })} className="input-field" placeholder="/var/lib/libvirt/images/disk.qcow2" />
              )}
              <p className="text-xs text-slate-500 mt-1">Supports qcow2, raw, and img formats.</p>
            </div>
          )}
        </div>

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
          ) : isoFiles.length > 0 ? (
            <select id="vm-iso" value={form.iso || ''} onChange={(e) => setForm({ ...form, iso: e.target.value })} className="input-field">
              <option value="">No ISO</option>
              {isoFiles.map(f => <option key={f.path} value={f.path}>{f.name} ({(f.size_bytes / 1048576).toFixed(0)} MB)</option>)}
            </select>
          ) : (
            <input id="vm-iso" type="text" value={form.iso || ''} onChange={(e) => setForm({ ...form, iso: e.target.value })} className="input-field" placeholder="/path/to/image.iso" />
          )}
        </div>

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

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
          <Link to="/vms" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition">Cancel</Link>
          <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm transition">
            {submitting ? 'Creating...' : 'Create VM'}
          </button>
        </div>
      </form>
    </div>
  )
}

import { BrowserRouter, Routes, Route, useNavigate } from 'react-router'
import { ZyvorFooter } from './components/ZyvorBrand';
import { Suspense, lazy, useState, useCallback, useMemo } from 'react'
import { ToastProvider } from './contexts/ToastContext'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { PlatformInfoProvider } from './contexts/PlatformInfoContext'
import Navbar from './components/Navbar'
import NotFound from './pages/NotFound'
import LoginPage from './pages/Login'
import CommandPalette from './components/CommandPalette'
import Breadcrumb from './components/Breadcrumb'
import HelpDialog, { type HelpTab } from './components/HelpDialog'
import PageSkeleton from './components/PageSkeleton'
import { useSequenceShortcuts } from './hooks/useSequenceShortcut'
import { useKeyboardShortcut, isInputFocused } from './hooks/useKeyboardShortcut'
import { usePlatformInfo } from './contexts/PlatformInfoContext'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const VMList = lazy(() => import('./pages/VMList'))
const VMDetails = lazy(() => import('./pages/VMDetails'))
const CreateVM = lazy(() => import('./pages/CreateVM'))
const Networks = lazy(() => import('./pages/Networks'))
const Storage = lazy(() => import('./pages/Storage'))
const Snapshots = lazy(() => import('./pages/Snapshots'))
const NodeInfo = lazy(() => import('./pages/NodeInfo'))
const Events = lazy(() => import('./pages/Events'))
const Console = lazy(() => import('./pages/Console'))
const Capabilities = lazy(() => import('./pages/Capabilities'))
const Devices = lazy(() => import('./pages/Devices'))
const NWFilters = lazy(() => import('./pages/NWFilters'))
const Secrets = lazy(() => import('./pages/Secrets'))
const Backups = lazy(() => import('./pages/Backups'))
const HostNetworking = lazy(() => import('./pages/HostNetworking'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const ImportVM = lazy(() => import('./pages/ImportVM'))
const SSHPage = lazy(() => import('./pages/SSHPage'))
const HostSSHPage = lazy(() => import('./pages/HostSSHPage'))
const ApiDocs = lazy(() => import('./pages/ApiDocs'))
const Services = lazy(() => import('./pages/Services'))
const Logs = lazy(() => import('./pages/Logs'))
const StoragePoolDetail = lazy(() => import('./pages/StoragePoolDetail'))
const AdminSessions = lazy(() => import('./pages/AdminSessions'))
const DiskImages = lazy(() => import('./pages/DiskImages'))
const Jobs = lazy(() => import('./pages/Jobs'))
const K8sOverview = lazy(() => import('./pages/K8sOverview'))
const K8sWorkloads = lazy(() => import('./pages/K8sWorkloads'))
const KataContainers = lazy(() => import('./pages/KataContainers'))
const OpenStackOverview = lazy(() => import('./pages/OpenStackOverview'))
const OpenStackInstances = lazy(() => import('./pages/OpenStackInstances'))
const OpenStackInstanceDetail = lazy(() => import('./pages/OpenStackInstanceDetail'))
const OpenStackCreateInstance = lazy(() => import('./pages/OpenStackCreateInstance'))
const OpenStackImages = lazy(() => import('./pages/OpenStackImages'))
const OpenStackMigrations = lazy(() => import('./pages/OpenStackMigrations'))

function AppZyvorFooter() {
  const { info } = usePlatformInfo()
  const hostOs = info?.host?.os_pretty_name?.trim()
  return <ZyvorFooter hostOs={hostOs || undefined} />
}

function GlobalShortcuts({
  helpOpen,
  helpTab,
  onOpenHelp,
  onCloseHelp,
  onHelpTabChange,
}: {
  helpOpen: boolean
  helpTab: HelpTab
  onOpenHelp: (tab?: HelpTab) => void
  onCloseHelp: () => void
  onHelpTabChange: (tab: HelpTab) => void
}) {
  const navigate = useNavigate()
  const shortcuts = useMemo(() => {
    const base: { sequence: [string, string]; handler: () => void }[] = [
      { sequence: ['g', 'd'], handler: () => navigate('/') },
      { sequence: ['g', 'v'], handler: () => navigate('/vms') },
      { sequence: ['g', 'n'], handler: () => navigate('/networks') },
      { sequence: ['g', 's'], handler: () => navigate('/storage') },
      { sequence: ['g', 'c'], handler: () => navigate('/create') },
      { sequence: ['g', 'e'], handler: () => navigate('/events') },
      { sequence: ['g', 'j'], handler: () => navigate('/jobs') },
      { sequence: ['g', 'b'], handler: () => navigate('/backups') },
      { sequence: ['g', 'i'], handler: () => navigate('/disk-images') },
      { sequence: ['g', 'k'], handler: () => navigate('/k8s/workloads') },
      { sequence: ['g', 'o'], handler: () => navigate('/openstack') },
    ]
    return base
  }, [navigate])

  useSequenceShortcuts(shortcuts)

  const toggleHelp = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return
      e.preventDefault()
      if (helpOpen) onCloseHelp()
      else onOpenHelp('shortcuts')
    },
    [helpOpen, onCloseHelp, onOpenHelp],
  )

  useKeyboardShortcut({ key: '?', handler: toggleHelp })

  return (
    <HelpDialog open={helpOpen} tab={helpTab} onClose={onCloseHelp} onTabChange={onHelpTabChange} />
  )
}

function AuthenticatedApp() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen light-theme:bg-white light-theme:text-slate-900 bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 light-theme:border-blue-600 border-blue-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <AuthenticatedShell />
}

function AuthenticatedShell() {
  const { theme } = useTheme()
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpTab, setHelpTab] = useState<HelpTab>('shortcuts')

  const openHelp = useCallback((tab: HelpTab = 'shortcuts') => {
    setHelpTab(tab)
    setHelpOpen(true)
  }, [])

  const closeHelp = useCallback(() => setHelpOpen(false), [])

  const shellClass =
    theme === 'steel'
      ? 'dashboard-steel min-h-screen flex flex-col text-[#d7dde5]'
      : theme === 'light'
        ? 'min-h-screen bg-white text-slate-900'
        : 'min-h-screen bg-slate-950 text-slate-100'

  return (
    <WebSocketProvider>
      <PlatformInfoProvider>
        <BrowserRouter>
          <div className={`${shellClass} flex flex-col min-h-screen`}>
            <Navbar onOpenHelp={openHelp} />
            <CommandPalette />
            <GlobalShortcuts
              helpOpen={helpOpen}
              helpTab={helpTab}
              onOpenHelp={openHelp}
              onCloseHelp={closeHelp}
              onHelpTabChange={setHelpTab}
            />
            <main className={`app-shell flex-1 min-w-0 py-6 lg:py-8${theme === 'steel' ? ' steel-content' : ''}`}>
              <Breadcrumb />
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/vms" element={<VMList />} />
                <Route path="/vms/:name" element={<VMDetails />} />
                <Route path="/vms/:name/console" element={<Console />} />
                <Route path="/create" element={<CreateVM />} />
                <Route path="/jobs/:jobId" element={<Jobs />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/k8s" element={<K8sOverview />} />
                <Route path="/k8s/workloads" element={<K8sWorkloads />} />
                <Route path="/k8s/kata" element={<KataContainers />} />
                <Route path="/openstack" element={<OpenStackOverview />} />
                <Route path="/openstack/instances" element={<OpenStackInstances />} />
                <Route path="/openstack/instances/:id" element={<OpenStackInstanceDetail />} />
                <Route path="/openstack/create" element={<OpenStackCreateInstance />} />
                <Route path="/openstack/images" element={<OpenStackImages />} />
                <Route path="/openstack/migrations" element={<OpenStackMigrations />} />
                <Route path="/networks" element={<Networks />} />
                <Route path="/storage" element={<Storage />} />
                <Route path="/storage/:pool" element={<StoragePoolDetail />} />
                <Route path="/disk-images" element={<DiskImages />} />
                <Route path="/snapshots" element={<Snapshots />} />
                <Route path="/node" element={<NodeInfo />} />
                <Route path="/events" element={<Events />} />
                <Route path="/capabilities" element={<Capabilities />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/nwfilters" element={<NWFilters />} />
                <Route path="/secrets" element={<Secrets />} />
                <Route path="/backups" element={<Backups />} />
                <Route path="/host-networking" element={<HostNetworking />} />
                <Route path="/host-ssh" element={<HostSSHPage />} />
                <Route path="/audit" element={<AuditLog />} />
                <Route path="/import" element={<ImportVM />} />
                <Route path="/ssh/:host" element={<SSHPage />} />
                <Route path="/ssh" element={<SSHPage />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="/services" element={<Services />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/admin/sessions" element={<AdminSessions />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <AppZyvorFooter />
        </div>
        </BrowserRouter>
      </PlatformInfoProvider>
    </WebSocketProvider>
  )
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App

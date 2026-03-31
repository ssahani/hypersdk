import { BrowserRouter, Routes, Route } from 'react-router'
import { Suspense, lazy } from 'react'
import { ToastProvider } from './contexts/ToastContext'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Navbar from './components/Navbar'
import NotFound from './pages/NotFound'
import LoginPage from './pages/Login'

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
const Backups = lazy(() => import('./pages/Backups'))
const HostNetworking = lazy(() => import('./pages/HostNetworking'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const ImportVM = lazy(() => import('./pages/ImportVM'))
const SSHPage = lazy(() => import('./pages/SSHPage'))
const ApiDocs = lazy(() => import('./pages/ApiDocs'))
const Services = lazy(() => import('./pages/Services'))
const Logs = lazy(() => import('./pages/Logs'))

function AuthenticatedApp() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <WebSocketProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/vms" element={<VMList />} />
                <Route path="/vms/:name" element={<VMDetails />} />
                <Route path="/vms/:name/console" element={<Console />} />
                <Route path="/create" element={<CreateVM />} />
                <Route path="/networks" element={<Networks />} />
                <Route path="/storage" element={<Storage />} />
                <Route path="/snapshots" element={<Snapshots />} />
                <Route path="/node" element={<NodeInfo />} />
                <Route path="/events" element={<Events />} />
                <Route path="/capabilities" element={<Capabilities />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/nwfilters" element={<NWFilters />} />
                <Route path="/backups" element={<Backups />} />
                <Route path="/host-networking" element={<HostNetworking />} />
                <Route path="/audit" element={<AuditLog />} />
                <Route path="/import" element={<ImportVM />} />
                <Route path="/ssh/:host" element={<SSHPage />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="/services" element={<Services />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
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

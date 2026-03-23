import { BrowserRouter, Routes, Route } from 'react-router'
import { Suspense, lazy } from 'react'
import { ToastProvider } from './contexts/ToastContext'
import { WebSocketProvider } from './contexts/WebSocketContext'
import Navbar from './components/Navbar'
import NotFound from './pages/NotFound'

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

function App() {
  return (
    <ToastProvider>
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
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </BrowserRouter>
      </WebSocketProvider>
    </ToastProvider>
  )
}

export default App

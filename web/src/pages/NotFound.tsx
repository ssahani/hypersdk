import { Link } from 'react-router'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center animate-fade-in">
      <h1 className="text-7xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-4">404</h1>
      <p className="text-slate-400 font-medium mb-2">Page not found</p>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/" className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl text-sm font-medium shadow-lg shadow-blue-600/20 transition-all">
        <Home className="w-4 h-4" /> Go to Dashboard
      </Link>
    </div>
  )
}

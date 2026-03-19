import { Link } from 'react-router'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <h1 className="text-4xl font-bold text-gray-400 mb-4">404</h1>
      <p className="text-gray-500 mb-6">Page not found</p>
      <Link to="/" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition">Go to Dashboard</Link>
    </div>
  )
}

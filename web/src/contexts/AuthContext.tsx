import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { login as apiLogin, logout as apiLogout, getSession } from '../api/auth'

interface AuthContextType {
  isAuthenticated: boolean
  username: string
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  username: '',
  loading: true,
  login: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)

  // Check existing session on mount
  useEffect(() => {
    getSession()
      .then((session) => {
        setIsAuthenticated(session.authenticated)
        setUsername(session.username || '')
      })
      .catch(() => {
        setIsAuthenticated(false)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (user: string, pass: string) => {
    const result = await apiLogin(user, pass)
    setIsAuthenticated(true)
    setUsername(result.username)
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setIsAuthenticated(false)
    setUsername('')
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

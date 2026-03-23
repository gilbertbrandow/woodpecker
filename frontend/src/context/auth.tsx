import { createContext, useContext, useEffect, useState } from 'react'
import { api, type AuthUser } from '../lib/api'

export type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
  updateUser: (updated: AuthUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const logout = async (): Promise<void> => {
    await api.auth.logout()
    setUser(null)
  }

  const updateUser = (updated: AuthUser): void => {
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

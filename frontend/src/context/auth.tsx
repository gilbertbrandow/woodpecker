import { createContext, useContext, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { api, type AuthUser, type OnboardingState, type WaitlistedState } from '../lib/api'

export type AuthContextValue = {
  user: AuthUser | null
  onboarding: OnboardingState | null
  waitlisted: WaitlistedState | null
  loading: boolean
  logout: () => Promise<void>
  updateUser: (updated: AuthUser) => void
  setWaitlisted: (state: WaitlistedState) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null)
  const [waitlisted, setWaitlisted] = useState<WaitlistedState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.auth
      .me()
      .then((state) => {
        if (state.status === 'active') {
          setUser(state)
        } else if (state.status === 'onboarding') {
          setOnboarding(state)
        } else if (state.status === 'waitlisted') {
          setWaitlisted(state)
        }
      })
      .catch(() => {
        setUser(null)
        setOnboarding(null)
        setWaitlisted(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const logout = async (): Promise<void> => {
    await api.auth.logout()
    flushSync(() => {
      setUser(null)
      setOnboarding(null)
      setWaitlisted(null)
    })
  }

  const updateUser = (updated: AuthUser): void => {
    setUser(updated)
  }

  const handleSetWaitlisted = (state: WaitlistedState): void => {
    setWaitlisted(state)
  }

  return (
    <AuthContext.Provider value={{ user, onboarding, waitlisted, loading, logout, updateUser, setWaitlisted: handleSetWaitlisted }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

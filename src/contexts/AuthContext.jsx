import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(undefined) // undefined = loading, null = no session
  const [profile, setProfile]   = useState(null)

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*, technicians(id, first_name, last_initial, color_hex)')
        .eq('user_id', userId)
        .maybeSingle()
      if (!error) setProfile(data ?? null)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
      if (session?.user) fetchProfile(session.user.id)
    })

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  const value = {
    session,
    profile,
    user: session?.user ?? null,
    role: profile?.role ?? null,
    isManager: profile?.role === 'manager',
    isTechnician: profile?.role === 'technician',
    // loading is true until we have a definitive session value (not undefined)
    loading: session === undefined,
    signOut,
    refetchProfile: () => session?.user ? fetchProfile(session.user.id) : null,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

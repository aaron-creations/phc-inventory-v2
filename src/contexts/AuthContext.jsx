import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

/* ─── Constants ───────────────────────────────────────── */
const IDLE_TIMEOUT_MS  = 30 * 60 * 1000  // 30 minutes of inactivity → sign out
const WARN_BEFORE_MS   = 60 * 1000        // Show warning 60 seconds before logout

const ACTIVITY_EVENTS  = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']

/* ─── Context ─────────────────────────────────────────── */
const AuthContext = createContext(null)

/* ─── Warning Banner ──────────────────────────────────── */
function IdleWarningBanner({ secondsLeft, onStayLoggedIn }) {
  return (
    <div
      role="alert"
      style={{ zIndex: 9999 }}
      className="fixed bottom-0 left-0 right-0 p-4 flex justify-center pointer-events-none"
    >
      <div className="pointer-events-auto w-full max-w-sm bg-forest-900 border border-brand-orange/40 rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-4">
        <div className="text-2xl flex-shrink-0">⏱️</div>
        <div className="flex-1 min-w-0">
          <p className="text-brand-orange text-sm font-semibold leading-snug">
            Signing out in {secondsLeft}s
          </p>
          <p className="text-white/40 text-xs mt-0.5">
            You've been idle. Tap to stay logged in.
          </p>
        </div>
        <button
          onClick={onStayLoggedIn}
          className="flex-shrink-0 bg-brand-orange/15 hover:bg-brand-orange/25 text-brand-orange text-xs font-bold px-3 py-2 rounded-xl transition-colors"
        >
          Stay
        </button>
      </div>
    </div>
  )
}

/* ─── Provider ────────────────────────────────────────── */
export function AuthProvider({ children }) {
  const [session, setSession]         = useState(undefined)
  const [profile, setProfile]         = useState(null)
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)

  const idleTimerRef    = useRef(null)
  const warnTimerRef    = useRef(null)
  const countdownRef    = useRef(null)
  const isLoggedIn      = useRef(false)

  /* ── signOut ──────────────────────────────────────── */
  async function signOut() {
    clearAllTimers()
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setShowWarning(false)
  }

  /* ── fetchProfile ─────────────────────────────────── */
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

  /* ── timer helpers ────────────────────────────────── */
  function clearAllTimers() {
    clearTimeout(idleTimerRef.current)
    clearTimeout(warnTimerRef.current)
    clearInterval(countdownRef.current)
  }

  function startCountdown() {
    setSecondsLeft(Math.round(WARN_BEFORE_MS / 1000))
    clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(countdownRef.current); return 0 }
        return s - 1
      })
    }, 1000)
  }

  const resetIdleTimer = useCallback(() => {
    if (!isLoggedIn.current) return

    // If warning was showing, dismiss it
    if (showWarning) {
      setShowWarning(false)
      clearInterval(countdownRef.current)
    }

    clearAllTimers()

    // Set warning to appear WARN_BEFORE_MS before logout
    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true)
      startCountdown()
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS)

    // Set actual logout
    idleTimerRef.current = setTimeout(() => {
      signOut()
    }, IDLE_TIMEOUT_MS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWarning])

  /* ── "Stay logged in" handler ─────────────────────── */
  function handleStayLoggedIn() {
    setShowWarning(false)
    clearInterval(countdownRef.current)
    resetIdleTimer()
  }

  /* ── Auth state listener ──────────────────────────── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
      if (session?.user) fetchProfile(session.user.id)
    })

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

  /* ── Idle timer — attach/detach based on login state ── */
  useEffect(() => {
    const loggedIn = !!session  // session is null when logged out, object when in
    isLoggedIn.current = loggedIn

    if (!loggedIn) {
      // Logged out — clear everything
      clearAllTimers()
      setShowWarning(false)
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetIdleTimer))
      return
    }

    // Logged in — start the idle timer and listen for activity
    resetIdleTimer()
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }))

    return () => {
      clearAllTimers()
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetIdleTimer))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!session])  // Only re-run when login STATE changes (not on every session object update)

  /* ── Context value ────────────────────────────────── */
  const value = {
    session,
    profile,
    user: session?.user ?? null,
    role: profile?.role ?? null,
    isManager: profile?.role === 'manager',
    isTechnician: profile?.role === 'technician',
    loading: session === undefined,
    signOut,
    refetchProfile: () => session?.user ? fetchProfile(session.user.id) : null,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showWarning && session && (
        <IdleWarningBanner
          secondsLeft={secondsLeft}
          onStayLoggedIn={handleStayLoggedIn}
        />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

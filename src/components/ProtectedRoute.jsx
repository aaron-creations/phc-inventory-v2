import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute — requires any authenticated session with an approved role.
 * - No session → /login
 * - Pending role → /access-pending
 * - Approved (manager or technician) → renders children
 */
export function ProtectedRoute({ children }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  // Still initializing auth
  if (loading) return <AuthSpinner />

  // Not logged in at all
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />

  // Logged in but profile not fetched yet — keep waiting
  if (session && profile === null) return <AuthSpinner />

  // Logged in but awaiting manager approval
  if (profile?.role === 'pending') return <Navigate to="/access-pending" replace />

  return children
}

/**
 * ManagerRoute — requires 'manager' role specifically.
 */
export function ManagerRoute({ children }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthSpinner />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (session && profile === null) return <AuthSpinner />
  if (profile?.role === 'pending') return <Navigate to="/access-pending" replace />
  if (profile?.role !== 'manager') return <Navigate to="/" replace />

  return children
}

/**
 * GuestRoute — only for unauthenticated users (login page).
 * Redirects approved users away from the login page.
 */
export function GuestRoute({ children }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <AuthSpinner />

  if (session && profile?.role === 'pending') return <Navigate to="/access-pending" replace />
  if (session && (profile?.role === 'manager' || profile?.role === 'technician')) {
    return <Navigate to="/" replace />
  }

  return children
}

function AuthSpinner() {
  return (
    <div className="min-h-screen bg-forest-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <img src="/phc-logo.png" alt="PHC" className="w-12 h-12 opacity-60 animate-pulse" />
        <p className="text-white/30 text-sm">Loading…</p>
      </div>
    </div>
  )
}

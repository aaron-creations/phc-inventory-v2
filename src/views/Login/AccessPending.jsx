import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function AccessPending() {
  const { role, loading, signOut } = useAuth()
  const navigate = useNavigate()

  // If they somehow get approved while on this page, move them along
  useEffect(() => {
    if (!loading && (role === 'manager' || role === 'technician')) {
      navigate('/', { replace: true })
    }
  }, [role, loading])

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center px-6 text-center">
      {/* Radial glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(74,222,128,0.05) 0%, transparent 70%)',
        }}
      />

      <img src="/phc-logo.png" alt="Plant Health Care" className="w-32 h-32 mb-6" />

      <h1 className="font-serif text-3xl font-bold text-white mb-3">
        Access Pending
      </h1>

      <p className="text-white/40 text-sm max-w-sm leading-relaxed mb-8">
        Your account has been created, but a manager needs to approve your access before you can use the application.
        <br /><br />
        Please contact your PHC manager and ask them to approve your account in the <span className="text-white/60">Manager → Users</span> panel.
      </p>

      {/* Status indicator */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand-orange/10 border border-brand-orange/20 mb-8">
        <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
        <span className="text-brand-orange text-xs font-medium">Awaiting approval</span>
      </div>

      <button
        onClick={signOut}
        className="text-white/25 hover:text-white/50 text-xs transition-colors"
      >
        Sign out and try a different account
      </button>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  
  const { session, profile, refetchProfile, signOut } = useAuth()

  // Protect the route locally
  useEffect(() => {
    // If not logged in, go to login
    if (!session) {
      navigate('/login', { replace: true })
      return
    }
    // If they already have a password set, send them to their proper destination
    if (profile?.has_password) {
      if (profile.role === 'pending') navigate('/access-pending', { replace: true })
      else navigate('/', { replace: true })
    }
  }, [session, profile, navigate])

  async function handleSetPassword(e) {
    e.preventDefault()
    if (!password) { setError('Please enter a password'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })
    
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Refresh the profile to get the updated has_password status
    await refetchProfile()
    setSuccess(true)
  }

  // Handle successful password setup
  useEffect(() => {
    if (success && profile) {
      if (profile.role === 'pending') {
        // Auto-logout pending users after 3 seconds
        const timer = setTimeout(() => {
          signOut()
          navigate('/login', { replace: true })
        }, 5000)
        return () => clearTimeout(timer)
      } else {
        // Automatically redirect approved users immediately
        navigate('/', { replace: true })
      }
    }
  }, [success, profile, navigate, signOut])

  if (success && profile?.role === 'pending') {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-brand-green/20 flex items-center justify-center text-brand-green text-3xl mb-6">
          ✓
        </div>
        <h2 className="font-serif text-3xl font-bold text-white mb-3">Password Set!</h2>
        <p className="text-white/40 max-w-sm mb-6">
          Your account is now secure and your access request is being reviewed.
          You will be notified once a manager approves your access.
        </p>
        <p className="text-white/20 text-xs">Signing you out safely...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(74,222,128,0.05) 0%, transparent 70%)' }}
      />

      <img src="/phc-logo.png" alt="PHC" className="w-24 h-24 mb-6 relative z-10" />

      <div className="bg-forest-900 border border-white/5 p-8 rounded-2xl w-full max-w-sm relative z-10 shadow-2xl">
        <h2 className="font-serif text-2xl font-bold text-white mb-2 text-left">Set Password</h2>
        <p className="text-white/40 text-sm mb-6 text-left">
          Please secure your account with a password before continuing.
        </p>

        <form onSubmit={handleSetPassword} className="text-left">
          <div className="mb-4">
            <label className="text-white/40 text-xs mb-1.5 block">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-brand-green/50 transition-colors"
            />
          </div>
          <div className="mb-6">
            <label className="text-white/40 text-xs mb-1.5 block">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-brand-green/50 transition-colors"
            />
          </div>

          {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-green text-forest-950 font-semibold text-sm disabled:opacity-40 hover:bg-brand-green/90 transition-all"
          >
            {loading ? 'Saving…' : 'Save Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

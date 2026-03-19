import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function ManagerLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Invalid credentials. Please try again.')
    } else {
      navigate('/manager/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Back */}
        <button
          onClick={() => navigate('/')}
          className="text-white/40 hover:text-white text-sm mb-8 transition-colors"
        >
          ← Back to Dashboard
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚙️</div>
          <h1 className="text-white font-bold text-2xl">Manager Access</h1>
          <p className="text-white/40 text-sm mt-1">Sign in to manage inventory & team</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 text-sm outline-none focus:border-brand-green/50 transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 text-sm outline-none focus:border-brand-green/50 transition-colors"
          />
          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-brand-green text-forest-950 font-bold text-sm transition-all disabled:opacity-50 hover:bg-brand-green/90 mt-1"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

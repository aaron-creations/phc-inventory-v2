import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const [mode, setMode] = useState('options') // 'options' | 'email'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const navigate = useNavigate()
  const { session } = useAuth()

  useEffect(() => {
    if (session) navigate('/hub', { replace: true })
  }, [session])

  async function handleGoogle() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/hub` },
    })
    if (error) setError(error.message)
  }

  async function handleEmailLogin(e) {
    e.preventDefault()
    setError(''); setSuccessMsg(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  async function handleEmailSignUp(e) {
    e.preventDefault()
    setError(''); setSuccessMsg(''); setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/hub` }
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccessMsg('Request submitted! A manager will review your account.')
      // Supabase auto-logs them in if email confirmations are disabled (which they might be).
      // If logged in, the session starts, profile is pending, and they get routed to /access-pending.
    }
  }

  return (
    <div className="min-h-screen bg-forest-950 flex overflow-hidden">

      {/* ── LEFT HERO PANEL (lg+) ─────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden">

        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 70% at 40% 60%, rgba(74,222,128,0.07) 0%, transparent 70%)' }}
        />
        {/* Subtle grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Brand mark — logo only, text is in the badge */}
        <div className="flex items-center gap-3 relative z-10">
          <img src="/phc-logo.png" alt="PHC" className="w-12 h-12" />
          <p className="text-white/40 text-xs">Systems</p>
        </div>

        {/* Hero */}
        <div className="flex flex-col items-center justify-center flex-1 relative z-10 py-8">
          <img
            src="/phc-logo.png"
            alt="PHC"
            className="w-64 h-64 mb-8 drop-shadow-2xl"
            style={{ filter: 'drop-shadow(0 0 40px rgba(74,222,128,0.20))' }}
          />
          <h1 className="font-serif text-5xl font-bold text-white text-center leading-tight mb-4">
            Grow smarter.<br />
            <span className="text-brand-green">Track everything.</span>
          </h1>
          <p className="text-white/40 text-center text-base max-w-sm leading-relaxed">
            The complete Plant Health Care operations platform — CRM, Fleet management, blend rates, technician logs, and real-time stock levels, all in one place.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 relative z-10">
          {['📦 Real-time Stock', '🧬 Blend Mix Rates', '👤 Tech Logging', '📊 Analytics', '🤝 CRM', '🚚 Fleet', '🔒 Role-Based Access'].map(f => (
            <span key={f} className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-white/40">
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* ── RIGHT LOGIN PANEL ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col items-center justify-center px-8 py-12 relative bg-forest-900 lg:border-l lg:border-white/5">

        {/* Mobile logo — badge is self-labelled */}
        <div className="flex lg:hidden flex-col items-center mb-10">
          <img src="/phc-logo.png" alt="PHC" className="w-28 h-28 mb-2" />
        </div>

        <div className="w-full max-w-sm">

          {mode === 'options' && (
            <>
              <h2 className="font-serif text-3xl font-bold text-white mb-1">Welcome back</h2>
              <p className="text-white/40 text-sm mb-8">Sign in to access your inventory dashboard.</p>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white text-gray-800 font-medium text-sm hover:bg-gray-100 transition-all mb-4 shadow-sm"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/25 text-xs">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Email */}
              <button
                type="button"
                onClick={() => setMode('email')}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-sm font-medium transition-all"
              >
                ✉️ Continue with Email
              </button>

              {error && <p className="text-red-400 text-xs mt-4 text-center">{error}</p>}

              <p className="text-white/20 text-xs text-center mt-8 leading-relaxed">
                Access is restricted to authorized PHC team members.<br />
                New accounts require manager approval.
              </p>
            </>
          )}

          {mode === 'email' && (
            <>
              <h2 className="font-serif text-3xl font-bold text-white mb-1">
                {isSignUp ? 'Request Access' : 'Email sign in'}
              </h2>
              <p className="text-white/40 text-sm mb-6">
                {isSignUp ? 'Create an account to request access.' : 'Enter your email to continue.'}
              </p>

              <button
                onClick={() => { setMode('options'); setError(''); setSuccessMsg(''); setIsSignUp(false) }}
                className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs mb-6 transition-colors"
              >
                ← Back
              </button>

              {/* Email field */}
              <div className="mb-3">
                <label className="text-white/40 text-xs mb-1.5 block">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 outline-none focus:border-brand-green/50 transition-colors"
                />
              </div>

              {/* Password login / Signup */}
              <form onSubmit={isSignUp ? handleEmailSignUp : handleEmailLogin} className="mb-2">
                <div className="mb-3">
                  <label className="text-white/40 text-xs mb-1.5 block">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 outline-none focus:border-brand-green/50 transition-colors"
                  />
                </div>
                {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
                {successMsg && <p className="text-brand-green text-xs mb-2">{successMsg}</p>}
                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full py-3 rounded-xl bg-brand-green text-forest-950 font-semibold text-sm disabled:opacity-40 hover:bg-brand-green/90 transition-all"
                >
                  {loading 
                    ? (isSignUp ? 'Requesting…' : 'Signing in…') 
                    : (isSignUp ? 'Request Access' : 'Sign In with Password')}
                </button>
              </form>

              {/* Toggle Sign Up / Sign In */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMsg(''); }}
                  className="text-white/40 hover:text-white text-xs transition-colors"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Request access"}
                </button>
              </div>

            </>
          )}
        </div>

        <p className="absolute bottom-6 text-white/15 text-xs">PHC Inventory v2 · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

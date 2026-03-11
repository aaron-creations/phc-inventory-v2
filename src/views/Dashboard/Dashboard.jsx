import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LowStockBanner from '../../components/LowStockBanner'

export default function Dashboard() {
  const [blends, setBlends] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { isManager, isTechnician, signOut, profile } = useAuth()

  // Derive display name from linked technician or email
  const tech = profile?.technicians
  const displayName = tech
    ? `${tech.first_name} ${tech.last_initial}.`
    : profile?.email?.split('@')[0] ?? 'Manager'

  const initials = tech
    ? tech.first_name[0]
    : (profile?.email?.[0] ?? 'M').toUpperCase()

  const avatarColor = tech?.color_hex ?? '#4ade80'

  useEffect(() => {
    async function loadData() {
      const [blendRes, prodRes] = await Promise.all([
        supabase.from('blends').select('*').order('name'),
        supabase.from('products').select('id, name, containers_in_stock, low_stock_threshold').order('name'),
      ])
      setBlends(blendRes.data || [])
      setProducts(prodRes.data || [])
      setLoading(false)
    }
    loadData()
  }, [])

  const badgeColors = {
    green:  'border-brand-green text-brand-green bg-brand-green/10',
    orange: 'border-brand-orange text-brand-orange bg-brand-orange/10',
    blue:   'border-brand-blue text-brand-blue bg-brand-blue/10',
  }

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col items-center px-4 py-10 max-w-lg mx-auto">

      {/* Header — sign out */}
      <div className="w-full flex items-center justify-end mb-4">
        <button
          onClick={signOut}
          className="text-white/25 hover:text-white/60 text-xs transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Centered badge logo */}
      <img
        src="/phc-logo.png"
        alt="Plant Health Care"
        className="w-36 h-36 mb-4 drop-shadow-xl"
        style={{ filter: 'drop-shadow(0 0 24px rgba(74,222,128,0.15))' }}
      />

      {/* Title */}
      <h1 className="font-serif text-4xl font-bold text-white text-center leading-tight mb-1">
        Daily Usage<br />Log
      </h1>
      <p className="text-white/50 text-sm mb-6">
        {format(new Date(), 'EEEE, MMMM d')}
      </p>

      {/* Blend Badges */}
      {loading ? (
        <div className="flex gap-2 mb-8 flex-wrap justify-center">
          {[1,2,3].map(i => (
            <div key={i} className="h-8 w-36 rounded-full bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 mb-8 flex-wrap justify-center">
          {blends.map(blend => (
            <span
              key={blend.id}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${badgeColors[blend.badge_color] || badgeColors.green}`}
            >
              {blend.emoji} {blend.name}
            </span>
          ))}
        </div>
      )}

      {/* Low-Stock Alert */}
      {!loading && <LowStockBanner products={products} compact />}

      {/* Logged-in user identity card */}
      <div className="w-full glass rounded-2xl p-4 flex items-center gap-4 mb-6">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-forest-950 font-bold text-xl flex-shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </div>
        <div className="flex flex-col">
          <span className="text-white font-semibold text-base leading-tight">{displayName}</span>
          <span className="text-white/40 text-xs">
            {isManager ? 'Manager' : 'Technician'} · Logged in
          </span>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="w-full flex flex-col gap-3 mb-10">
        {/* Log Usage — available to all approved users */}
        <button
          onClick={() => navigate('/log')}
          className="w-full flex items-center gap-4 px-5 py-4 rounded-xl bg-brand-green/10 border border-brand-green/30 hover:bg-brand-green/20 hover:border-brand-green/60 transition-all duration-200 group"
        >
          <span className="text-2xl">🧪</span>
          <span className="text-brand-green font-semibold text-base flex-1 text-left">Log Usage</span>
          <span className="text-brand-green/40 group-hover:text-brand-green/80 transition-colors">→</span>
        </button>

        {/* Log Restock — manager only */}
        {isManager && (
          <button
            onClick={() => navigate('/restock')}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl bg-brand-orange/10 border border-brand-orange/30 hover:bg-brand-orange/20 hover:border-brand-orange/60 transition-all duration-200 group"
          >
            <span className="text-2xl">📦</span>
            <span className="text-brand-orange font-semibold text-base flex-1 text-left">Log Restock</span>
            <span className="text-brand-orange/40 group-hover:text-brand-orange/80 transition-colors">→</span>
          </button>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className={`w-full grid gap-3 ${isManager ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <NavButton icon="📦" label="Stock" onClick={() => navigate('/stock')} />
        <NavButton icon="📋" label="Mix Rates" onClick={() => navigate('/mix-rates')} />
        {isManager && (
          <NavButton icon="⚙" label="Manager" onClick={() => navigate('/manager/dashboard')} />
        )}
      </div>
    </div>
  )
}

function NavButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-3 rounded-xl glass hover:bg-white/10 transition-all duration-200 text-white/70 hover:text-white"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

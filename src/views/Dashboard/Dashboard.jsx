import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { format } from 'date-fns'

export default function Dashboard() {
  const [technicians, setTechnicians] = useState([])
  const [blends, setBlends] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadData() {
      const [techRes, blendRes] = await Promise.all([
        supabase.from('technicians').select('*').order('first_name'),
        supabase.from('blends').select('*').order('name'),
      ])
      setTechnicians(techRes.data || [])
      setBlends(blendRes.data || [])
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
      <p className="text-brand-green text-xs font-semibold tracking-[0.2em] uppercase mb-2">Plant Health Care</p>
      <h1 className="font-serif text-4xl font-bold text-white text-center leading-tight mb-1">Daily Usage<br />Log</h1>
      <p className="text-white/50 text-sm mb-6">{format(new Date(), 'EEEE, MMMM d')}</p>
      {loading ? (
        <div className="flex gap-2 mb-8 flex-wrap justify-center">
          {[1,2,3].map(i => <div key={i} className="h-8 w-36 rounded-full bg-white/5 animate-pulse" />)}
        </div>
      ) : (
        <div className="flex gap-2 mb-8 flex-wrap justify-center">
          {blends.map(blend => (
            <span key={blend.id} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${badgeColors[blend.badge_color] || badgeColors.green}`}>
              {blend.emoji} {blend.name}
            </span>
          ))}
        </div>
      )}
      <p className="text-white/40 text-xs font-semibold tracking-[0.15em] uppercase mb-3 self-start">Who's Logging?</p>
      <div className="w-full flex flex-col gap-2 mb-10">
        {loading ? <div className="h-16 rounded-xl bg-white/5 animate-pulse w-full" /> : technicians.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-6">No technicians added yet.</p>
        ) : technicians.map(tech => (
          <button key={tech.id} onClick={() => navigate(`/log/${tech.id}`)} className="w-full flex items-center gap-4 px-4 py-4 rounded-xl glass hover:bg-white/10 transition-all duration-200 group">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-forest-950 font-bold text-lg flex-shrink-0" style={{ backgroundColor: tech.color_hex }}>{tech.first_name[0]}</div>
            <span className="text-white font-medium flex-1 text-left">{tech.first_name} {tech.last_initial}.</span>
            <span className="text-white/30 group-hover:text-white/60 transition-colors">→</span>
          </button>
        ))}
      </div>
      <div className="w-full grid grid-cols-3 gap-3">
        <NavButton icon="📦" label="Stock" onClick={() => navigate('/stock')} />
        <NavButton icon="📋" label="Mix Rates" onClick={() => navigate('/mix-rates')} />
        <NavButton icon="⚙" label="Manager" onClick={() => navigate('/manager/login')} />
      </div>
    </div>
  )
}

function NavButton({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 py-3 rounded-xl glass hover:bg-white/10 transition-all duration-200 text-white/70 hover:text-white">
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

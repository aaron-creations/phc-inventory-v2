import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import LowStockBanner from '../../components/LowStockBanner'

export default function Dashboard() {
  const [blends, setBlends] = useState([])
  const [products, setProducts] = useState([])
  const [todaysJobs, setTodaysJobs] = useState([])
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
      const todayString = format(new Date(), 'yyyy-MM-dd')
      const [blendRes, prodRes, jobsRes] = await Promise.all([
        supabase.from('blends').select('*').order('name'),
        supabase.from('products').select('id, name, containers_in_stock, low_stock_threshold').order('name'),
        tech?.id ? supabase.from('crm_jobs')
          .select('id, service_type, status, crm_properties(address_line1, nickname), crm_customers(last_name)')
          .eq('technician_id', tech.id)
          .eq('scheduled_date', todayString)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: true }) : Promise.resolve({ data: [] })
      ])
      setBlends(blendRes.data || [])
      setProducts(prodRes.data || [])
      setTodaysJobs(jobsRes.data || [])
      setLoading(false)
    }
    loadData()
  }, [tech?.id])

  async function startJob(jobId) {
    const { error } = await supabase.from('crm_jobs').update({ status: 'in_progress' }).eq('id', jobId)
    if (!error) {
      setTodaysJobs(todaysJobs.map(j => j.id === jobId ? { ...j, status: 'in_progress' } : j))
      navigate('/log') // Option to jump straight into logging
    }
  }

  async function completeJob(jobId) {
    const { error } = await supabase.from('crm_jobs').update({ status: 'completed' }).eq('id', jobId)
    if (!error) {
      setTodaysJobs(todaysJobs.map(j => j.id === jobId ? { ...j, status: 'completed' } : j))
    }
  }

  const badgeColors = {
    green:  'border-brand-green text-brand-green bg-brand-green/10',
    orange: 'border-brand-orange text-brand-orange bg-brand-orange/10',
    blue:   'border-brand-blue text-brand-blue bg-brand-blue/10',
  }

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col items-center px-4 py-10 max-w-lg mx-auto">

      {/* Header — Hub & Sign out */}
      <div className="w-full flex items-center justify-between mb-4">
        <Link
          to="/hub"
          className="text-white/40 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1"
        >
          ← Hub
        </Link>
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

      {/* Today's Route (Technicians) */}
      {!isManager && todaysJobs.length > 0 && (
        <div className="w-full mb-6 relative">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Today's Route</h2>
            <div className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-xs font-bold">{todaysJobs.length}</div>
          </div>
          
          <div className="space-y-3">
            {todaysJobs.map(job => (
              <div key={job.id} className="glass rounded-xl p-4 border border-white/5 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="text-white font-bold">{job.service_type}</h3>
                    <p className="text-white/50 text-xs mt-0.5">
                      {job.crm_customers?.last_name} · {job.crm_properties?.nickname || job.crm_properties?.address_line1}
                    </p>
                  </div>
                  {job.status === 'completed' && (
                     <span className="px-2 py-1 rounded bg-brand-green/20 text-brand-green text-[10px] font-bold uppercase">Done</span>
                  )}
                  {job.status === 'in_progress' && (
                     <span className="px-2 py-1 rounded bg-brand-orange/20 text-brand-orange text-[10px] font-bold uppercase">Active</span>
                  )}
                </div>
                
                {job.status === 'scheduled' && (
                  <button onClick={() => startJob(job.id)} className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border border-blue-500/20">
                    Start Job
                  </button>
                )}
                {job.status === 'in_progress' && (
                  <div className="flex gap-2">
                    <button onClick={() => navigate('/log')} className="flex-1 py-2 bg-brand-green hover:bg-brand-green/90 text-forest-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors">
                      Log Materials
                    </button>
                    <button onClick={() => completeJob(job.id)} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors">
                      Mark Complete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        <NavButton icon="🧬" label="Log Usage" to="/log" color="bg-brand-green" />
        <NavButton icon="🚛" label="Fleet" to="/fleet" />
        <NavButton icon="📋" label="Mix Rates" to="/mix-rates" />
        <NavButton icon="📦" label="Stock Levels" to="/stock" />
        <NavButton icon="🗓️" label="My Jobs" to="/my-jobs" />
        <NavButton icon="📜" label="My Logs" to="/my-logs" />
      </div>
    </div>
  )
}

function NavButton({ icon, label, to, onClick, color }) {
  const navigate = useNavigate()
  
  return (
    <button
      onClick={() => {
        if (onClick) onClick()
        else if (to) navigate(to)
      }}
      className="flex flex-col items-center gap-1 py-3 rounded-xl glass hover:bg-white/10 transition-all duration-200 text-white/70 hover:text-white"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
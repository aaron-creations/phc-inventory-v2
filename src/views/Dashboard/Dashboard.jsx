import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'

// ─── Toast Component ──────────────────────────────────────────────────────────
function Toast({ message, onDone }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 300) }, 2500)
    return () => clearTimeout(t)
  }, [])
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-green text-forest-950 font-semibold text-sm shadow-2xl">
        <span>✓</span> {message}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [products, setProducts] = useState([])
  const [todaysJobs, setTodaysJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const navigate = useNavigate()
  const { isManager, isTechnician, signOut, profile } = useAuth()

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
      const [prodRes, jobsRes] = await Promise.all([
        supabase.from('products').select('id, name, containers_in_stock, low_stock_threshold').order('name'),
        tech?.id ? supabase.from('crm_jobs')
          .select('id, service_type, status, start_time, end_time, crm_properties(address_line1, nickname), crm_customers(first_name, last_name)')
          .eq('technician_id', tech.id)
          .eq('scheduled_date', todayString)
          .neq('status', 'cancelled')
          .order('start_time', { ascending: true, nullsFirst: true }) : Promise.resolve({ data: [] })
      ])
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
      navigate('/log', { state: { selectedJobId: jobId, selectedDate: format(new Date(), 'yyyy-MM-dd') } })
    }
  }

  async function completeJob(jobId) {
    const { error } = await supabase.from('crm_jobs').update({ status: 'completed' }).eq('id', jobId)
    if (!error) {
      setTodaysJobs(todaysJobs.map(j => j.id === jobId ? { ...j, status: 'completed' } : j))
      setToast('Job marked complete!')
    }
  }

  const lowStockCount = products.filter(p => p.containers_in_stock <= p.low_stock_threshold).length

  function formatTime(timeStr) {
    if (!timeStr) return null
    const [h, m] = timeStr.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hr = h % 12 || 12
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
  }

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col items-center px-4 py-10 max-w-lg mx-auto">

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* Header */}
      <div className="w-full flex items-center justify-between mb-6">
        <Link to="/hub" className="text-white/40 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1">
          ← Hub
        </Link>
        <button onClick={signOut} className="text-white/25 hover:text-white/60 text-xs transition-colors">
          Sign out
        </button>
      </div>

      {/* User Identity Card */}
      <div className="w-full glass rounded-2xl p-4 flex items-center gap-4 mb-6">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-forest-950 font-bold text-xl flex-shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </div>
        <div className="flex-col flex flex-1">
          <span className="text-white font-semibold text-base leading-tight">{displayName}</span>
          <span className="text-white/40 text-xs">
            {isManager ? 'Manager' : 'Technician'} · {format(new Date(), 'EEEE, MMMM d')}
          </span>
        </div>
        {!loading && !isManager && (
          <div className={`flex-shrink-0 text-center px-3 py-1 rounded-full text-xs font-bold ${
            todaysJobs.length > 0
              ? 'bg-brand-green/15 text-brand-green border border-brand-green/30'
              : 'bg-white/5 text-white/30'
          }`}>
            {todaysJobs.length > 0 ? `${todaysJobs.length} job${todaysJobs.length !== 1 ? 's' : ''} today` : 'Rest day'}
          </div>
        )}
      </div>

      {/* Low Stock Alert */}
      {!loading && lowStockCount > 0 && (
        <button
          onClick={() => navigate('/stock')}
          className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-all text-left"
        >
          <span className="text-red-400 text-lg">⚠️</span>
          <span className="text-red-400 text-sm font-medium flex-1">
            {lowStockCount} product{lowStockCount !== 1 ? 's' : ''} low or out of stock
          </span>
          <span className="text-red-400/50 text-sm">→</span>
        </button>
      )}

      {/* Today's Route — Hero Section */}
      {!isManager && (
        <div className="w-full mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Today's Route</h2>
            {!loading && todaysJobs.length > 0 && (
              <div className="px-2 py-0.5 rounded-full bg-brand-green/15 text-brand-green text-xs font-bold border border-brand-green/30">
                {todaysJobs.length}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map(i => <div key={i} className="h-28 glass rounded-xl animate-pulse" />)}
            </div>
          ) : todaysJobs.length === 0 ? (
            <div className="glass rounded-xl p-6 text-center border border-white/5">
              <div className="text-3xl mb-2">🌿</div>
              <p className="text-white/50 font-medium text-sm mb-1">No jobs scheduled today</p>
              <p className="text-white/25 text-xs">Check with your manager or enjoy a well-earned rest.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysJobs.map(job => {
                const startFmt = formatTime(job.start_time)
                const endFmt = formatTime(job.end_time)
                const hasTime = startFmt && endFmt

                return (
                  <div key={job.id} className={`glass rounded-xl p-4 border flex flex-col gap-3 transition-all ${
                    job.status === 'completed' ? 'border-brand-green/20 bg-brand-green/[0.03] opacity-70' :
                    job.status === 'in_progress' ? 'border-brand-orange/25 bg-brand-orange/[0.04]' :
                    'border-white/5'
                  }`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold leading-snug">{job.service_type}</h3>
                        <p className="text-white/40 text-xs mt-0.5">
                          {job.crm_customers ? `${job.crm_customers.first_name} ${job.crm_customers.last_name}` : ''}
                          {job.crm_properties
                            ? ` · ${job.crm_properties.nickname || job.crm_properties.address_line1}`
                            : ''}
                        </p>
                        {hasTime && (
                          <p className="text-white/35 text-xs mt-1 font-mono">{startFmt} – {endFmt}</p>
                        )}
                      </div>
                      {job.status === 'completed' && (
                        <span className="px-2 py-1 rounded bg-brand-green/20 text-brand-green text-[10px] font-bold uppercase flex-shrink-0">Done ✓</span>
                      )}
                      {job.status === 'in_progress' && (
                        <span className="relative flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-orange-400 opacity-75 top-1 right-1"></span>
                          <span className="px-2 py-1 rounded bg-brand-orange/20 text-brand-orange text-[10px] font-bold uppercase">Active</span>
                        </span>
                      )}
                    </div>

                    {job.status === 'scheduled' && (
                      <button
                        onClick={() => startJob(job.id)}
                        className="w-full py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border border-blue-500/20"
                      >
                        Start Job
                      </button>
                    )}
                    {job.status === 'in_progress' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate('/log', { state: { selectedJobId: job.id, selectedDate: format(new Date(), 'yyyy-MM-dd') } })}
                          className="flex-1 py-2.5 bg-brand-green hover:bg-brand-green/90 text-forest-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
                        >
                          Log Materials
                        </button>
                        <button
                          onClick={() => completeJob(job.id)}
                          className="flex-1 py-2.5 bg-white/8 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border border-white/10"
                        >
                          Mark Complete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="w-full grid grid-cols-2 gap-3 max-w-sm mx-auto">
        <NavButton icon="🧪" label="Log Usage" to="/log" color="bg-brand-green/10 border border-brand-green/30 text-brand-green" />
        <NavButton icon="📋" label="Mix Rates" to="/mix-rates" />
        <NavButton icon="📦" label="Stock Levels" to="/stock" />
        <NavButton icon="📜" label="My Logs" to="/my-logs" />
      </div>

    </div>
  )
}

function NavButton({ icon, label, to, color }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className={`flex flex-col items-center gap-1 py-4 rounded-xl glass hover:bg-white/10 transition-all duration-200 text-white/70 hover:text-white ${color || ''}`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

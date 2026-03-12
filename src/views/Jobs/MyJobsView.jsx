import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'

export default function MyJobsView() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()
  const navigate = useNavigate()
  
  const techId = profile?.technicians?.id

  useEffect(() => {
    async function loadJobs() {
      if (!techId) {
        setLoading(false)
        return
      }

      setLoading(true)
      const { data } = await supabase
        .from('crm_jobs')
        .select(`
          id,
          service_type,
          status,
          scheduled_date,
          created_at,
          crm_properties ( address_line1, city, nickname ),
          crm_customers ( first_name, last_name, phone_mobile, company_name )
        `)
        .eq('technician_id', techId)
        .order('scheduled_date', { ascending: true }) // Earliest first
        
      setJobs(data || [])
      setLoading(false)
    }

    loadJobs()
  }, [techId])

  // Group jobs by status relative to today
  const todayString = format(new Date(), 'yyyy-MM-dd')
  
  const todaysJobs = jobs.filter(j => j.scheduled_date === todayString && j.status !== 'completed' && j.status !== 'cancelled')
  const inProgressJobs = jobs.filter(j => j.status === 'in_progress' && j.scheduled_date !== todayString)
  const upcomingJobs = jobs.filter(j => j.scheduled_date > todayString && j.status !== 'cancelled' && j.status !== 'completed')
  const pastJobs = jobs.filter(j => j.scheduled_date < todayString || j.status === 'completed')

  async function updateStatus(jobId, newStatus) {
    const { error } = await supabase.from('crm_jobs').update({ status: newStatus }).eq('id', jobId)
    if (!error) {
      setJobs(jobs.map(j => j.id === jobId ? { ...j, status: newStatus } : j))
    } else {
      alert("Failed to update status")
    }
  }

  function renderJobCard(job, showDate = false) {
    const cust = job.crm_customers
    const prop = job.crm_properties
    
    return (
      <div key={job.id} className="glass rounded-xl p-4 border border-white/5 relative overflow-hidden group">
        <div className={`absolute top-0 left-0 bottom-0 w-1 ${
          job.status === 'completed' ? 'bg-brand-green/50' :
          job.status === 'in_progress' ? 'bg-brand-orange' :
          job.status === 'cancelled' ? 'bg-red-500/50' :
          'bg-blue-500/50'
        }`} />
        
        <div className="pl-3">
          <div className="flex justify-between items-start gap-2 mb-2">
            <div>
              <h3 className="text-white font-bold leading-tight">{job.service_type}</h3>
              <p className="text-white/70 text-sm mt-0.5">
                {cust?.company_name || `${cust?.first_name} ${cust?.last_name}`}
              </p>
            </div>
            {showDate && (
              <span className="text-brand-green/80 text-xs font-mono font-bold bg-brand-green/10 px-2 py-1 rounded">
                {format(new Date(job.scheduled_date), 'MMM d')}
              </span>
            )}
          </div>
          
          <div className="space-y-1 mb-4">
            <p className="text-white/50 text-xs flex items-center gap-1.5">
              <span>📍</span> {prop?.address_line1}{prop?.city ? `, ${prop.city}` : ''}
              {prop?.nickname && ` (${prop.nickname})`}
            </p>
            {cust?.phone_mobile && (
              <p className="text-white/50 text-xs flex items-center gap-1.5">
                <span>📱</span> {cust.phone_mobile}
              </p>
            )}
          </div>
          
          {/* Actions based on Job Status */}
          {job.status === 'scheduled' && (
            <button
              onClick={() => updateStatus(job.id, 'in_progress')}
              className="w-full py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider rounded-lg border border-blue-500/20 transition-colors"
            >
              Start Job Now
            </button>
          )}
          
          {job.status === 'in_progress' && (
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/log', { state: { selectedJobId: job.id, selectedDate: job.scheduled_date } })}
                className="flex-1 py-2.5 bg-brand-green hover:bg-brand-green/90 text-forest-950 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
              >
                Log Mats
              </button>
              <button
                onClick={() => updateStatus(job.id, 'completed')}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
              >
                Complete
              </button>
            </div>
          )}
          
          {job.status === 'completed' && (
            <div className="text-center py-2 text-brand-green/50 text-xs font-bold uppercase tracking-widest border border-brand-green/10 rounded-lg bg-brand-green/5">
              Completed
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 sticky top-0 bg-forest-950/80 backdrop-blur-md pt-2 pb-4 z-10 border-b border-white/10">
        <Link
          to="/"
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">My Jobs Route</h1>
          <p className="text-brand-green text-sm flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
            Live Schedule
          </p>
        </div>
      </div>

      {!techId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/50 space-y-2">
          <span className="text-4xl">👤</span>
          <p>Your account is not linked to a Technician profile.</p>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/40 space-y-3">
          <span className="text-5xl opacity-50">🏝️</span>
          <p className="text-sm">You have no scheduled jobs.</p>
        </div>
      ) : (
        <div className="space-y-8 pb-10">
          
          {/* Active / In Progress (Catch-all for paused/day-spanning jobs) */}
          {inProgressJobs.length > 0 && (
            <section>
               <h2 className="text-xs font-bold text-brand-orange uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>In Progress</span>
                <div className="h-px bg-brand-orange/20 flex-1" />
              </h2>
              <div className="space-y-3">
                {inProgressJobs.map(j => renderJobCard(j, true))}
              </div>
            </section>
          )}

          {/* Today's Route */}
          {todaysJobs.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>Today's Route</span>
                <span className="bg-blue-500/20 text-blue-400 px-2 rounded-full">{todaysJobs.length}</span>
                <div className="h-px bg-blue-500/20 flex-1" />
              </h2>
              <div className="space-y-3">
                {todaysJobs.map(j => renderJobCard(j))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {upcomingJobs.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3 mt-6">
                Upcoming Next
              </h2>
              <div className="space-y-3">
                {upcomingJobs.map(j => renderJobCard(j, true))}
              </div>
            </section>
          )}

          {/* Past/Completed (Limit to last 5 for brevity) */}
          {pastJobs.length > 0 && (
             <section className="opacity-70">
              <h2 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3 mt-6 flex justify-between">
                <span>Recently Completed</span>
              </h2>
              <div className="space-y-3">
                {pastJobs.slice(0, 5).map(j => renderJobCard(j, true))}
              </div>
             </section>
          )}

        </div>
      )}
    </div>
  )
}

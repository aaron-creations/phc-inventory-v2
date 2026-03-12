import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabaseClient'
import { format } from 'date-fns'

export default function JobsSection() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'calendar' later

  // Simple hardcoded tech list for prototyping assignments.
  // In production, fetch this from `technicians` table separately.
  const [techList, setTechList] = useState([])

  useEffect(() => {
    loadJobs()
    // Pre-load tech list for the dropdowns
    supabase.from('technicians').select('id, first_name, last_initial').then(res => setTechList(res.data || []))
  }, [])

  async function loadJobs() {
    setLoading(true)
    const { data } = await supabase
      .from('crm_jobs')
      .select(`
        *,
        crm_customers ( first_name, last_name, company_name ),
        crm_properties ( address_line1, nickname ),
        technicians ( first_name, last_initial )
      `)
      .order('scheduled_date', { ascending: false })
      .limit(100)

    setJobs(data || [])
    setLoading(false)
  }

  async function updateJobStatus(jobId, newStatus) {
    const { error } = await supabase.from('crm_jobs').update({ status: newStatus }).eq('id', jobId)
    if (!error) loadJobs()
  }

  async function assignTech(jobId, techId) {
     const { error } = await supabase.from('crm_jobs').update({ technician_id: techId || null }).eq('id', jobId)
     if (!error) loadJobs()
  }

  // Filter groups
  const todayTarget = format(new Date(), 'yyyy-MM-dd')
  const pendingJobs = jobs.filter(j => ['scheduled', 'in_progress'].includes(j.status))
  const pastJobs = jobs.filter(j => ['completed', 'cancelled'].includes(j.status))

  return (
    <div className="p-4 flex flex-col h-full overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Central Dispatch</h2>
          <p className="text-white/50 text-sm">Schedule and manage upcoming service jobs.</p>
        </div>
        <button className="px-4 py-2 bg-brand-green text-forest-950 font-bold rounded-xl text-sm hover:bg-brand-green/90 transition-colors shadow-lg shadow-brand-green/20">
          + Schedule New Job
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-8 pr-2">
        
        {/* Active Dispatch */}
        <section>
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse"></span>
            Active Dispatch Queue
          </h3>

          <div className="space-y-3">
            {pendingJobs.map(job => {
              const cust = job.crm_customers
              const prop = job.crm_properties
              const cName = cust?.company_name || `${cust?.first_name} ${cust?.last_name}`
              const isToday = job.scheduled_date === todayTarget

              return (
                <div key={job.id} className="glass rounded-xl p-4 border border-white/10 flex flex-col lg:flex-row gap-4 lg:items-center relative overflow-hidden">
                  
                  {/* Status Indicator Bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    job.status === 'in_progress' ? 'bg-brand-orange' : 
                    isToday ? 'bg-blue-500' : 'bg-white/20'
                  }`} />

                  {/* Core Info */}
                  <div className="flex-1 pl-3">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-white font-bold text-lg">{job.service_type}</h4>
                      {isToday && job.status === 'scheduled' && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider">Today</span>
                      )}
                      {job.status === 'in_progress' && (
                        <span className="px-2 py-0.5 rounded bg-brand-orange/20 text-brand-orange text-[10px] font-bold uppercase tracking-wider">In Progress</span>
                      )}
                    </div>
                    <p className="text-white/70 font-medium">
                      {cName} <span className="text-white/30 truncate max-w-[200px] inline-block align-bottom ml-1">— {prop?.address_line1}</span>
                    </p>
                  </div>

                  {/* Date & Assignment */}
                  <div className="flex flex-col sm:flex-row gap-4 lg:gap-8 items-start sm:items-center pl-3 lg:pl-0 border-t lg:border-t-0 border-white/5 pt-3 lg:pt-0">
                    <div>
                      <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-1">Scheduled Date</span>
                      <span className="text-white text-sm font-medium bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 block">
                        📅 {format(new Date(job.scheduled_date), 'MMM d, yyyy')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-1">Assigned Tech</span>
                      <select
                        className="bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-green focus:bg-forest-900 transition-colors"
                        value={job.technician_id || ''}
                        onChange={(e) => assignTech(job.id, e.target.value)}
                      >
                         <option value="">Unassigned</option>
                         {techList.map(t => (
                           <option key={t.id} value={t.id}>{t.first_name} {t.last_initial}.</option>
                         ))}
                      </select>
                    </div>

                    {/* Manager Actions */}
                     <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 lg:ml-4">
                        <button className="flex-1 sm:flex-none px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold rounded-lg transition-colors border border-white/5 hover:border-white/20">
                          Edit
                        </button>
                        {job.status === 'in_progress' && (
                          <button 
                            onClick={() => updateJobStatus(job.id, 'completed')}
                            className="flex-1 sm:flex-none px-4 py-2 bg-brand-green/20 hover:bg-brand-green/30 text-brand-green text-xs font-bold rounded-lg border border-brand-green/30 hover:border-brand-green/50 transition-colors uppercase tracking-wider"
                          >
                             Mark Done
                          </button>
                        )}
                     </div>
                  </div>

                </div>
              )
            })}

            {pendingJobs.length === 0 && !loading && (
              <div className="p-8 text-center glass rounded-xl border border-white/5">
                <span className="text-4xl block mb-2 opacity-30">🏔️</span>
                <p className="text-white/50 text-sm">No active jobs in the queue.</p>
              </div>
            )}
          </div>
        </section>

        {/* Recently Completed */}
        <section className="opacity-70 mt-12 border-t border-white/10 pt-8">
           <h3 className="text-white/50 font-bold text-sm uppercase tracking-widest mb-4">
            Recent History
          </h3>
          <div className="space-y-2">
            {pastJobs.slice(0, 10).map(job => (
              <div key={job.id} className="p-3 bg-black/20 rounded-lg border border-white/5 flex flex-col md:flex-row justify-between md:items-center gap-2">
                <div>
                  <span className="text-white/80 font-medium text-sm">{job.service_type}</span>
                  <span className="text-white/40 text-xs mx-2">·</span>
                  <span className="text-white/60 text-xs">{job.crm_customers?.last_name || job.crm_customers?.company_name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                   <span className="text-white/40">{format(new Date(job.scheduled_date), 'MM/dd/yy')}</span>
                   {job.status === 'completed' 
                      ? <span className="text-brand-green/60 uppercase font-bold tracking-wider">Done</span>
                      : <span className="text-red-500/60 uppercase font-bold tracking-wider">Cancel</span>
                   }
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

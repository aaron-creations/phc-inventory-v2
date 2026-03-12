import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { MapPin, User, Calendar, CheckCircle2, Phone } from 'lucide-react'

export default function MyJobsView() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { profile } = useAuth()

  const techId = profile?.technicians?.id

  useEffect(() => {
    if (!techId) {
      setLoading(false)
      return
    }
    loadJobs()
  }, [techId])

  async function loadJobs() {
    setLoading(true)
    const { data } = await supabase
      .from('crm_jobs')
      .select(`
        *,
        crm_customers ( first_name, last_name, phone_mobile ),
        crm_properties ( address_line1, city, nickname, access_notes )
      `)
      .eq('technician_id', techId)
      .in('status', ['scheduled', 'in_progress'])
      .order('scheduled_date', { ascending: true })

    setJobs(data || [])
    setLoading(false)
  }

  async function completeJob(jobId) {
    if (!window.confirm("Mark this job as completed?")) return
    
    // In a full implementation, you'd probably require checking if logs were submitted for this job,
    // but for now we just change the CRM status.
    const { error } = await supabase
      .from('crm_jobs')
      .update({ status: 'completed' })
      .eq('id', jobId)

    if (!error) {
      setJobs(jobs.filter(j => j.id !== jobId))
    } else {
      alert(`Error completing job: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen bg-forest-950">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-brand-green animate-spin"></div>
      </div>
    )
  }

  if (!techId) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center p-8 text-center text-white/50">
        <p>You must be linked to a Technician profile to view jobs.</p>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5 transition-colors text-white">Back to Dashboard</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-forest-950 max-w-lg mx-auto px-4 py-8 pb-16">
      {/* Header */}
      <div className="flex items-center mb-8 sticky top-0 bg-forest-950/90 backdrop-blur pb-4 z-10 pt-2">
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white transition-colors text-sm flex-1 text-left">← Back</button>
        <h1 className="text-white font-bold text-lg flex-[2] text-center truncate px-2">
          My Schedule
        </h1>
        <div className="flex-1 text-right">
          <span className="text-xs font-bold text-brand-green uppercase tracking-wider bg-brand-green/10 px-2 py-1 rounded-full">{jobs.length} Jobs</span>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center p-8 bg-black/20 rounded-xl border border-white/5">
          <p className="text-white/40 text-sm">You have no upcoming jobs scheduled.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="p-5 bg-white/[0.02] rounded-xl border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${job.status === 'in_progress' ? 'bg-orange-400 animate-pulse' : 'bg-blue-400'}`}></span>
                  <span className="text-white/50 text-xs font-bold uppercase tracking-wider">
                    {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'}) : 'Unscheduled'}
                  </span>
                </div>
                
                <button 
                  onClick={() => completeJob(job.id)}
                  title="Mark as Completed"
                  className="text-white/30 hover:text-brand-green transition-colors"
                >
                  <CheckCircle2 size={18} />
                </button>
              </div>

              <h3 className="text-white font-bold leading-tight text-xl mb-1">{job.service_type}</h3>
              <div className="flex justify-between items-start mb-4">
                <p className="text-brand-green text-sm font-medium">{job.crm_customers?.first_name} {job.crm_customers?.last_name}</p>
                {job.crm_customers?.phone_mobile && (
                  <a href={`tel:${job.crm_customers.phone_mobile}`} className="flex items-center gap-1.5 text-blue-400 text-xs font-semibold hover:text-blue-300 transition-colors bg-blue-500/10 px-2 py-1 rounded">
                    <Phone size={12} /> {job.crm_customers.phone_mobile}
                  </a>
                )}
              </div>
              
              <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-white/30 shrink-0 mt-0.5" />
                  <div>
                    <a 
                      href={`https://maps.google.com/?q=${encodeURIComponent(`${job.crm_properties?.address_line1}, ${job.crm_properties?.city || ''}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/80 text-sm hover:text-blue-400 transition-colors flex items-center gap-1"
                      title="Open in Google Maps"
                    >
                      {job.crm_properties?.address_line1} <span className="text-[10px] text-blue-400/50 uppercase tracking-wider font-bold ml-1">(Map)</span>
                    </a>
                    <div className="text-white/40 text-xs mt-0.5">{job.crm_properties?.city} {job.crm_properties?.nickname && `(${job.crm_properties.nickname})`}</div>
                  </div>
                </div>

                {job.crm_properties?.access_notes && (
                  <div className="mt-2 text-xs text-orange-200/80 bg-orange-500/10 px-3 py-2 rounded-lg leading-relaxed">
                    <strong className="text-orange-400">NOTE:</strong> {job.crm_properties.access_notes}
                  </div>
                )}
              </div>
              
              <div className="mt-5 flex gap-2">
                <button 
                  onClick={() => navigate('/log', { state: { selectedJobId: job.id, selectedDate: job.scheduled_date }})} 
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border border-white/5"
                >
                  Log Usage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

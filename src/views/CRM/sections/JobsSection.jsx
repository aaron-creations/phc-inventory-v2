import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Calendar, Plus, X, User, MapPin, Edit, Trash2 } from 'lucide-react'

export default function JobsSection() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Create Job Modal
  const [isCreating, setIsCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Edit Job State
  const [isEditingJob, setIsEditingJob] = useState(false)
  const [editJobForm, setEditJobForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  
  // Job Form Data
  const [customers, setCustomers] = useState([])
  const [properties, setProperties] = useState([])
  const [technicians, setTechnicians] = useState([])
  
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [newJob, setNewJob] = useState({
    property_id: '',
    service_type: '',
    scheduled_date: '',
    technician_id: '',
    quoted_price: '',
    is_recurring: false,
    frequency: 'monthly',
    interval_days: ''
  })

  useEffect(() => {
    fetchJobs()
    fetchFormData()
  }, [])

  async function fetchJobs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('crm_jobs')
      .select(`
        *,
        crm_customers ( first_name, last_name, company_name ),
        crm_properties ( address_line1, nickname ),
        technicians ( first_name, last_initial )
      `)
      .order('scheduled_date', { ascending: true })
      
    if (!error) setJobs(data || [])
    setLoading(false)
  }

  async function fetchFormData() {
    const [cRes, pRes, tRes] = await Promise.all([
      supabase.from('crm_customers').select('id, first_name, last_name, company_name').eq('status', 'active').order('last_name'),
      supabase.from('crm_properties').select('id, customer_id, address_line1, nickname'),
      supabase.from('technicians').select('id, first_name, last_initial')
    ])
    
    if (cRes.data) setCustomers(cRes.data)
    if (pRes.data) setProperties(pRes.data)
    if (tRes.data) setTechnicians(tRes.data)
  }

  // Filter properties down to only the selected customer's properties
  const availableProperties = properties.filter(p => p.customer_id === selectedCustomerId)

  async function handleCreateJob(e) {
    e.preventDefault()
    setSubmitting(true)

    if (newJob.is_recurring) {
      // 1. Create the recurring schedule
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('crm_recurring_schedules')
        .insert([{
          customer_id: selectedCustomerId,
          property_id: newJob.property_id,
          service_type: newJob.service_type,
          quoted_price: newJob.quoted_price ? parseFloat(newJob.quoted_price) : null,
          technician_id: newJob.technician_id || null,
          frequency: newJob.frequency,
          interval_days: newJob.frequency === 'custom' ? parseInt(newJob.interval_days) : null,
          start_date: newJob.scheduled_date
        }])
        .select()
        .single()

      if (scheduleError) {
        alert(`Error creating schedule: ${scheduleError.message}`)
        setSubmitting(false)
        return
      }
      
      // 2. Run the pg_cron function manually to immediately generate the first batch of jobs
      await supabase.rpc('generate_upcoming_recurring_jobs')
      
      setIsCreating(false)
      setNewJob({ property_id: '', service_type: '', scheduled_date: '', technician_id: '', quoted_price: '', is_recurring: false, frequency: 'monthly', interval_days: '' })
      setSelectedCustomerId('')
      setSubmitting(false)
      fetchJobs()
      return
    }
    
    // Fallback: One-off Job
    const { data, error } = await supabase
      .from('crm_jobs')
      .insert([{
        customer_id: selectedCustomerId,
        property_id: newJob.property_id,
        service_type: newJob.service_type,
        scheduled_date: newJob.scheduled_date || null,
        technician_id: newJob.technician_id || null,
        quoted_price: newJob.quoted_price ? parseFloat(newJob.quoted_price) : null,
        status: 'scheduled'
      }])
      .select(`
        *,
        crm_customers ( first_name, last_name, company_name ),
        crm_properties ( address_line1, nickname ),
        technicians ( first_name, last_initial )
      `)
      .single()
      
    setSubmitting(false)
    
    if (error) {
      alert(`Error creating job: ${error.message}`)
    } else {
      setJobs([...jobs, data].sort((a,b) => new Date(a.scheduled_date) - new Date(b.scheduled_date)))
      setIsCreating(false)
      setSelectedCustomerId('')
      setNewJob({ property_id: '', service_type: '', scheduled_date: '', technician_id: '', quoted_price: '', is_recurring: false, frequency: 'monthly', interval_days: '' })
    }
  }

  async function handleStatusChange(id, newStatus) {
    const { error } = await supabase.from('crm_jobs').update({ status: newStatus }).eq('id', id)
    if (!error) {
      setJobs(jobs.map(j => j.id === id ? { ...j, status: newStatus } : j))
    }
  }

  function openEditJob(job) {
    setEditJobForm({
      id: job.id,
      service_type: job.service_type || '',
      scheduled_date: job.scheduled_date || '',
      technician_id: job.technician_id || '',
      quoted_price: job.quoted_price || '',
      customer_name: `${job.crm_customers?.first_name} ${job.crm_customers?.last_name}`,
      property_name: job.crm_properties?.address_line1 || job.crm_properties?.nickname
    })
    setIsEditingJob(true)
  }

  async function handleSaveJobEdit(e) {
    e.preventDefault()
    setSavingEdit(true)
    const { error } = await supabase.from('crm_jobs').update({
      service_type: editJobForm.service_type,
      scheduled_date: editJobForm.scheduled_date || null,
      technician_id: editJobForm.technician_id || null,
      quoted_price: editJobForm.quoted_price ? parseFloat(editJobForm.quoted_price) : null
    }).eq('id', editJobForm.id)
    
    setSavingEdit(false)
    if (error) {
      alert(`Error updating job: ${error.message}`)
    } else {
      setIsEditingJob(false)
      fetchJobs() // refresh to get all relations accurately mapped
    }
  }

  async function handleDeleteJob(id) {
    if (confirm('Are you sure you want to delete this job? This cannot be undone.')) {
      const { error } = await supabase.from('crm_jobs').delete().eq('id', id)
      if (error) alert(`Error deleting job: ${error.message}`)
      else setJobs(jobs.filter(j => j.id !== id))
    }
  }

  if (loading && jobs.length === 0) return (
    <div className="p-8 flex items-center justify-center h-full"><div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin"></div></div>
  )

  const upcomingJobs = jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled')
  const completedJobs = jobs.filter(j => j.status === 'completed')

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-white mb-1">Schedule & Jobs</h1>
          <p className="text-sm text-white/40">Manage upcoming services and assignments.</p>
        </div>
        
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-forest-950 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
        >
          <Plus size={18} /> Schedule Job
        </button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">Schedule New Job</h2>
              <button onClick={() => setIsCreating(false)} className="text-white/40 hover:text-white"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleCreateJob} className="p-6 space-y-4">
              
              <div>
                <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Customer *</label>
                <select required value={selectedCustomerId} onChange={e => { setSelectedCustomerId(e.target.value); setNewJob({...newJob, property_id: ''}) }} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                  <option value="" className="bg-forest-900">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id} className="bg-forest-900">{c.last_name}, {c.first_name} {c.company_name ? `(${c.company_name})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Property *</label>
                <select required disabled={!selectedCustomerId || availableProperties.length === 0} value={newJob.property_id} onChange={e => setNewJob({...newJob, property_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none disabled:opacity-50">
                  <option value="" className="bg-forest-900">{availableProperties.length === 0 && selectedCustomerId ? 'No properties found' : 'Select property...'}</option>
                  {availableProperties.map(p => (
                    <option key={p.id} value={p.id} className="bg-forest-900">{p.nickname ? `${p.nickname} - ` : ''}{p.address_line1}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Service Type *</label>
                <input required placeholder="e.g. Spring Fert, Tree Spray..." value={newJob.service_type} onChange={e => setNewJob({...newJob, service_type: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Date</label>
                  <input type="date" value={newJob.scheduled_date} onChange={e => setNewJob({...newJob, scheduled_date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Quoted Price ($)</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00" value={newJob.quoted_price} onChange={e => setNewJob({...newJob, quoted_price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>

              <div>
                <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Assign To Technician</label>
                <select value={newJob.technician_id} onChange={e => setNewJob({...newJob, technician_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                  <option value="" className="bg-forest-900">Unassigned</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id} className="bg-forest-900">{t.first_name} {t.last_initial}.</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 pb-1 border-t border-white/10 mt-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={newJob.is_recurring} 
                    onChange={e => setNewJob({...newJob, is_recurring: e.target.checked})} 
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-forest-900"
                  />
                  <span className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">Make this a recurring service</span>
                </label>
              </div>

              {newJob.is_recurring && (
                <div className="grid grid-cols-2 gap-4 bg-black/20 p-4 rounded-xl border border-blue-500/20 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Frequency</label>
                    <select value={newJob.frequency} onChange={e => setNewJob({...newJob, frequency: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                      <option value="weekly" className="bg-forest-900">Weekly</option>
                      <option value="biweekly" className="bg-forest-900">Bi-Weekly</option>
                      <option value="monthly" className="bg-forest-900">Monthly</option>
                      <option value="quarterly" className="bg-forest-900">Quarterly</option>
                      <option value="yearly" className="bg-forest-900">Yearly</option>
                      <option value="custom" className="bg-forest-900">Custom Days</option>
                    </select>
                  </div>
                  {newJob.frequency === 'custom' && (
                    <div>
                      <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Every X Days</label>
                      <input type="number" min="1" required={newJob.frequency === 'custom'} value={newJob.interval_days} onChange={e => setNewJob({...newJob, interval_days: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. 21" />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-sm text-white/60 hover:text-white">Cancel</button>
                <button type="submit" disabled={submitting || !selectedCustomerId || !newJob.property_id || !newJob.service_type} className="px-6 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 font-bold rounded-lg disabled:opacity-50">
                  {submitting ? 'Scheduling...' : 'Schedule Job'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTIVE JOBS LIST */}
      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-orange-400" /> Upcoming & Active ({upcomingJobs.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingJobs.length === 0 ? (
              <div className="col-span-full p-8 bg-forest-900 border border-white/5 rounded-xl text-center text-white/40">No active jobs.</div>
            ) : upcomingJobs.map(job => (
              <JobCard key={job.id} job={job} onStatusChange={handleStatusChange} onEdit={openEditJob} onDelete={handleDeleteJob} />
            ))}
          </div>
        </section>

        {completedJobs.length > 0 && (
          <section className="pt-8 border-t border-white/10">
            <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">
              Recently Completed
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
              {completedJobs.slice(0, 10).map(job => (
                <JobCard key={job.id} job={job} onStatusChange={handleStatusChange} onEdit={openEditJob} onDelete={handleDeleteJob} />
              ))}
            </div>
          </section>
        )}
      </div>

      {isEditingJob && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 p-6 rounded-xl w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-serif font-bold text-white mb-1">Edit Job</h2>
                <div className="text-xs text-white/50">{editJobForm.customer_name} • {editJobForm.property_name}</div>
              </div>
              <button title="Close" onClick={() => setIsEditingJob(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveJobEdit} className="space-y-4">
              <div>
                <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Service Type *</label>
                <input required value={editJobForm.service_type || ''} onChange={e => setEditJobForm({...editJobForm, service_type: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Date</label>
                  <input type="date" value={editJobForm.scheduled_date || ''} onChange={e => setEditJobForm({...editJobForm, scheduled_date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" style={{colorScheme: 'dark'}} />
                </div>
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Quoted Price ($)</label>
                  <input type="number" step="0.01" min="0" value={editJobForm.quoted_price || ''} onChange={e => setEditJobForm({...editJobForm, quoted_price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Assign To Technician</label>
                <select value={editJobForm.technician_id || ''} onChange={e => setEditJobForm({...editJobForm, technician_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                  <option value="" className="bg-forest-900">Unassigned</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id} className="bg-forest-900">{t.first_name} {t.last_initial}.</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end mt-8 border-t border-white/10 pt-4">
                <button type="button" onClick={() => setIsEditingJob(false)} className="px-4 py-2 text-white/50 hover:text-white transition-colors text-sm font-medium">Cancel</button>
                <button type="submit" disabled={savingEdit || !editJobForm.service_type} className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 font-semibold rounded-lg transition-colors text-sm disabled:opacity-50">
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

function JobCard({ job, onStatusChange, onEdit, onDelete }) {
  const isCompleted = job.status === 'completed'
  const isCancelled = job.status === 'cancelled'
  const isInProgress = job.status === 'in_progress'

  return (
    <div className={`p-5 rounded-xl border flex flex-col justify-between ${
      isCompleted ? 'bg-white/5 border-white/5' : 
      isInProgress ? 'bg-orange-500/10 border-orange-500/20' : 
      isCancelled ? 'bg-red-500/5 border-red-500/10 opacity-50' :
      'bg-forest-900 border-white/10'
    }`}>
      <div>
        <div className="flex justify-between items-start mb-3 gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold leading-tight">{job.service_type}</h3>
            <button onClick={() => onEdit(job)} className="text-white/40 hover:text-white transition-colors" title="Edit Job"><Edit size={14}/></button>
            <button onClick={() => onDelete(job.id)} className="text-red-500/60 hover:text-red-400 transition-colors" title="Delete Job"><Trash2 size={14}/></button>
          </div>
          
          <select 
            value={job.status}
            onChange={(e) => onStatusChange(job.id, e.target.value)}
            className={`text-xs font-semibold px-2 py-1 rounded outline-none appearance-none cursor-pointer ${
              isCompleted ? 'bg-brand-green/20 text-brand-green' :
              isInProgress ? 'bg-orange-500/20 text-orange-400' :
              isCancelled ? 'bg-red-500/20 text-red-400' :
              'bg-blue-500/20 text-blue-400'
            }`}
          >
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-start gap-2 text-white/70 text-sm pb-2 border-b border-white/5">
            <User size={14} className="text-white/30 mt-0.5 shrink-0" />
            <div>
              <span className="font-medium">{job.crm_customers?.first_name} {job.crm_customers?.last_name}</span>
              {job.crm_customers?.company_name && <div className="text-white/40 text-xs">{job.crm_customers.company_name}</div>}
            </div>
          </div>
          
          <div className="flex items-start gap-2 text-white/70 text-sm">
            <MapPin size={14} className="text-white/30 shrink-0 mt-0.5" />
            <span className="leading-tight">{job.crm_properties?.nickname || job.crm_properties?.address_line1}</span>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-end pt-3 border-t border-white/5 mt-auto">
        <div>
          <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-0.5">Assigned To</p>
          <p className="text-sm text-white/80">{job.technicians ? `${job.technicians.first_name} ${job.technicians.last_initial}.` : 'Unassigned'}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-0.5">Date</p>
          <p className="text-sm text-white/80">{job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'TBD'}</p>
        </div>
      </div>
    </div>
  )
}

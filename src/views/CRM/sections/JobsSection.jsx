import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Search, MapPin, User, ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, MoreVertical, Plus, Calendar as CalendarIcon, List, RefreshCw } from 'lucide-react'
import JobsCalendarView from './JobsCalendarView' // Import the new calendar component

export default function JobsSection() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Create Job formatting state
  const [isCreating, setIsCreating] = useState(false)
  const [newJob, setNewJob] = useState({
    customer_id: '',
    property_id: '',
    service_type: '',
    status: 'scheduled',
    scheduled_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    quoted_price: '',
    technician_id: '',
    is_recurring: false,
    frequency: 'monthly',
    interval_days: ''
  })

  // Edit Job State
  const [isEditing, setIsEditing] = useState(false)
  const [editJobForm, setEditJobForm] = useState(null)
  
  // Data for selects
  const [customers, setCustomers] = useState([])
  const [properties, setProperties] = useState([])
  const [technicians, setTechnicians] = useState([])

  // View toggle state: 'calendar' | 'list'
  const [displayMode, setDisplayMode] = useState('list')

  useEffect(() => {
    fetchJobs()
    fetchReferenceData()
  }, [])

  async function fetchReferenceData() {
    const { data: cData } = await supabase.from('crm_customers').select('id, first_name, last_name, company_name').order('last_name')
    if (cData) setCustomers(cData)

    const { data: tData } = await supabase.from('technicians').select('id, first_name, last_initial')
    if (tData) setTechnicians(tData)
  }

  // Fetch properties when customer is selected in Create or Edit forms
  async function fetchPropertiesForCustomer(customerId, isEdit = false) {
    if (!customerId) {
      setProperties([])
      return
    }
    const { data } = await supabase.from('crm_properties').select('id, address_line1, nickname').eq('customer_id', customerId)
    setProperties(data || [])
    
    // Auto-select if only 1 property exists
    if (data && data.length === 1) {
      if (isEdit) {
        setEditJobForm(prev => ({ ...prev, property_id: data[0].id }))
      } else {
        setNewJob(prev => ({ ...prev, property_id: data[0].id }))
      }
    }
  }

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
      
    if (error) {
      console.error(error)
    } else {
      setJobs(data || [])
    }
    setLoading(false)
  }

  // Double-booking check function
  function checkTimeConflict(techId, date, newStart, newEnd, excludeJobId = null) {
    if (!techId || !date || !newStart || !newEnd) return false // Cannot evaluate without times

    // Find jobs for this tech on this day
    const techJobsOnDay = jobs.filter(j => 
      j.technician_id === techId && 
      j.scheduled_date === date && 
      j.id !== excludeJobId &&
      j.start_time && 
      j.end_time
    )

    for (let job of techJobsOnDay) {
       // Check if times overlap.
       // Two intervals [s1, e1] and [s2, e2] overlap if: s1 < e2 AND s2 < e1
       if (newStart < job.end_time && job.start_time < newEnd) {
         return true // Conflict found!
       }
    }
    return false
  }

  async function handleCreateJob(e) {
    e.preventDefault()
    
    // Check for double bookings if a technician and times are selected
    if (newJob.technician_id && newJob.start_time && newJob.end_time) {
      const isConflict = checkTimeConflict(newJob.technician_id, newJob.scheduled_date, newJob.start_time, newJob.end_time)
      if (isConflict) {
         if (!confirm('Warning: This technician already has a job scheduled during this time. Do you want to double-book them?')) {
            return // User cancelled
         }
      }
    }

    let recurringId = null

    // If recurring, create schedule first
    if (newJob.is_recurring) {
      const { data: schedData, error: schedError } = await supabase.from('crm_recurring_schedules').insert([{
        customer_id: newJob.customer_id,
        property_id: newJob.property_id,
        service_type: newJob.service_type,
        frequency: newJob.frequency,
        interval_days: newJob.frequency === 'custom' ? parseInt(newJob.interval_days) : null,
        quoted_price: newJob.quoted_price ? parseFloat(newJob.quoted_price) : null,
        technician_id: newJob.technician_id || null,
        status: 'active',
        start_time: newJob.start_time || null,
        end_time: newJob.end_time || null
      }]).select().single()

      if (schedError) {
        alert(`Error creating schedule: ${schedError.message}`)
        return
      }
      recurringId = schedData.id
    }

    // Create the immediate job
    const { error } = await supabase.from('crm_jobs').insert([{
      customer_id: newJob.customer_id,
      property_id: newJob.property_id,
      service_type: newJob.service_type,
      status: newJob.status,
      scheduled_date: newJob.scheduled_date,
      start_time: newJob.start_time || null,
      end_time: newJob.end_time || null,
      quoted_price: newJob.quoted_price ? parseFloat(newJob.quoted_price) : null,
      technician_id: newJob.technician_id || null,
      recurring_schedule_id: recurringId
    }])

    if (error) {
      alert(`Error creating job: ${error.message}`)
    } else {
      setIsCreating(false)
      // Reset form
      setNewJob({
        customer_id: '', property_id: '', service_type: '', status: 'scheduled',
        scheduled_date: new Date().toISOString().split('T')[0], start_time: '', end_time: '', 
        quoted_price: '', technician_id: '', is_recurring: false, frequency: 'monthly', interval_days: ''
      })
      fetchJobs()
    }
  }

  async function updateJobStatus(id, newStatus) {
    const { error } = await supabase.from('crm_jobs').update({ status: newStatus }).eq('id', id)
    if (!error) {
      setJobs(jobs.map(j => j.id === id ? { ...j, status: newStatus } : j))
    }
  }

  async function deleteJob(id) {
    if (confirm('Are you sure you want to delete this job?')) {
      const { error } = await supabase.from('crm_jobs').delete().eq('id', id)
      if (!error) fetchJobs()
    }
  }

  // --- Edit Job Flow ---
  function handleOpenEdit(job) {
    fetchPropertiesForCustomer(job.customer_id, true)
    setEditJobForm({
      id: job.id,
      customer_id: job.customer_id,
      property_id: job.property_id,
      service_type: job.service_type,
      status: job.status,
      scheduled_date: job.scheduled_date || '',
      start_time: job.start_time || '',
      end_time: job.end_time || '',
      quoted_price: job.quoted_price || '',
      technician_id: job.technician_id || ''
    })
    setIsEditing(true)
  }

  async function handleSaveJobEdit(e) {
    e.preventDefault()
    
    // Check for double bookings during edit
    if (editJobForm.technician_id && editJobForm.start_time && editJobForm.end_time) {
      const isConflict = checkTimeConflict(editJobForm.technician_id, editJobForm.scheduled_date, editJobForm.start_time, editJobForm.end_time, editJobForm.id)
      if (isConflict) {
         if (!confirm('Warning: This technician already has a job scheduled during this time. Do you want to double-book them?')) {
            return // User cancelled
         }
      }
    }

    const { error } = await supabase.from('crm_jobs').update({
      customer_id: editJobForm.customer_id,
      property_id: editJobForm.property_id,
      service_type: editJobForm.service_type,
      status: editJobForm.status,
      scheduled_date: editJobForm.scheduled_date || null,
      start_time: editJobForm.start_time || null,
      end_time: editJobForm.end_time || null,
      quoted_price: editJobForm.quoted_price ? parseFloat(editJobForm.quoted_price) : null,
      technician_id: editJobForm.technician_id || null
    }).eq('id', editJobForm.id)

    if (error) {
      alert(`Error updating job: ${error.message}`)
    } else {
      setIsEditing(false)
      fetchJobs() // Refresh list
    }
  }


  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full"><div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin"></div></div>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-white mb-1">Scheduled Jobs</h1>
          <p className="text-sm text-white/40">Manage upcoming property visits and services.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-black/20 p-1 rounded-lg border border-white/5 mr-2">
            <button 
              onClick={() => setDisplayMode('list')} 
              className={`p-2 rounded-md transition-all ${displayMode === 'list' ? 'bg-blue-500 text-forest-950 shadow-sm' : 'text-white/40 hover:text-white'}`}
              title="List View"
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setDisplayMode('calendar')} 
              className={`p-2 rounded-md transition-all ${displayMode === 'calendar' ? 'bg-blue-500 text-forest-950 shadow-sm' : 'text-white/40 hover:text-white'}`}
              title="Calendar View"
            >
              <CalendarIcon size={18} />
            </button>
          </div>

          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-forest-950 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full md:w-auto"
          >
            <Plus size={18} />
            New Job
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {displayMode === 'calendar' ? (
        <JobsCalendarView 
          jobs={jobs} 
          onStatusChange={updateJobStatus}
          onEdit={handleOpenEdit}
          onDelete={deleteJob}
        />
      ) : (
        <div className="space-y-4">
          {jobs.length === 0 ? (
            <div className="p-12 border border-white/5 bg-forest-900 rounded-xl text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/20">
                <Clock size={32} />
              </div>
              <h3 className="text-white font-serif font-bold text-lg mb-2">No Scheduled Jobs</h3>
              <p className="text-white/40 text-sm max-w-sm mx-auto">Create a new job to start tracking upcoming property visits and services.</p>
            </div>
          ) : (
            // Existing List View Rendering
            jobs.map(job => (
              <div key={job.id} className="bg-forest-900 border border-white/5 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-forest-900/80 group">
                
                {/* Job Info */}
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className="mt-1">
                    {job.status === 'completed' && <CheckCircle2 className="text-brand-green" size={24} />}
                    {job.status === 'scheduled' && <Clock className="text-blue-400" size={24} />}
                    {job.status === 'in_progress' && <RefreshCw className="text-orange-400 animate-spin-slow" size={24} />}
                    {job.status === 'cancelled' && <XCircle className="text-red-500/60" size={24} />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-bold text-lg">{job.service_type}</h3>
                      {job.recurring_schedule_id && <span className="bg-blue-500/20 text-blue-300 text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-wide">Recurring</span>}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-white/50">
                      {job.scheduled_date && (
                        <div className="flex items-center gap-1.5 font-medium text-white/80">
                          <CalendarIcon size={14} /> 
                          {new Date(job.scheduled_date + 'T12:00:00').toLocaleDateString()}
                          {job.start_time && ` at ${new Date(`2000-01-01T${job.start_time}`).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1.5">
                        <User size={14} /> 
                        {job.crm_customers?.first_name} {job.crm_customers?.last_name}
                      </div>
                      
                      {job.crm_properties && (
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin size={14} /> 
                          {job.crm_properties.nickname || job.crm_properties.address_line1}
                        </div>
                      )}

                      {job.technicians && (
                        <div className="flex items-center gap-1.5 text-blue-300">
                          <User size={14} /> 
                          Tech: {job.technicians.first_name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 self-end md:self-auto border-t md:border-t-0 border-white/5 pt-3 md:pt-0 w-full md:w-auto justify-end">
                  
                  {job.quoted_price && <div className="text-white font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 text-sm mr-2">${job.quoted_price}</div>}

                  <select 
                    value={job.status}
                    onChange={(e) => updateJobStatus(job.id, e.target.value)}
                    className="bg-black/30 border border-white/10 rounded-lg text-sm text-white px-3 py-1.5 outline-none hover:border-white/20 transition-colors"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  
                  <div className="flex gap-1 border-l border-white/10 pl-3">
                    <button onClick={() => handleOpenEdit(job)} className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Edit Job">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button onClick={() => deleteJob(job.id)} className="p-2 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Job">
                      <Trash2Icon />
                    </button>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      )}


      {/* Create Job Form Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 p-6 rounded-xl w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-200 no-scrollbar max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsCreating(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">
              <XCircle size={24} />
            </button>
            
            <h2 className="text-xl font-serif font-bold text-white mb-6">Schedule New Job</h2>
            
            <form onSubmit={handleCreateJob} className="space-y-4">
              
              {/* Customer & Property Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Customer *</label>
                  <select 
                    required 
                    value={newJob.customer_id} 
                    onChange={e => {
                      setNewJob({...newJob, customer_id: e.target.value, property_id: ''})
                      fetchPropertiesForCustomer(e.target.value)
                    }} 
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="" className="bg-forest-900">Select Customer...</option>
                    {customers.map(c => <option key={c.id} value={c.id} className="bg-forest-900">{c.first_name} {c.last_name} {c.company_name ? `(${c.company_name})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Property *</label>
                  <select 
                    required 
                    value={newJob.property_id} 
                    onChange={e => setNewJob({...newJob, property_id: e.target.value})} 
                    disabled={!newJob.customer_id || properties.length === 0}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
                  >
                    <option value="" className="bg-forest-900">{properties.length === 0 ? 'No properties found' : 'Select Property...'}</option>
                    {properties.map(p => <option key={p.id} value={p.id} className="bg-forest-900">{p.nickname ? `${p.nickname} - ` : ''}{p.address_line1}</option>)}
                  </select>
                </div>
              </div>

              {/* Service & Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Service Type *</label>
                  <input required value={newJob.service_type} onChange={e => setNewJob({...newJob, service_type: e.target.value})} placeholder="e.g. Deep Root Fert" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/20" />
                </div>
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Quoted Price ($)</label>
                  <input type="number" step="0.01" min="0" value={newJob.quoted_price} onChange={e => setNewJob({...newJob, quoted_price: e.target.value})} placeholder="0.00" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-white/20" />
                </div>
              </div>

              {/* Scheduling */}
              <div className="bg-black/20 p-4 rounded-xl border border-white/10 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="md:col-span-1">
                    <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Date</label>
                    <input type="date" value={newJob.scheduled_date} onChange={e => setNewJob({...newJob, scheduled_date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" style={{colorScheme: 'dark'}} />
                 </div>
                 <div className="md:col-span-1">
                    <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Start Time</label>
                    <input type="time" value={newJob.start_time} onChange={e => setNewJob({...newJob, start_time: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" style={{colorScheme: 'dark'}} />
                 </div>
                 <div className="md:col-span-1">
                    <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">End Time</label>
                    <input type="time" value={newJob.end_time} onChange={e => setNewJob({...newJob, end_time: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" style={{colorScheme: 'dark'}} />
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

                <div className="pt-2 border-t border-white/5">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={newJob.is_recurring} onChange={e => setNewJob({...newJob, is_recurring: e.target.checked})} className="rounded bg-white/5 border-white/10 text-blue-500 focus:ring-blue-500/20" />
                    <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">Make this a Recurring Schedule</span>
                  </label>
                  
                  {newJob.is_recurring && (
                    <div className="mt-4 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
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
                          <input type="number" min="1" required={newJob.frequency === 'custom'} value={newJob.interval_days} onChange={e => setNewJob({...newJob, interval_days: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-white/50 hover:text-white transition-colors text-sm font-medium">Cancel</button>
                <button type="submit" disabled={!newJob.customer_id || !newJob.property_id || !newJob.service_type} className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 font-semibold rounded-lg transition-colors text-sm disabled:opacity-50">
                  Create Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Job Form Modal */}
      {isEditing && editJobForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 p-6 rounded-xl w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-200 no-scrollbar max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsEditing(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">
              <XCircle size={24} />
            </button>
            
            <h2 className="text-xl font-serif font-bold text-white mb-6">Edit Job</h2>
            
            <form onSubmit={handleSaveJobEdit} className="space-y-4">
              
              {/* Customer & Property Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Customer *</label>
                  <select 
                    required 
                    value={editJobForm.customer_id} 
                    onChange={e => {
                      setEditJobForm({...editJobForm, customer_id: e.target.value, property_id: ''})
                      fetchPropertiesForCustomer(e.target.value, true)
                    }} 
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="" className="bg-forest-900">Select Customer...</option>
                    {customers.map(c => <option key={c.id} value={c.id} className="bg-forest-900">{c.first_name} {c.last_name} {c.company_name ? `(${c.company_name})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Property *</label>
                  <select 
                    required 
                    value={editJobForm.property_id} 
                    onChange={e => setEditJobForm({...editJobForm, property_id: e.target.value})} 
                    disabled={!editJobForm.customer_id || properties.length === 0}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
                  >
                    <option value="" className="bg-forest-900">{properties.length === 0 ? 'No properties found' : 'Select Property...'}</option>
                    {properties.map(p => <option key={p.id} value={p.id} className="bg-forest-900">{p.nickname ? `${p.nickname} - ` : ''}{p.address_line1}</option>)}
                  </select>
                </div>
              </div>

              {/* Service & Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Service Type *</label>
                  <input required value={editJobForm.service_type} onChange={e => setEditJobForm({...editJobForm, service_type: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Quoted Price ($)</label>
                  <input type="number" step="0.01" min="0" value={editJobForm.quoted_price} onChange={e => setEditJobForm({...editJobForm, quoted_price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
              </div>

              {/* Scheduling Details */}
              <div className="bg-black/20 p-4 rounded-xl border border-white/10 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="md:col-span-1">
                    <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Date</label>
                    <input type="date" value={editJobForm.scheduled_date || ''} onChange={e => setEditJobForm({...editJobForm, scheduled_date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" style={{colorScheme: 'dark'}} />
                 </div>
                 <div className="md:col-span-1">
                    <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Start Time</label>
                    <input type="time" value={editJobForm.start_time || ''} onChange={e => setEditJobForm({...editJobForm, start_time: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" style={{colorScheme: 'dark'}} />
                 </div>
                 <div className="md:col-span-1">
                    <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">End Time</label>
                    <input type="time" value={editJobForm.end_time || ''} onChange={e => setEditJobForm({...editJobForm, end_time: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" style={{colorScheme: 'dark'}} />
                 </div>
                </div>

                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Assign To Technician</label>
                  <select value={editJobForm.technician_id} onChange={e => setEditJobForm({...editJobForm, technician_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                    <option value="" className="bg-forest-900">Unassigned</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id} className="bg-forest-900">{t.first_name} {t.last_initial}.</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Status</label>
                  <select 
                    value={editJobForm.status} 
                    onChange={e => setEditJobForm({...editJobForm, status: e.target.value})} 
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="scheduled" className="bg-forest-900">Scheduled</option>
                    <option value="in_progress" className="bg-forest-900">In Progress</option>
                    <option value="completed" className="bg-forest-900">Completed</option>
                    <option value="cancelled" className="bg-forest-900">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-white/50 hover:text-white transition-colors text-sm font-medium">Cancel</button>
                <button type="submit" disabled={!editJobForm.customer_id || !editJobForm.property_id || !editJobForm.service_type} className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 font-semibold rounded-lg transition-colors text-sm disabled:opacity-50">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Trash2Icon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
}
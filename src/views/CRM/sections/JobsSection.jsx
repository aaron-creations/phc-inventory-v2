import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useAuth } from '../../../contexts/AuthContext'
import { Plus, Search, Edit2, Trash2, Calendar as CalendarIcon, MapPin, CheckSquare, Clock, LayoutGrid, List } from 'lucide-react'
import JobsCalendarView from './JobsCalendarView'
import { format, parseISO } from 'date-fns'

export default function JobsSection() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [properties, setProperties] = useState([])
  const [customers, setCustomers] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all') // 'scheduled', 'in_progress', 'completed', 'cancelled'
  const [dateFilter, setDateFilter] = useState('')
  const [techFilter, setTechFilter] = useState('all')
  const [displayMode, setDisplayMode] = useState('list') // 'list' or 'calendar'

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  // Form states
  const [newJob, setNewJob] = useState({
    property_id: '',
    customer_id: '',
    technician_id: '',
    service_type: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    notes: '',
    is_recurring: false,
    frequency: 'monthly',
    interval: 1
  })

  const [editJobForm, setEditJobForm] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const [jobsRes, propsRes, custRes, techRes] = await Promise.all([
        supabase.from('crm_jobs')
          .select(`
            *,
            crm_properties(id, address, city),
            crm_customers(id, first_name, last_name, company_name),
            technician:technicians(id, name)
          `)
          .order('scheduled_date', { ascending: true }),
        supabase.from('crm_properties').select('id, address, customer_id').order('address'),
        supabase.from('crm_customers').select('id, first_name, last_name, company_name').order('last_name'),
        supabase.from('technicians').select('id, name, active').eq('active', true).order('name')
      ])

      setJobs(jobsRes.data || [])
      setProperties(propsRes.data || [])
      setCustomers(custRes.data || [])
      setTechnicians(techRes.data || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  // --- Double Booking Check ---
  const checkTimeConflict = (techId, date, startTime, endTime, excludeJobId = null) => {
    if (!techId || !date || !startTime || !endTime) return false

    // Convert strings to a comparable format, e.g., minutes since midnight
    const toMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number)
      return h * 60 + m
    }

    const startMins = toMinutes(startTime)
    const endMins = toMinutes(endTime)

    return jobs.some(job => {
      if (job.id === excludeJobId) return false // Ignore the job being edited
      if (job.technician_id !== techId) return false
      if (job.scheduled_date !== date) return false
      if (job.status === 'cancelled') return false // Ignore cancelled jobs
      if (!job.start_time || !job.end_time) return false

      const jobStartMins = toMinutes(job.start_time)
      const jobEndMins = toMinutes(job.end_time)

      // Time overlap logic: (StartA < EndB) and (EndA > StartB)
      return (startMins < jobEndMins) && (endMins > jobStartMins)
    })
  }

  // --- Add Job ---
  const handleCreateJob = async (e) => {
    e.preventDefault()
    
    // Check for double booking
    if (checkTimeConflict(newJob.technician_id, newJob.scheduled_date, newJob.start_time, newJob.end_time)) {
      alert("This technician is already booked during that time window on this date. Please choose a different time or technician.")
      return
    }

    try {
      let scheduleId = null

      // If user selected "Create Recurring Schedule", we insert into crm_recurring_schedules first
      if (newJob.is_recurring) {
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('crm_recurring_schedules')
          .insert([{
            customer_id: newJob.customer_id,
            property_id: newJob.property_id || null,
            service_type: newJob.service_type,
            frequency: newJob.frequency,
            interval: parseInt(newJob.interval) || 1,
            start_date: newJob.scheduled_date,
            start_time: newJob.start_time || null,
            end_time: newJob.end_time || null,
            status: 'active',
            notes: newJob.notes
          }])
          .select()
          .single()

        if (scheduleError) throw scheduleError
        scheduleId = scheduleData.id
      }

      // Insert the actual single job
      const { error } = await supabase.from('crm_jobs').insert([{
        property_id: newJob.property_id || null,
        customer_id: newJob.customer_id,
        technician_id: newJob.technician_id || null,
        recurring_schedule_id: scheduleId,
        service_type: newJob.service_type,
        scheduled_date: newJob.scheduled_date,
        start_time: newJob.start_time || null,
        end_time: newJob.end_time || null,
        status: 'scheduled',
        notes: newJob.notes
      }])

      if (error) throw error
      
      setShowCreateModal(false)
      setNewJob({
        property_id: '', customer_id: '', technician_id: '', service_type: '',
        scheduled_date: new Date().toISOString().split('T')[0], start_time: '', end_time: '', notes: '',
        is_recurring: false, frequency: 'monthly', interval: 1
      })
      fetchData()
    } catch (err) {
      console.error('Error creating job:', err)
      alert('Failed to create job.')
    }
  }

  // --- Update Job status inline ---
  const handleStatusChange = async (jobId, newStatus) => {
    try {
      const { error } = await supabase.from('crm_jobs').update({ status: newStatus }).eq('id', jobId)
      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Failed to update status.')
    }
  }

  // --- Edit existing job ---
  const handleSaveJobEdit = async (e) => {
    e.preventDefault()

    // Check for double booking
    if (checkTimeConflict(editJobForm.technician_id, editJobForm.scheduled_date, editJobForm.start_time, editJobForm.end_time, editJobForm.id)) {
      alert("This technician is already booked during that time window on this date. Please choose a different time or technician.")
      return
    }

    try {
      const { error } = await supabase.from('crm_jobs').update({
        technician_id: editJobForm.technician_id || null,
        service_type: editJobForm.service_type,
        scheduled_date: editJobForm.scheduled_date,
        start_time: editJobForm.start_time || null,
        end_time: editJobForm.end_time || null,
        status: editJobForm.status,
        notes: editJobForm.notes
      }).eq('id', editJobForm.id)
      
      if (error) throw error
      setShowEditModal(false)
      fetchData()
    } catch (err) {
      console.error('Error editing job:', err)
      alert("Failed to edit job.")
    }
  }

  // --- Delete job ---
  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this job?")) return
    try {
      const { error } = await supabase.from('crm_jobs').delete().eq('id', jobId)
      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error deleting job:', err)
      alert("Failed to delete job.")
    }
  }

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    const sMatch = statusFilter === 'all' || job.status === statusFilter
    const dMatch = !dateFilter || job.scheduled_date === dateFilter
    const tMatch = techFilter === 'all' || job.technician_id === techFilter
    return sMatch && dMatch && tMatch
  })

  // Format name helper
  const getCustomerName = (c) => {
    if (!c) return 'Unknown'
    return c.company_name ? `${c.company_name} (${c.first_name} ${c.last_name})` : `${c.first_name} ${c.last_name}`
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-brand-green/20 text-brand-green border-brand-green/30'
      case 'in_progress': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'scheduled': default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
  }


  return (
    <div className="p-4 md:p-6 w-full max-w-7xl mx-auto flex flex-col h-[calc(100vh-theme(spacing.16))] md:h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <CheckSquare className="text-blue-400" />
            Scheduled Jobs
          </h2>
          <p className="text-white/50 text-sm mt-1">Manage and assign specific service visits.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          {/* View Toggles */}
          <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
            <button 
              onClick={() => setDisplayMode('list')} 
              className={`p-2 flex items-center gap-2 rounded-md transition-all ${displayMode === 'list' ? 'bg-blue-500 text-forest-950 shadow-sm' : 'text-white/40 hover:text-white'}`}
              title="List View"
            >
              <List size={18} />
              <span className="text-sm font-semibold md:hidden">List</span>
            </button>
            <button 
              onClick={() => setDisplayMode('calendar')} 
              className={`p-2 flex items-center gap-2 rounded-md transition-all ${displayMode === 'calendar' ? 'bg-blue-500 text-forest-950 shadow-sm' : 'text-white/40 hover:text-white'}`}
              title="Calendar View"
            >
              <LayoutGrid size={18} />
              <span className="text-sm font-semibold md:hidden">Calendar</span>
            </button>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 justify-center shadow-lg"
          >
            <Plus size={18} />
            New Job
          </button>
        </div>
      </div>

      {/* Filters (Only show in list mode) */}
      {displayMode === 'list' && (
        <div className="flex flex-col md:flex-row gap-3 mb-6 shrink-0 bg-black/20 p-3 rounded-xl border border-white/5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 bg-forest-950 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-forest-900"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="flex-1 bg-forest-950 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-forest-900"
          >
            <option value="all">All Technicians</option>
            <option value="unassigned">Unassigned</option>
            {technicians.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="flex-1 bg-forest-950 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
          />
          {dateFilter && (
            <button onClick={() => setDateFilter('')} className="bg-white/5 hover:bg-white/10 text-white/50 px-3 rounded-lg text-sm transition-colors">
              Clear Date
            </button>
          )}
        </div>
      )}

      {loading && <div className="text-white/50 p-4 text-center">Loading jobs...</div>}

      {/* Content Area */}
      {!loading && (
        <div className="flex-1 overflow-y-auto pr-2 pb-8">
          {displayMode === 'calendar' ? (
            <JobsCalendarView 
              jobs={filteredJobs} 
              onStatusChange={handleStatusChange}
              onEdit={(job) => {
                setEditJobForm(job);
                setShowEditModal(true);
              }}
              onDelete={handleDeleteJob}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJobs.length === 0 ? (
                <div className="col-span-full text-center p-8 bg-black/20 rounded-xl border border-white/5">
                  <CheckSquare size={32} className="mx-auto text-white/20 mb-3" />
                  <p className="text-white/50">No jobs found matching your filters.</p>
                </div>
              ) : (
                filteredJobs.map(job => (
                  <div key={job.id} className="bg-forest-900 border border-white/5 rounded-xl p-4 flex flex-col hover:border-white/10 transition-colors shadow-lg group">
                    
                    {/* Top Row: Service & Status */}
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-base font-bold text-white line-clamp-1 flex-1 pr-2" title={job.service_type}>{job.service_type}</h3>
                      
                      <select
                        value={job.status}
                        onChange={(e) => handleStatusChange(job.id, e.target.value)}
                        className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-1 outline-none appearance-none border cursor-pointer ${getStatusColor(job.status)}`}
                      >
                        <option className="bg-forest-900 text-white" value="scheduled">Scheduled</option>
                        <option className="bg-forest-900 text-white" value="in_progress">In Progress</option>
                        <option className="bg-forest-900 text-white" value="completed">Completed</option>
                        <option className="bg-forest-900 text-white" value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    
                    {/* Details section */}
                    <div className="flex-1 space-y-2 mb-4">
                      {/* Customer & Tech */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-400 font-medium truncate max-w-[60%]">{getCustomerName(job.crm_customers)}</span>
                        {job.technician ? (
                          <span className="text-white/70 bg-white/5 px-2 py-0.5 rounded text-xs">{job.technician.name}</span>
                        ) : (
                          <span className="text-orange-400/80 bg-orange-400/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Unassigned</span>
                        )}
                      </div>
                      
                      {/* Property */}
                      {job.crm_properties && (
                        <div className="flex items-start gap-1.5 text-white/50 text-xs">
                          <MapPin size={14} className="shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{job.crm_properties.address}</span>
                        </div>
                      )}

                      {/* Date & Time */}
                      <div className="flex items-center gap-1.5 text-white/70 text-xs bg-black/20 p-2 rounded-lg border border-white/5">
                        <CalendarIcon size={14} className="text-brand-green shrink-0" />
                        <span>{format(parseISO(job.scheduled_date), 'MMM d, yyyy')}</span>
                        {job.start_time && job.end_time && (
                          <>
                             <span className="w-px h-3 bg-white/20 mx-1"></span>
                             <Clock size={12} className="text-brand-green/70 shrink-0" />
                             <span>{format(parseISO(`2000-01-01T${job.start_time}`), 'h:mm a')} - {format(parseISO(`2000-01-01T${job.end_time}`), 'h:mm a')}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                      {job.recurring_schedule_id ? (
                        <span className="text-[10px] text-blue-400/50 flex items-center gap-1 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Recurring
                        </span>
                      ) : <span />}
                      
                      <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditJobForm(job)
                            setShowEditModal(true)
                          }}
                          className="p-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded border border-white/5 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteJob(job.id)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded border border-red-500/20 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}


      {/* ================= MODALS ================= */}
      
      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus size={20} className="text-blue-400" /> Create New Job
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white/50 hover:text-white p-1">
                <Trash2 size={20} className="hidden" /> {/* Lazy placeholder for x mark */}
                <span className="text-xl">×</span>
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto no-scrollbar">
              <form id="create-job" onSubmit={handleCreateJob} className="space-y-4">
                
                {/* Customer Select */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Customer *</label>
                  <select
                    required
                    value={newJob.customer_id}
                    onChange={(e) => setNewJob({...newJob, customer_id: e.target.value, property_id: ''})}
                    className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-forest-900"
                  >
                    <option value="">Select a customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{getCustomerName(c)}</option>
                    ))}
                  </select>
                </div>

                {/* Optional Property */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Property (Optional)</label>
                  <select
                    value={newJob.property_id}
                    onChange={(e) => setNewJob({...newJob, property_id: e.target.value})}
                    disabled={!newJob.customer_id}
                    className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 [&>option]:bg-forest-900"
                  >
                    <option value="">Select a property...</option>
                    {properties.filter(p => p.customer_id === newJob.customer_id).map(p => (
                      <option key={p.id} value={p.id}>{p.address}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Service Type */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Service Type *</label>
                    <input
                      required
                      type="text"
                      value={newJob.service_type}
                      onChange={(e) => setNewJob({...newJob, service_type: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Tree Spraying"
                    />
                  </div>

                  {/* Technician */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Assign Technician (Optional)</label>
                    <select
                      value={newJob.technician_id}
                      onChange={(e) => setNewJob({...newJob, technician_id: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-forest-900"
                    >
                      <option value="">Unassigned</option>
                      {technicians.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/10 pt-4">
                  {/* Date */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Date *</label>
                    <input
                      required
                      type="date"
                      value={newJob.scheduled_date}
                      onChange={(e) => setNewJob({...newJob, scheduled_date: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>
                  {/* Start Time */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newJob.start_time}
                      onChange={(e) => setNewJob({...newJob, start_time: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>
                  {/* End Time */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">End Time</label>
                    <input
                      type="time"
                      value={newJob.end_time}
                      onChange={(e) => setNewJob({...newJob, end_time: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Make it recurring? */}
                <div className="bg-black/20 p-4 rounded-lg border border-white/5 mt-4">
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input 
                      type="checkbox"
                      checked={newJob.is_recurring}
                      onChange={(e) => setNewJob({...newJob, is_recurring: e.target.checked})}
                      className="w-4 h-4 rounded border-white/20 bg-forest-950 text-blue-500 focus:ring-blue-500/50"
                    />
                    <span className="text-sm text-white font-medium">Create a recurring schedule from this job</span>
                  </label>
                  
                  {newJob.is_recurring && (
                    <div className="flex gap-4 mt-3 pt-3 border-t border-white/10 pl-6">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-white/50 mb-1">Repeat Frequency</label>
                        <select
                          value={newJob.frequency}
                          onChange={(e) => setNewJob({...newJob, frequency: e.target.value})}
                          className="w-full bg-forest-950 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none [&>option]:bg-forest-900"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-medium text-white/50 mb-1">Repeat Every...</label>
                        <input
                          type="number"
                          min="1"
                          value={newJob.interval}
                          onChange={(e) => setNewJob({...newJob, interval: e.target.value})}
                          className="w-full bg-forest-950 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none text-center"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Notes</label>
                  <textarea
                    value={newJob.notes}
                    onChange={(e) => setNewJob({...newJob, notes: e.target.value})}
                    className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 min-h-[80px]"
                    placeholder="Gate codes, special instructions..."
                  />
                </div>

              </form>
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors" type="button">Cancel</button>
              <button form="create-job" type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                <CheckSquare size={16} /> Save Job
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Edit Job Modal */}
      {showEditModal && editJobForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 size={20} className="text-blue-400" /> Edit Job
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-white/50 hover:text-white p-1">
                <span className="text-xl">×</span>
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto no-scrollbar">
              <form id="edit-job-form" onSubmit={handleSaveJobEdit} className="space-y-4">
                
                {/* Header info (uneditable) */}
                <div className="bg-black/20 p-3 rounded-lg border border-white/5 mb-2">
                  <p className="text-sm font-bold text-white">{getCustomerName(editJobForm.crm_customers)}</p>
                  {editJobForm.crm_properties && <p className="text-xs text-white/50">{editJobForm.crm_properties.address}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Status</label>
                    <select
                      value={editJobForm.status}
                      onChange={(e) => setEditJobForm({...editJobForm, status: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-forest-900"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Technician</label>
                    <select
                      value={editJobForm.technician_id || ''}
                      onChange={(e) => setEditJobForm({...editJobForm, technician_id: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-forest-900"
                    >
                      <option value="">Unassigned</option>
                      {technicians.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Service Type *</label>
                  <input
                    required
                    type="text"
                    value={editJobForm.service_type}
                    onChange={(e) => setEditJobForm({...editJobForm, service_type: e.target.value})}
                    className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/10 pt-4">
                  {/* Date */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Date *</label>
                    <input
                      required
                      type="date"
                      value={editJobForm.scheduled_date}
                      onChange={(e) => setEditJobForm({...editJobForm, scheduled_date: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>
                  {/* Start Time */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={editJobForm.start_time || ''}
                      onChange={(e) => setEditJobForm({...editJobForm, start_time: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>
                  {/* End Time */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">End Time</label>
                    <input
                      type="time"
                      value={editJobForm.end_time || ''}
                      onChange={(e) => setEditJobForm({...editJobForm, end_time: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Notes</label>
                  <textarea
                    value={editJobForm.notes || ''}
                    onChange={(e) => setEditJobForm({...editJobForm, notes: e.target.value})}
                    className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 min-h-[80px]"
                  />
                </div>

              </form>
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-2">
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors">Cancel</button>
              <button form="edit-job-form" type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

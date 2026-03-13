import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Plus, Search, Edit2, Trash2, Calendar as CalendarIcon, Clock, Filter, AlertCircle, X, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function RecurringSchedulesSection() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  
  // Forms
  const [newSchedule, setNewSchedule] = useState({
    customer_id: '',
    property_id: '',
    service_type: '',
    frequency: 'monthly',
    interval: 1,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    start_time: '',
    end_time: '',
    notes: ''
  })
  
  const [editForm, setEditForm] = useState(null)

  // Lookups
  const [customers, setCustomers] = useState([])
  const [properties, setProperties] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [schedRes, custRes, propRes] = await Promise.all([
        supabase.from('crm_recurring_schedules')
          .select(`
            *,
            crm_customers(id, first_name, last_name, company_name),
            crm_properties(id, address, city)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('crm_customers').select('id, first_name, last_name, company_name').order('last_name'),
        supabase.from('crm_properties').select('id, address, customer_id').order('address')
      ])

      if (schedRes.error) throw schedRes.error
      if (custRes.error) throw custRes.error
      if (propRes.error) throw propRes.error

      setSchedules(schedRes.data || [])
      setCustomers(custRes.data || [])
      setProperties(propRes.data || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load recurring schedules.')
    } finally {
      setLoading(false)
    }
  }

  // --- DELETE SCHEDULE ---
  const deleteSchedule = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recurring schedule? This will also delete any upcoming scheduled jobs generated from it.')) return
    
    try {
      // 1. Delete associated future jobs (that are still 'scheduled')
      const { error: jobsError } = await supabase
        .from('crm_jobs')
        .delete()
        .eq('recurring_schedule_id', id)
        .ilike('status', 'scheduled')

      if (jobsError) throw jobsError

      // 2. Delete the schedule itself
      const { error: schedError } = await supabase
        .from('crm_recurring_schedules')
        .delete()
        .eq('id', id)

      if (schedError) throw schedError

      // Refresh
      fetchData()
    } catch (err) {
      console.error('Error deleting schedule:', err)
      alert('Failed to delete schedule.')
    }
  }


  // --- CREATE SCHEDULE ---
  const handleCreateSchedule = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase
        .from('crm_recurring_schedules')
        .insert([{
          customer_id: newSchedule.customer_id,
          property_id: newSchedule.property_id || null,
          service_type: newSchedule.service_type,
          frequency: newSchedule.frequency,
          interval: parseInt(newSchedule.interval) || 1,
          start_date: newSchedule.start_date,
          end_date: newSchedule.end_date || null,
          start_time: newSchedule.start_time || null,
          end_time: newSchedule.end_time || null,
          status: 'active',
          notes: newSchedule.notes
        }])

      if (error) throw error
      
      setShowCreateModal(false)
      setNewSchedule({
        customer_id: '', property_id: '', service_type: '', 
        frequency: 'monthly', interval: 1, start_date: new Date().toISOString().split('T')[0], 
        end_date: '', start_time: '', end_time: '', notes: ''
      })
      fetchData()
    } catch (err) {
      console.error('Error creating schedule:', err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  // --- EDIT SCHEDULE ---
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('crm_recurring_schedules')
        .update({
          service_type: editForm.service_type,
          frequency: editForm.frequency,
          interval: parseInt(editForm.interval) || 1,
          start_date: editForm.start_date,
          end_date: editForm.end_date || null,
          start_time: editForm.start_time || null,
          end_time: editForm.end_time || null,
          status: editForm.status,
          notes: editForm.notes
        })
        .eq('id', editForm.id)

      if (error) throw error
      
      setShowEditModal(false)
      fetchData()
    } catch (err) {
      console.error('Error updating schedule:', err)
      alert(err.message)
    }
  }

  // Find properties for selected customer
  const getCustomerProperties = (customerId) => {
    return properties.filter(p => p.customer_id === customerId)
  }

  // Format Helper
  const getCustomerName = (c) => {
    if (!c) return 'Unknown'
    if (c.company_name) return `${c.company_name} (${c.first_name} ${c.last_name})`
    return `${c.first_name} ${c.last_name}`
  }


  // FILTERING
  const filteredSchedules = schedules.filter(sched => {
    const matchesSearch = 
      sched.service_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sched.crm_customers?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sched.crm_customers?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || sched.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // =================== RENDER ===================
  return (
    <div className="p-4 md:p-6 w-full max-w-7xl mx-auto flex flex-col h-[calc(100vh-theme(spacing.16))] md:h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <CalendarIcon className="text-blue-400" />
            Recurring Jobs
          </h2>
          <p className="text-white/50 text-sm mt-1">Manage scheduled, repeating services.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 w-full md:w-auto justify-center shadow-lg"
        >
          <Plus size={18} />
          New Schedule
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text"
            placeholder="Search service, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
          />
        </div>
        
        <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-2">
          <Filter size={16} className="text-white/40" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-white text-sm focus:outline-none [&>option]:bg-forest-900"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading && <div className="text-white/50 p-4 text-center">Loading schedules...</div>}
      {error && <div className="text-red-400 p-4 text-center bg-red-500/10 rounded-lg border border-red-500/20">{error}</div>}

      {/* Main List */}
      {!loading && !error && (
        <div className="flex flex-col gap-3 overflow-y-auto pr-2 pb-8">
          {filteredSchedules.length === 0 ? (
            <div className="text-center p-8 bg-black/20 rounded-xl border border-white/5">
              <CalendarIcon size={32} className="mx-auto text-white/20 mb-3" />
              <p className="text-white/50">No recurring schedules found.</p>
            </div>
          ) : (
            filteredSchedules.map(sched => (
              <div key={sched.id} className="bg-forest-900 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors shadow-lg">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                  
                  {/* Left: Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{sched.service_type}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        sched.status === 'active' ? 'bg-brand-green/20 text-brand-green' :
                        sched.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {sched.status}
                      </span>
                    </div>
                    
                    <p className="text-blue-400/80 font-medium text-sm mb-2">{getCustomerName(sched.crm_customers)}</p>
                    {sched.crm_properties && (
                      <p className="text-white/50 text-xs flex items-center gap-1 mb-3">📍 {sched.crm_properties.address}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/70 bg-black/20 p-2.5 rounded-lg border border-white/5 inline-flex">
                      <div className="flex items-center gap-1.5 min-w-[120px]">
                        <RefreshIcon className="w-3.5 h-3.5 text-blue-400" />
                        Every {sched.interval > 1 ? sched.interval : ''} <span className="capitalize">{sched.frequency}</span>
                      </div>
                      <div className="w-px h-4 bg-white/10 hidden sm:block"></div>
                      <div className="flex items-center gap-1.5 min-w-[140px]">
                         <CalendarIcon size={14} className="text-blue-400"/>
                         Starts: {format(parseISO(sched.start_date), 'MMM d, yyyy')}
                      </div>
                      {sched.end_date && (
                         <>
                           <div className="w-px h-4 bg-white/10 hidden sm:block"></div>
                           <div className="flex items-center gap-1.5 min-w-[140px]">
                             <AlertCircle size={14} className="text-orange-400"/>
                             Ends: {format(parseISO(sched.end_date), 'MMM d, yyyy')}
                           </div>
                         </>
                      )}
                      {(sched.start_time || sched.end_time) && (
                         <>
                           <div className="w-px h-4 bg-white/10 hidden sm:block"></div>
                           <div className="flex items-center gap-1.5 text-brand-green">
                             <Clock size={14} className="text-brand-green"/>
                             {sched.start_time && format(parseISO(`2000-01-01T${sched.start_time}`), 'h:mm a')}
                             {sched.end_time && ` - ${format(parseISO(`2000-01-01T${sched.end_time}`), 'h:mm a')}`}
                           </div>
                         </>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-white/5 justify-end">
                    <button 
                      onClick={() => {
                        setEditForm(sched)
                        setShowEditModal(true)
                      }}
                      className="p-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-colors border border-white/5"
                      title="Edit Schedule"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteSchedule(sched.id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors border border-red-500/20 w-full md:w-auto flex justify-center"
                      title="Delete Schedule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                {sched.notes && (
                  <div className="mt-4 p-3 bg-black/20 rounded-lg border border-white/5 text-xs text-white/50 italic">
                    "{sched.notes}"
                  </div>
                )}

              </div>
            ))
          )}
        </div>
      )}


      {/* =============== CREATE MODAL =============== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus size={20} className="text-blue-400" />
                Create Recurring Schedule
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white/50 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto no-scrollbar">
              <form id="create-schedule-form" onSubmit={handleCreateSchedule} className="space-y-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Customer *</label>
                    <select
                      required
                      value={newSchedule.customer_id}
                      onChange={(e) => {
                        setNewSchedule({...newSchedule, customer_id: e.target.value, property_id: ''})
                      }}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-forest-900"
                    >
                      <option value="">Select a customer...</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{getCustomerName(c)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Property */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Property (Optional)</label>
                    <select
                      value={newSchedule.property_id}
                      onChange={(e) => setNewSchedule({...newSchedule, property_id: e.target.value})}
                      disabled={!newSchedule.customer_id}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 [&>option]:bg-forest-900"
                    >
                      <option value="">Select property...</option>
                      {getCustomerProperties(newSchedule.customer_id).map(p => (
                        <option key={p.id} value={p.id}>{p.address}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Service Type */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Service Type *</label>
                  <input
                    required
                    type="text"
                    value={newSchedule.service_type}
                    onChange={(e) => setNewSchedule({...newSchedule, service_type: e.target.value})}
                    className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Monthly Maintenance"
                  />
                </div>

                <div className="bg-black/20 p-4 rounded-lg border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Frequency */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Frequency</label>
                    <select
                      value={newSchedule.frequency}
                      onChange={(e) => setNewSchedule({...newSchedule, frequency: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-forest-900"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  {/* Interval */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Repeat Every...</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={newSchedule.interval}
                        onChange={(e) => setNewSchedule({...newSchedule, interval: e.target.value})}
                        className="w-20 bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 text-center"
                      />
                      <span className="text-white/50 text-sm">
                        {newSchedule.frequency}(s)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/10 pt-4">
                  {/* Start Date */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Start Date *</label>
                    <input
                      required
                      type="date"
                      value={newSchedule.start_date}
                      onChange={(e) => setNewSchedule({...newSchedule, start_date: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">End Date (Optional)</label>
                    <input
                      type="date"
                      value={newSchedule.end_date}
                      onChange={(e) => setNewSchedule({...newSchedule, end_date: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/10 pt-4">
                  {/* Start Time */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Start Time (Optional)</label>
                    <input
                      type="time"
                      value={newSchedule.start_time || ''}
                      onChange={(e) => setNewSchedule({...newSchedule, start_time: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">End Time (Optional)</label>
                    <input
                      type="time"
                      value={newSchedule.end_time || ''}
                      onChange={(e) => setNewSchedule({...newSchedule, end_time: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Notes</label>
                  <textarea
                    value={newSchedule.notes}
                    onChange={(e) => setNewSchedule({...newSchedule, notes: e.target.value})}
                    className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 min-h-[80px]"
                    placeholder="Instructions applied to all generated jobs..."
                  />
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-2">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button 
                form="create-schedule-form"
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <Check size={16} /> Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============== EDIT MODAL =============== */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 size={20} className="text-blue-400" />
                Edit Schedule
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-white/50 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto no-scrollbar">
              <form id="edit-schedule-form" onSubmit={handleSaveEdit} className="space-y-4">
                
                {/* Status Dropdown */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                    className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-forest-900"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Service Type */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Service Type *</label>
                  <input
                    required
                    type="text"
                    value={editForm.service_type}
                    onChange={(e) => setEditForm({...editForm, service_type: e.target.value})}
                    className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="bg-black/20 p-4 rounded-lg border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Frequency */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Frequency</label>
                    <select
                      value={editForm.frequency}
                      onChange={(e) => setEditForm({...editForm, frequency: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-forest-900"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  {/* Interval */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Repeat Every...</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={editForm.interval}
                        onChange={(e) => setEditForm({...editForm, interval: e.target.value})}
                        className="w-20 bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 text-center"
                      />
                      <span className="text-white/50 text-sm">
                        {editForm.frequency}(s)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/10 pt-4">
                  {/* Start Date */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Start Date *</label>
                    <input
                      required
                      type="date"
                      value={editForm.start_date}
                      onChange={(e) => setEditForm({...editForm, start_date: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">End Date</label>
                    <input
                      type="date"
                      value={editForm.end_date || ''}
                      onChange={(e) => setEditForm({...editForm, end_date: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/10 pt-4">
                  {/* Start Time */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">Start Time (Optional)</label>
                    <input
                      type="time"
                      value={editForm.start_time || ''}
                      onChange={(e) => setEditForm({...editForm, start_time: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1">End Time (Optional)</label>
                    <input
                      type="time"
                      value={editForm.end_time || ''}
                      onChange={(e) => setEditForm({...editForm, end_time: e.target.value})}
                      className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1">Notes</label>
                  <textarea
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                    className="w-full bg-forest-950 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-blue-500 min-h-[80px]"
                  />
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-2">
              <button 
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button 
                form="edit-schedule-form"
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <Check size={16} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// Simple icon component for Refresh
function RefreshIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  )
}

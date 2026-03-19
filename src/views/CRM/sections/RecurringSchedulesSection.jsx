import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Calendar as CalendarIcon, Edit, User, MapPin, Calculator, Search, Pause, Play, Trash2, X } from 'lucide-react'

export default function RecurringSchedulesSection() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  
  const [editingSchedule, setEditingSchedule] = useState(null)
  
  useEffect(() => {
    fetchSchedules()
  }, [])

  async function fetchSchedules() {
    setLoading(true)
    const { data, error } = await supabase
      .from('crm_recurring_schedules')
      .select(`
        *,
        crm_customers ( first_name, last_name, company_name ),
        crm_properties ( address_line1, nickname ),
        technicians ( first_name, last_initial )
      `)
      .order('created_at', { ascending: false })
      
    if (!error) setSchedules(data || [])
    setLoading(false)
  }
  
  async function triggerManualGeneration() {
    setIsGenerating(true)
    const { data, error } = await supabase.rpc('generate_upcoming_recurring_jobs')
    
    if (error) {
      alert(`Error generating jobs: ${error.message}`)
    } else {
      alert('Successfully generated all upcoming recurring jobs based on schedules.')
    }
    setIsGenerating(false)
  }

  async function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    const { error } = await supabase
      .from('crm_recurring_schedules')
      .update({ status: newStatus })
      .eq('id', id)
      
    if (error) alert(`Error: ${error.message}`)
    else setSchedules(schedules.map(s => s.id === id ? { ...s, status: newStatus } : s))
  }
  
  async function saveEdit(e) {
    e.preventDefault()
    setIsGenerating(true) // reuse loading state visually
    const { error } = await supabase.from('crm_recurring_schedules').update({
      service_type: editingSchedule.service_type,
      start_time: editingSchedule.start_time || null,
      end_time: editingSchedule.end_time || null,
      quoted_price: editingSchedule.quoted_price ? parseFloat(editingSchedule.quoted_price) : null,
      frequency: editingSchedule.frequency,
      interval_days: editingSchedule.frequency === 'custom' ? parseInt(editingSchedule.interval_days) : null
    }).eq('id', editingSchedule.id)
    
    setIsGenerating(false)
    if (error) {
      alert(`Error updating schedule: ${error.message}`)
    } else {
      setEditingSchedule(null)
      fetchSchedules()
    }
  }

  async function handleDelete(id) {
    if (confirm('Are you certain you want to permanently delete this recurring schedule? This stops all future automatically generated jobs. (Existing scheduled jobs will remain).')) {
      const { error } = await supabase.from('crm_recurring_schedules').delete().eq('id', id)
      if (error) alert(`Error deleting: ${error.message}`)
      else setSchedules(schedules.filter(s => s.id !== id))
    }
  }

  const filtered = schedules.filter(s => {
    const search = searchTerm.toLowerCase()
    return (
      (s.crm_customers?.last_name || '').toLowerCase().includes(search) ||
      (s.crm_customers?.first_name || '').toLowerCase().includes(search) ||
      s.service_type.toLowerCase().includes(search)
    )
  })

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-white mb-1">Recurring Schedules</h1>
          <p className="text-sm text-white/40">Manage automated repeating services for customers.</p>
        </div>
        
        <button
          onClick={triggerManualGeneration}
          disabled={isGenerating}
          className="flex items-center justify-center gap-2 bg-forest-800 hover:bg-forest-700 border border-white/10 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : <><Calculator size={18} /> Generate Upcoming Jobs</>}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
        <input 
          type="text" 
          placeholder="Search by customer name or service..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-forest-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-green/50 transition-colors"
        />
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin"></div></div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-white/40 border border-white/5 rounded-xl bg-forest-900">
          No recurring schedules found. Create one from the Scheduled Jobs tab.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(schedule => {
            const isPaused = schedule.status === 'paused'
            return (
              <div key={schedule.id} className={`bg-forest-900 border ${isPaused ? 'border-orange-500/20 opacity-75' : 'border-white/10'} rounded-xl p-5 flex flex-col justify-between`}>
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-white leading-tight">{schedule.service_type}</h3>
                    <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-md">
                      <button onClick={() => setEditingSchedule(schedule)} className="p-1 text-white/40 hover:text-white transition-colors" title="Edit"><Edit size={14} /></button>
                      <button 
                        onClick={() => toggleStatus(schedule.id, schedule.status)} 
                        className={`p-1 transition-colors ${isPaused ? 'text-orange-400 hover:text-orange-300' : 'text-brand-green/60 hover:text-brand-green'}`} 
                        title={isPaused ? "Resume schedule" : "Pause schedule"}
                      >
                        {isPaused ? <Play size={14} /> : <Pause size={14} />}
                      </button>
                      <button onClick={() => handleDelete(schedule.id)} className="p-1 text-red-500/50 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-6 text-sm">
                    <div className="flex gap-2 text-white/70 items-start">
                      <User size={14} className="text-white/30 shrink-0 mt-0.5" />
                      <span>{schedule.crm_customers?.first_name} {schedule.crm_customers?.last_name} {schedule.crm_customers?.company_name && <span className="text-white/40 text-xs ml-1">({schedule.crm_customers.company_name})</span>}</span>
                    </div>
                    <div className="flex gap-2 text-white/70 items-start">
                      <MapPin size={14} className="text-white/30 shrink-0 mt-0.5" />
                      <span>{schedule.crm_properties?.nickname || schedule.crm_properties?.address_line1}</span>
                    </div>
                    <div className="flex gap-2 text-white/70 items-center">
                      <CalendarIcon size={14} className="text-white/30 shrink-0" />
                      <span className="capitalize text-brand-green font-medium">
                        {schedule.frequency} 
                        {schedule.frequency === 'custom' && ` (Every ${schedule.interval_days} days)`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                   <div className="text-xs">
                     <span className="text-white/40 uppercase font-bold tracking-wider mr-2">Status</span>
                     <span className={`font-semibold ${isPaused ? 'text-orange-400' : 'text-brand-green'}`}>
                       {isPaused ? 'Paused' : 'Active'}
                     </span>
                   </div>
                   <div className="text-xs text-right text-white/40 uppercase font-bold tracking-wider">
                     Next Gen: <span className="text-white/80">{new Date(schedule.next_generation_date + 'T12:00:00').toLocaleDateString()}</span>
                   </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Editing Modal */}
      {editingSchedule && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 p-6 rounded-xl w-full max-w-lg relative">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-serif font-bold text-white mb-1">Edit Recurring Schedule</h2>
                <div className="text-xs text-white/50">{editingSchedule.crm_customers?.last_name} • {editingSchedule.crm_properties?.address_line1}</div>
              </div>
              <button onClick={() => setEditingSchedule(null)} className="text-white/40 hover:text-white"><X size={20}/></button>
            </div>
            
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-white/40 font-bold uppercase mb-1">Service Type</label>
                <input required value={editingSchedule.service_type || ''} onChange={e => setEditingSchedule({...editingSchedule, service_type: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-white/40 font-bold uppercase mb-1">Frequency</label>
                  <select value={editingSchedule.frequency} onChange={e => setEditingSchedule({...editingSchedule, frequency: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                    <option value="weekly" className="bg-forest-900">Weekly</option>
                    <option value="biweekly" className="bg-forest-900">Bi-Weekly</option>
                    <option value="monthly" className="bg-forest-900">Monthly</option>
                    <option value="quarterly" className="bg-forest-900">Quarterly</option>
                    <option value="yearly" className="bg-forest-900">Yearly</option>
                    <option value="custom" className="bg-forest-900">Custom Days</option>
                  </select>
                </div>
                {editingSchedule.frequency === 'custom' ? (
                  <div>
                    <label className="block text-[10px] text-white/40 font-bold uppercase mb-1">Interval Days</label>
                    <input type="number" min="1" required value={editingSchedule.interval_days || ''} onChange={e => setEditingSchedule({...editingSchedule, interval_days: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] text-white/40 font-bold uppercase mb-1">Quoted Price ($)</label>
                    <input type="number" step="0.01" value={editingSchedule.quoted_price || ''} onChange={e => setEditingSchedule({...editingSchedule, quoted_price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                )}
              </div>

              {/* Added times fields to edit modal */}
               <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Start Time</label>
                  <input type="time" value={editingSchedule.start_time || ''} onChange={e => setEditingSchedule({...editingSchedule, start_time: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" style={{colorScheme: 'dark'}} />
                </div>
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">End Time</label>
                  <input type="time" value={editingSchedule.end_time || ''} onChange={e => setEditingSchedule({...editingSchedule, end_time: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" style={{colorScheme: 'dark'}} />
                </div>
              </div>

               {editingSchedule.frequency === 'custom' && (
                  <div>
                    <label className="block text-[10px] text-white/40 font-bold uppercase mb-1">Quoted Price ($)</label>
                    <input type="number" step="0.01" value={editingSchedule.quoted_price || ''} onChange={e => setEditingSchedule({...editingSchedule, quoted_price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
               )}

               <p className="text-xs text-brand-green/70 bg-brand-green/10 p-2 rounded">
                 Note: Updating the frequency or pricing will only affect newly generated jobs, it will not go back and modify existing scheduled jobs.
               </p>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setEditingSchedule(null)} className="px-5 py-2 text-sm text-white/60 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={isGenerating} className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 font-semibold rounded-lg disabled:opacity-50">
                  {isGenerating ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

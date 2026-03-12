import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Clock, RefreshCw, MapPin, User, PauseCircle, PlayCircle, Trash2 } from 'lucide-react'

export default function RecurringSchedulesSection() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { fetchSchedules() }, [])

  async function fetchSchedules() {
    setLoading(true)
    const { data, error } = await supabase
      .from('crm_recurring_schedules')
      .select(`
        *,
        crm_customers ( first_name, last_name, company_name ),
        crm_properties ( address_line1, nickname ),
        technicians ( first_name, last_name )
      `)
      .order('created_at', { ascending: false })
    if (!error) setSchedules(data || [])
    setLoading(false)
  }

  async function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    const { error } = await supabase.from('crm_recurring_schedules').update({ status: newStatus }).eq('id', id)
    if (!error) setSchedules(schedules.map(s => s.id === id ? { ...s, status: newStatus } : s))
  }

  async function deleteSchedule(id) {
    if (confirm('Are you sure you want to delete this recurring schedule? Future jobs will stop generating. Already generated jobs will remain.')) {
      const { error } = await supabase.from('crm_recurring_schedules').delete().eq('id', id)
      if (error) alert(`Error deleting schedule: ${error.message}`)
      else setSchedules(schedules.filter(s => s.id !== id))
    }
  }

  async function manuallyRunGeneration() {
    setGenerating(true)
    const { error } = await supabase.rpc('generate_upcoming_recurring_jobs')
    setGenerating(false)
    if (error) {
      alert(`Error generating jobs: ${error.message}`)
    } else {
      alert('Successfully scanned and generated upcoming recurring jobs.')
      fetchSchedules()
    }
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full"><div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin"></div></div>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-white mb-1">Recurring Schedules</h1>
          <p className="text-sm text-white/40">Manage automated repeating services.</p>
        </div>
        <button
          onClick={manuallyRunGeneration}
          disabled={generating}
          className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
          title="Manually trigger the cron job to generate upcoming instances"
        >
          <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Running...' : 'Run Generation Batch Now'}
        </button>
      </div>

      <div className="bg-forest-900 border border-white/5 rounded-xl overflow-hidden shadow-lg">
        {schedules.length === 0 ? (
          <div className="p-8 text-center text-white/40">No recurring schedules found. You can set them up when scheduling a job.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-black/20">
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Service</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Customer / Property</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Frequency</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Next Auto-Gen</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {schedules.map(schedule => (
                  <tr key={schedule.id} className={`hover:bg-white/[0.02] transition-colors group ${schedule.status !== 'active' ? 'opacity-50' : ''}`}>
                    <td className="p-4 align-top">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${schedule.status === 'active' ? 'bg-brand-green' : 'bg-red-500'}`} title={schedule.status} />
                        <div className="text-white font-medium">{schedule.service_type}</div>
                      </div>
                      <div className="text-white/40 text-xs pl-4">
                        {schedule.technicians ? `${schedule.technicians.first_name} ${schedule.technicians.last_name}` : 'Unassigned'}
                        {schedule.quoted_price && <span className="ml-2">${schedule.quoted_price}</span>}
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="text-white/80 font-medium text-sm flex items-center gap-1.5 mb-1">
                        <User size={12} className="text-white/30"/> {schedule.crm_customers?.first_name} {schedule.crm_customers?.last_name}
                      </div>
                      <div className="text-white/50 text-xs flex items-center gap-1.5">
                        <MapPin size={12} className="text-white/30"/>
                        {schedule.crm_properties?.nickname || schedule.crm_properties?.address_line1}
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded text-xs text-white/70 capitalize">
                        <Clock size={12} className="text-blue-400" />
                        {schedule.frequency}
                        {schedule.frequency === 'custom' && ` (${schedule.interval_days} days)`}
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="text-white/60 text-sm">
                        {schedule.last_generated_date ? new Date(schedule.last_generated_date).toLocaleDateString() : 'Pending'}
                      </div>
                      <div className="text-white/30 text-[10px] mt-0.5 uppercase tracking-wide">
                        {schedule.status === 'active' ? 'Date generated up to' : 'Paused'}
                      </div>
                    </td>
                    <td className="p-4 align-top text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          onClick={() => toggleStatus(schedule.id, schedule.status)}
                          className={`p-1.5 rounded-lg transition-colors ${schedule.status === 'active' ? 'text-orange-400 hover:bg-orange-400/10' : 'text-brand-green hover:bg-brand-green/10'}`}
                          title={schedule.status === 'active' ? 'Pause Schedule' : 'Resume Schedule'}
                        >
                          {schedule.status === 'active' ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
                        </button>
                        <button
                          onClick={() => deleteSchedule(schedule.id)}
                          className="p-1.5 text-red-500/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Schedule"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

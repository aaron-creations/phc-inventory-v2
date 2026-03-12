import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabaseClient'
import { format, addDays } from 'date-fns'

export default function AssetDetail({ asset, onBack }) {
  const [schedules, setSchedules] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [activeTab, setActiveTab] = useState('tasks') // 'tasks' or 'logs'

  // New task form state
  const [serviceType, setServiceType] = useState('')
  const [intervalDays, setIntervalDays] = useState('')
  const [lastDoneDate, setLastDoneDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    loadAssetData()
  }, [asset.id])

  async function loadAssetData() {
    setLoading(true)
    const [scheduleRes, logsRes] = await Promise.all([
      supabase.from('fleet_maintenance_schedules').select('*').eq('asset_id', asset.id).order('next_due_date'),
      supabase.from('fleet_maintenance_logs').select(`
        id,
        service_type,
        date_completed,
        cost,
        notes,
        technicians ( first_name, last_initial )
      `).eq('asset_id', asset.id).order('date_completed', { ascending: false })
    ])
    setSchedules(scheduleRes.data || [])
    setLogs(logsRes.data || [])
    setLoading(false)
  }

  async function handleAddTask(e) {
    e.preventDefault()
    setIsAddingTask(false)

    const nextDue = addDays(new Date(lastDoneDate), parseInt(intervalDays))
    
    const { error } = await supabase.from('fleet_maintenance_schedules').insert({
      asset_id: asset.id,
      service_type: serviceType,
      interval_days: parseInt(intervalDays),
      last_done_date: lastDoneDate,
      next_due_date: format(nextDue, 'yyyy-MM-dd'),
      alert_sent: false
    })

    if (!error) {
      loadAssetData()
      setServiceType('')
      setIntervalDays('')
    }
  }

  async function markTaskComplete(schedule) {
    const today = format(new Date(), 'yyyy-MM-dd')
    const nextDue = format(addDays(new Date(), schedule.interval_days), 'yyyy-MM-dd')

    // 1. Update the schedule's next due date
    await supabase.from('fleet_maintenance_schedules').update({
      last_done_date: today,
      next_due_date: nextDue,
      alert_sent: false
    }).eq('id', schedule.id)

    // 2. Create a log entry
    await supabase.from('fleet_maintenance_logs').insert({
      asset_id: asset.id,
      service_type: schedule.service_type,
      date_completed: today,
      notes: `Routine maintenance completed.`
      // technician_id would come from auth context in a full implementation
    })

    loadAssetData()
  }

  async function deleteSchedule(id) {
    if (!confirm('Delete this maintenance task?')) return
    await supabase.from('fleet_maintenance_schedules').delete().eq('id', id)
    loadAssetData()
  }

  return (
    <div className="flex flex-col h-full bg-forest-950">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/10 bg-forest-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            ←
          </button>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">{asset.name}</h2>
            <p className="text-white/50 text-xs">
              {asset.year} {asset.make} {asset.model} {asset.vin && `· ${asset.vin}`}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === 'tasks' ? 'text-brand-green' : 'text-white/50 hover:text-white'
            }`}
          >
            Maintenance Schedule
            {activeTab === 'tasks' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === 'logs' ? 'text-brand-green' : 'text-white/50 hover:text-white'
            }`}
          >
            Service History
            {activeTab === 'logs' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green rounded-t-full" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'tasks' ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold">Upcoming Tasks</h3>
              <button
                onClick={() => setIsAddingTask(true)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors"
              >
                + Add Task
              </button>
            </div>

            {isAddingTask && (
              <form onSubmit={handleAddTask} className="glass rounded-xl p-4 mb-4 border border-brand-green/30 animate-in fade-in slide-in-from-top-2">
                <h4 className="text-white font-bold text-sm mb-3">New Maintenance Task</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-white/50 text-xs mb-1">Service Type</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-forest-950/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green text-sm"
                      placeholder="e.g. Oil Change, Blade Sharpening"
                      value={serviceType}
                      onChange={e => setServiceType(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/50 text-xs mb-1">Interval (Days)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        className="w-full bg-forest-950/50 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/20 focus:outline-none focus:border-brand-green text-sm"
                        placeholder="e.g. 90"
                        value={intervalDays}
                        onChange={e => setIntervalDays(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-white/50 text-xs mb-1">Last Done</label>
                      <input
                        type="date"
                        required
                        className="w-full bg-forest-950/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-green text-sm"
                        value={lastDoneDate}
                        onChange={e => setLastDoneDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingTask(false)}
                      className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-brand-green text-forest-950 rounded-lg text-sm font-bold hover:bg-brand-green/90"
                    >
                      Save Task
                    </button>
                  </div>
                </div>
              </form>
            )}

            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-24 bg-white/5 rounded-xl" />
                ))}
              </div>
            ) : schedules.length === 0 && !isAddingTask ? (
              <div className="text-center py-10 text-white/50 text-sm">
                No maintenance tasks scheduled.
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map(task => {
                  const isOverdue = new Date(task.next_due_date) < new Date()
                  const isDueSoon = new Date(task.next_due_date) < addDays(new Date(), 7)

                  return (
                    <div key={task.id} className="glass rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="text-white font-bold leading-tight">{task.service_type}</h4>
                          <p className="text-white/50 text-xs">Every {task.interval_days} days</p>
                        </div>
                        <div className="flex gap-2 items-center">
                          <button
                            onClick={() => deleteSchedule(task.id)}
                            className="text-white/30 hover:text-red-400 text-xs p-1"
                            title="Delete Task"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-black/20 rounded-lg p-2.5">
                        <div>
                          <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-0.5">Next Due</p>
                          <p className={`text-sm font-bold ${
                            isOverdue ? 'text-red-400' : isDueSoon ? 'text-brand-orange' : 'text-white'
                          }`}>
                            {format(new Date(task.next_due_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <button
                          onClick={() => markTaskComplete(task)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                            isOverdue
                              ? 'bg-red-400 hover:bg-red-300 text-black'
                              : isDueSoon
                                ? 'bg-brand-orange hover:bg-brand-orange/90 text-black'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          Mark Done
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          // Logs Tab
          <div className="space-y-3">
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-white/5 rounded-xl" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10 text-white/50 text-sm">
                No service history recorded.
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="glass rounded-xl p-3 border border-white/5 flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <span className="text-white font-medium text-sm">{log.service_type}</span>
                    <span className="text-white/40 text-xs">
                      {format(new Date(log.date_completed), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {log.notes && (
                    <p className="text-white/60 text-xs italic">
                      "{log.notes}"
                    </p>
                  )}
                  {log.cost !== null && (
                    <p className="text-brand-green/80 text-xs font-medium mt-1">
                      ${log.cost.toFixed(2)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

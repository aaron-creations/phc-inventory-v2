import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { useAuth } from '../../../contexts/AuthContext'
import { ArrowLeft, Plus, Save, X, Wrench, Settings, Edit2, Trash2 } from 'lucide-react'

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  
  const techId = profile?.technicians?.id

  const [asset, setAsset] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Log Add State
  const [isLogging, setIsLogging] = useState(false)
  const [editingLogId, setEditingLogId] = useState(null)
  const [newLog, setNewLog] = useState({
    service_type: '',
    description: '',
    service_date: new Date().toISOString().split('T')[0],
    cost: '',
    next_due_date: '',
    next_due_miles_hours: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchAssetData()
  }, [id])

  async function fetchAssetData() {
    setLoading(true)
    
    const { data: aData, error: aErr } = await supabase
      .from('fleet_assets')
      .select('*')
      .eq('id', id)
      .single()
      
    if (aErr) {
      console.error(aErr)
      setLoading(false)
      return
    }
    setAsset(aData)

    const { data: lData } = await supabase
      .from('fleet_maintenance_logs')
      .select(`
        *,
        technicians (first_name, last_initial)
      `)
      .eq('asset_id', id)
      .order('service_date', { ascending: false })
      .order('created_at', { ascending: false })
      
    if (lData) setLogs(lData)

    setLoading(false)
  }

  async function handleAddLog(e) {
    e.preventDefault()
    setSubmitting(true)
    
    // Convert empties to nulls
    const payload = {
      ...newLog,
      asset_id: id,
      technician_id: techId || null,
      cost: newLog.cost ? parseFloat(newLog.cost) : null,
      next_due_date: newLog.next_due_date || null,
      next_due_miles_hours: newLog.next_due_miles_hours ? parseInt(newLog.next_due_miles_hours) : null
    }

    let errorObj = null;
    let savedData = null;

    if (editingLogId) {
      const updatePayload = { ...payload }
      delete updatePayload.technician_id // keep original creator

      const { data, error } = await supabase
        .from('fleet_maintenance_logs')
        .update(updatePayload)
        .eq('id', editingLogId)
        .select(`
          *,
          technicians (first_name, last_initial)
        `)
        .single()
      errorObj = error
      savedData = data
    } else {
      const { data, error } = await supabase
        .from('fleet_maintenance_logs')
        .insert([payload])
        .select(`
          *,
          technicians (first_name, last_initial)
        `)
        .single()
      errorObj = error
      savedData = data
    }

    setSubmitting(false)

    if (errorObj) {
      alert(`Error saving log: ${errorObj.message}`)
    } else {
      if (editingLogId) {
        setLogs(logs.map(l => l.id === editingLogId ? savedData : l))
      } else {
        setLogs([savedData, ...logs])
      }
      cancelLogging()
    }
  }

  function cancelLogging() {
    setIsLogging(false)
    setEditingLogId(null)
    setNewLog({
      service_type: '', description: '', service_date: new Date().toISOString().split('T')[0],
      cost: '', next_due_date: '', next_due_miles_hours: ''
    })
  }

  function handleEdit(log) {
    setEditingLogId(log.id)
    setNewLog({
      service_type: log.service_type || '',
      description: log.description || '',
      service_date: log.service_date ? log.service_date.split('T')[0] : new Date().toISOString().split('T')[0],
      cost: log.cost !== null ? log.cost : '',
      next_due_date: log.next_due_date ? log.next_due_date.split('T')[0] : '',
      next_due_miles_hours: log.next_due_miles_hours !== null ? log.next_due_miles_hours : ''
    })
    setIsLogging(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this maintenance log?")) return
    
    const { error } = await supabase
      .from('fleet_maintenance_logs')
      .delete()
      .eq('id', id)
      
    if (error) {
      alert(`Error deleting log: ${error.message}`)
    } else {
      setLogs(logs.filter(l => l.id !== id))
    }
  }

  async function handleStatusToggle() {
    const newStatus = asset.status === 'active' ? 'in_shop' : 'active'
    const { error } = await supabase.from('fleet_assets').update({ status: newStatus }).eq('id', asset.id)
    if (!error) {
      setAsset({ ...asset, status: newStatus })
    }
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-screen bg-forest-950">
      <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-brand-orange animate-spin"></div>
    </div>
  )

  if (!asset) return (
    <div className="p-8 text-white/40 min-h-screen bg-forest-950">Asset not found.</div>
  )

  return (
    <div className="min-h-screen bg-forest-950 pb-20">
      <div className="flex bg-black/40 border-b border-white/5 sticky top-0 z-10 px-4 md:px-8 py-4 items-center gap-4">
        <button onClick={() => navigate('/fleet')} className="text-white/50 hover:text-white transition-colors text-sm font-medium">
          ← Back
        </button>
      </div>

      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row gap-4 justify-between md:items-start">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange mb-2 block">{asset.type}</span>
            <h1 className="text-3xl font-serif font-bold text-white mb-2 leading-none flex items-center gap-3">
              {asset.name}
            </h1>
            
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/50 mt-3">
              {asset.make_model && <span><span className="text-white/30 uppercase text-[10px] tracking-wider block mb-0.5">Make/Model</span>{asset.make_model}</span>}
              {asset.license_plate && <span><span className="text-white/30 uppercase text-[10px] tracking-wider block mb-0.5">Plate</span><span className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-white/70">{asset.license_plate}</span></span>}
              {asset.vin_serial && <span><span className="text-white/30 uppercase text-[10px] tracking-wider block mb-0.5">VIN / Serial</span><span className="font-mono text-white/70">{asset.vin_serial}</span></span>}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleStatusToggle}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border ${
                asset.status === 'active' 
                  ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' 
                  : 'bg-brand-green/10 text-brand-green border-brand-green/20 hover:bg-brand-green/20'
              }`}
            >
              {asset.status === 'active' ? 'Mark Out of Service' : 'Mark Active'}
            </button>
          </div>
        </div>

        {/* LOGS PANEL */}
        <section className="bg-forest-900 border border-white/5 rounded-xl overflow-hidden shadow-lg flex flex-col">
          <div className="p-4 md:p-6 border-b border-white/5 bg-black/10 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Wrench size={16} className="text-brand-orange" /> Maintenance History
            </h2>
            {!isLogging && (
              <button 
                onClick={() => setIsLogging(true)} 
                className="flex items-center justify-center gap-2 bg-brand-orange/20 hover:bg-brand-orange/30 text-brand-orange border border-brand-orange/30 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
              >
                <Plus size={16} /> Log Maintenance
              </button>
            )}
          </div>

          <div className="p-4 md:p-6 flex-1">
            {isLogging && (
              <div className="mb-8 p-5 bg-black/20 rounded-xl border border-white/10 animate-in fade-in duration-200">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">{editingLogId ? 'Edit Service Log' : 'New Service Log'}</h3>
                  <button type="button" onClick={cancelLogging} className="text-white/40 hover:text-white"><X size={16} /></button>
                </div>
                
                <form onSubmit={handleAddLog} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Service Type *</label>
                      <input required placeholder="e.g. Oil Change, Filter..." value={newLog.service_type} onChange={e => setNewLog({...newLog, service_type: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-brand-orange/50 outline-none" />
                    </div>
                    <div>
                      <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Date Completed *</label>
                      <input required type="date" value={newLog.service_date} onChange={e => setNewLog({...newLog, service_date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-brand-orange/50 outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Description / Notes</label>
                    <textarea placeholder="Replaced air filter, checked tire pressure..." value={newLog.description} onChange={e => setNewLog({...newLog, description: e.target.value})} rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-brand-orange/50 outline-none" />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/5 pt-4">
                    <div>
                      <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Cost ($)</label>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={newLog.cost} onChange={e => setNewLog({...newLog, cost: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-orange/50 outline-none" />
                    </div>
                    <div>
                      <label className="block text-brand-orange/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Next Due (Date)</label>
                      <input type="date" value={newLog.next_due_date} onChange={e => setNewLog({...newLog, next_due_date: e.target.value})} className="w-full bg-brand-orange/5 border border-brand-orange/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-orange/50 outline-none" />
                    </div>
                    <div>
                      <label className="block text-brand-orange/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Next Due (Miles/Hrs)</label>
                      <input type="number" placeholder="105000" value={newLog.next_due_miles_hours} onChange={e => setNewLog({...newLog, next_due_miles_hours: e.target.value})} className="w-full bg-brand-orange/5 border border-brand-orange/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-orange/50 outline-none" />
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-2">
                    <button type="submit" disabled={!newLog.service_type || submitting} className="flex items-center gap-1.5 px-6 py-2.5 bg-brand-orange hover:bg-brand-orange/90 text-forest-950 font-bold rounded-lg transition-colors disabled:opacity-50">
                      <Save size={16} /> {submitting ? 'Saving...' : 'Save Log'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {logs.length === 0 && !isLogging ? (
              <p className="text-sm text-white/30 italic text-center py-10">No maintenance history recorded.</p>
            ) : (
              <div className="space-y-4">
                {logs.map(log => (
                  <div key={log.id} className="p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-white font-bold leading-tight">{log.service_type}</h3>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
                          <button onClick={() => handleEdit(log)} className="text-white/30 hover:text-white transition-colors" title="Edit">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(log.id)} className="text-white/30 hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <span className="text-xs text-brand-green font-mono">
                        {log.cost ? `$${log.cost.toFixed(2)}` : ''}
                      </span>
                    </div>
                    
                    {log.description && (
                      <p className="text-white/60 text-sm mb-3 whitespace-pre-wrap">{log.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 pt-3 border-t border-white/5 text-[11px] uppercase tracking-wider font-semibold">
                      <div className="text-white/30">
                        Date: <span className="text-white/70">{new Date(log.service_date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-white/30">
                        Tech: <span className="text-white/70">{log.technicians ? `${log.technicians.first_name}` : 'Unknown'}</span>
                      </div>
                      
                      {(log.next_due_date || log.next_due_miles_hours) && (
                        <div className="text-brand-orange/60 ml-auto">
                          Next Due:{' '}
                          <span className="text-brand-orange">
                            {log.next_due_date && new Date(log.next_due_date).toLocaleDateString()}
                            {log.next_due_date && log.next_due_miles_hours && ' or '}
                            {log.next_due_miles_hours && `${log.next_due_miles_hours.toLocaleString()} m/h`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}

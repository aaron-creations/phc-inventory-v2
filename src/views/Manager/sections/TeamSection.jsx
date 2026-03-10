import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { format, startOfWeek, startOfMonth } from 'date-fns'

export default function TeamSection() {
  const [technicians, setTechnicians] = useState([])
  const [techStats, setTechStats] = useState({})
  const [newName, setNewName] = useState('')
  const [newInitial, setNewInitial] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState({})
  useEffect(() => { load() }, [])
  async function load() {
    const { data: techs } = await supabase.from('technicians').select('*').order('first_name')
    setTechnicians(techs || [])
    if (!techs?.length) return
    const now = new Date()
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const { data: txs } = await supabase.from('transactions').select('technician_id, amount, date, type').in('type', ['USAGE','BLEND']).order('date', { ascending: false })
    const stats = {}
    techs.forEach(t => { stats[t.id] = { week: 0, month: 0, total: 0, lastDate: null, txCount: 0 } })
    ;(txs || []).forEach(tx => {
      if (!tx.technician_id || !stats[tx.technician_id]) return
      const s = stats[tx.technician_id]
      s.total += tx.amount || 0; s.txCount += 1
      if (!s.lastDate || tx.date > s.lastDate) s.lastDate = tx.date
      if (tx.date >= monthStart) s.month += tx.amount || 0
      if (tx.date >= weekStart) s.week += tx.amount || 0
    })
    setTechStats(stats)
  }
  async function addTech() {
    if (!newName.trim()) return
    setSaving(true)
    await supabase.from('technicians').insert({ first_name: newName.trim(), last_initial: newInitial.trim().toUpperCase() || null, color_hex: '#4ade80' })
    setNewName(''); setNewInitial('')
    await load(); setSaving(false)
  }
  async function removeTech(id) {
    if (!confirm('Remove this technician?')) return
    await supabase.from('technicians').delete().eq('id', id); await load()
  }
  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-white font-bold text-xl mb-6">Team</h2>
      <div className="flex flex-col gap-3 mb-8">
        {technicians.length === 0 ? <p className="text-white/30 text-sm text-center py-8 glass rounded-xl">No technicians added yet.</p> :
          technicians.map(tech => {
            const s = techStats[tech.id] || {}
            return (
              <div key={tech.id} className="glass rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-all" onClick={() => setExpanded(e => ({ ...e, [tech.id]: !e[tech.id] }))}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-forest-950 font-bold text-lg flex-shrink-0" style={{ backgroundColor: tech.color_hex }}>{tech.first_name[0]}</div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{tech.first_name} {tech.last_initial ? `${tech.last_initial}.` : ''}</p>
                    {s.lastDate ? <p className="text-white/30 text-xs">Last active: {format(new Date(s.lastDate + 'T00:00:00'), 'MMM d, yyyy')}</p> : <p className="text-white/20 text-xs">No activity yet</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={e => { e.stopPropagation(); removeTech(tech.id) }} className="text-white/20 hover:text-red-400 text-xs transition-colors px-2 py-1">Remove</button>
                    <span className="text-white/20 text-sm">{expanded[tech.id] ? '▲' : '▼'}</span>
                  </div>
                </div>
                {expanded[tech.id] && (
                  <div className="border-t border-white/5 px-4 pb-4 pt-3">
                    <div className="grid grid-cols-3 gap-3">
                      {[{ label: 'This Week', value: s.week?.toFixed(1) ?? '0', unit: 'units', color: 'text-brand-green' }, { label: 'This Month', value: s.month?.toFixed(1) ?? '0', unit: 'units', color: 'text-brand-blue' }, { label: 'All-time Logs', value: s.txCount ?? 0, unit: 'entries', color: 'text-white/70' }].map(sc => (
                        <div key={sc.label} className="bg-white/5 rounded-xl p-3 text-center">
                          <p className={`text-xl font-bold ${sc.color}`}>{sc.value}</p>
                          <p className="text-white/30 text-xs mt-0.5">{sc.unit}</p>
                          <p className="text-white/20 text-xs">{sc.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
      </div>
      <h3 className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-3">Add Technician</h3>
      <div className="flex gap-2 mb-2">
        <input type="text" placeholder="First name" value={newName} onChange={e => setNewName(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/30 focus:border-brand-green/50" />
        <input type="text" placeholder="Last initial" value={newInitial} onChange={e => setNewInitial(e.target.value)} maxLength={1} className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/30" />
      </div>
      <button onClick={addTech} disabled={saving || !newName.trim()} className="w-full py-2.5 rounded-xl bg-brand-green text-forest-950 font-semibold text-sm disabled:opacity-40 hover:bg-brand-green/90 transition-all">{saving ? 'Adding...' : '+ Add Technician'}</button>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function SettingsSection() {
  const [thresholdInput, setThresholdInput] = useState('0.5')
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    supabase.from('settings').select('key, value').then(({ data }) => { if (!data) return; const t = data.find(s => s.key === 'default_low_stock_threshold'); if (t) setThresholdInput(t.value) })
    supabase.auth.getUser().then(({ data }) => { if (data?.user?.email) setEmailInput(data.user.email) })
  }, [])
  async function saveThreshold() { setSaving(true); await supabase.from('settings').upsert({ key: 'default_low_stock_threshold', value: thresholdInput }); setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false) }
  async function updatePassword() { if (!passwordInput.trim()) return; setSaving(true); await supabase.auth.updateUser({ password: passwordInput }); setPasswordInput(''); setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false) }
  async function exportAll() {
    const { data } = await supabase.from('transactions').select('*, products(name), blends(name), technicians(first_name, last_initial)').order('date', { ascending: false })
    if (!data) return
    const csv = ['Date,Type,Product/Blend,Technician,Amount,Unit,Cost', ...data.map(t => [t.date, t.type, t.type === 'BLEND' ? t.blends?.name : t.products?.name, t.technicians ? `${t.technicians.first_name} ${t.technicians.last_initial}.` : '', t.amount, t.unit, t.estimated_cost ? `$${t.estimated_cost.toFixed(2)}` : ''].join(','))].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'PHC_All_Data.csv'; a.click()
  }
  return (
    <div className="p-6 max-w-md">
      <h2 className="text-white font-bold text-xl mb-6">Settings</h2>
      {saved && <div className="mb-4 px-4 py-2.5 rounded-xl bg-brand-green/15 border border-brand-green/30 text-brand-green text-sm">✓ Saved successfully</div>}
      <section className="glass rounded-xl p-4 mb-4">
        <h3 className="text-white/70 font-semibold text-sm mb-1">Low Stock Threshold</h3>
        <p className="text-white/30 text-xs mb-3">Minimum containers before a product is flagged as "Low Stock".</p>
        <div className="flex gap-2">
          <input type="number" step="0.1" min="0" value={thresholdInput} onChange={e => setThresholdInput(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50" />
          <button onClick={saveThreshold} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-green text-forest-950 text-sm font-semibold disabled:opacity-40 hover:bg-brand-green/90 transition-all">Save</button>
        </div>
      </section>
      <section className="glass rounded-xl p-4 mb-4">
        <h3 className="text-white/70 font-semibold text-sm mb-1">Manager Password</h3>
        <p className="text-white/30 text-xs mb-3">Update your manager account password.</p>
        <p className="text-white/40 text-xs mb-2">Email: <span className="text-white/60">{emailInput}</span></p>
        <div className="flex gap-2">
          <input type="password" placeholder="New password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50 placeholder-white/30" />
          <button onClick={updatePassword} disabled={saving || !passwordInput} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm disabled:opacity-40 transition-all">Update</button>
        </div>
      </section>
      <section className="glass rounded-xl p-4">
        <h3 className="text-white/70 font-semibold text-sm mb-1">Export All Data</h3>
        <p className="text-white/30 text-xs mb-3">Download a full CSV of all transaction history.</p>
        <button onClick={exportAll} className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-sm transition-all">↓ Export All Transactions as CSV</button>
      </section>
    </div>
  )
}

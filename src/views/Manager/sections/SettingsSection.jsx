import { supabase } from '../../../lib/supabaseClient'

export default function SettingsSection() {

  async function exportAll() {
    const { data } = await supabase.from('transactions')
      .select('*, products(name), blends(name), technicians(first_name, last_initial)')
      .order('date', { ascending: false })
    if (!data) return
    const csv = ['Date,Type,Product/Blend,Technician,Amount,Unit,Cost',
      ...data.map(t => [
        t.date, t.type,
        t.type === 'BLEND' ? t.blends?.name : t.products?.name,
        t.technicians ? `${t.technicians.first_name} ${t.technicians.last_initial}.` : '',
        t.amount, t.unit,
        t.estimated_cost ? `$${t.estimated_cost.toFixed(2)}` : '',
      ].join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'PHC_All_Data.csv'; a.click()
  }

  return (
    <div className="p-6 max-w-md">
      <h2 className="text-white font-bold text-xl mb-2">Settings</h2>
      <p className="text-white/30 text-sm mb-6">
        Per-product low stock thresholds are managed in the{' '}
        <span className="text-brand-green font-medium">Inventory</span> section via the product editor.
      </p>

      {/* Export */}
      <section className="glass rounded-xl p-4">
        <h3 className="text-white/70 font-semibold text-sm mb-1">Export All Data</h3>
        <p className="text-white/30 text-xs mb-3">Download a full CSV of all transaction history.</p>
        <button onClick={exportAll}
          className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-sm transition-all">
          ↓ Export All Transactions as CSV
        </button>
      </section>
    </div>
  )
}

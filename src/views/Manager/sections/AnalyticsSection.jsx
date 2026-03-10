import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { format, subDays, parseISO } from 'date-fns'

const RANGES = [
  { label: '7 Days',  days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
]
const COLORS = ['#4ade80','#fb923c','#60a5fa','#f472b6','#a78bfa','#34d399','#fbbf24','#818cf8']

function CustomTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-xl border border-white/10">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((entry, i) => <p key={i} style={{ color: entry.color }} className="font-semibold">{entry.value?.toFixed(2)}{unit}</p>)}
    </div>
  )
}

export default function AnalyticsSection() {
  const [range, setRange] = useState(30)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const since = format(subDays(new Date(), range), 'yyyy-MM-dd')
      const { data } = await supabase.from('transactions').select('*, products(name), blends(name), technicians(first_name, last_initial)').gte('date', since).order('date', { ascending: true })
      setTransactions(data || [])
      setLoading(false)
    }
    load()
  }, [range])

  const productUsage = useMemo(() => {
    const map = {}
    transactions.forEach(tx => {
      if (tx.type !== 'USAGE' && tx.type !== 'BLEND') return
      const name = tx.products?.name || tx.blends?.name || 'Unknown'
      map[name] = (map[name] || 0) + (tx.amount || 0)
    })
    return Object.entries(map).map(([name, total]) => ({ name: name.length > 22 ? name.slice(0, 20) + '\u2026' : name, total })).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [transactions])

  const techUsage = useMemo(() => {
    const map = {}
    transactions.forEach(tx => {
      if (tx.type === 'RESTOCK') return
      const name = tx.technicians ? `${tx.technicians.first_name} ${tx.technicians.last_initial || ''}.`.trim() : 'Unknown'
      map[name] = (map[name] || 0) + (tx.amount || 0)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [transactions])

  const dailyVolume = useMemo(() => {
    const map = {}
    for (let i = range; i >= 0; i--) { map[format(subDays(new Date(), i), 'MMM d')] = 0 }
    transactions.forEach(tx => {
      if (tx.type === 'RESTOCK') return
      const d = format(parseISO(tx.date), 'MMM d')
      if (map[d] !== undefined) map[d] += tx.amount || 0
    })
    return Object.entries(map).map(([date, amount]) => ({ date, amount }))
  }, [transactions, range])

  const totalUsage = transactions.filter(t => t.type !== 'RESTOCK').reduce((s, t) => s + (t.amount || 0), 0)
  const totalCost  = transactions.reduce((s, t) => s + (t.estimated_cost || 0), 0)
  const txCount    = transactions.filter(t => t.type !== 'RESTOCK').length

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-bold text-xl">Analytics</h2>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button key={r.days} onClick={() => setRange(r.days)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${range === r.days ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>{r.label}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Log Entries',    value: txCount,                          color: 'text-white' },
          { label: 'Total Usage',    value: `${totalUsage.toFixed(1)} units`, color: 'text-brand-blue' },
          { label: 'Estimated Cost', value: `$${totalCost.toFixed(2)}`,       color: 'text-brand-orange' },
        ].map(k => (
          <div key={k.label} className="glass rounded-xl p-4">
            <p className="text-white/40 text-xs mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{loading ? <span className="inline-block w-20 h-5 bg-white/10 rounded animate-pulse" /> : k.value}</p>
          </div>
        ))}
      </div>
      {loading ? (
        <div className="flex flex-col gap-4">{[200,180,200].map((h,i) => <div key={i} className="glass rounded-xl animate-pulse" style={{ height: h }} />)}</div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="glass rounded-xl p-5">
            <h3 className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-4">Top Products by Usage</h3>
            {productUsage.length === 0 ? <p className="text-white/20 text-sm text-center py-8">No usage data in this period.</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={productUsage} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip unit=" units" />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="total" radius={[0,4,4,0]}>{productUsage.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-5">
              <h3 className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-4">Usage by Technician</h3>
              {techUsage.length === 0 ? <p className="text-white/20 text-sm text-center py-8">No data.</p> : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={techUsage} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {techUsage.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend formatter={v => <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="glass rounded-xl p-5">
              <h3 className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-4">Daily Activity</h3>
              {dailyVolume.every(d => d.amount === 0) ? <p className="text-white/20 text-sm text-center py-8">No activity in this period.</p> : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyVolume} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={range <= 7 ? 0 : range <= 30 ? 4 : 9} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip unit=" units" />} />
                    <Line type="monotone" dataKey="amount" stroke="#4ade80" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#4ade80' }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

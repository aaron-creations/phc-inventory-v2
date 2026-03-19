import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { format, subDays, parseISO } from 'date-fns'

// ─── Constants ────────────────────────────────────────────────────────────────
const RANGES = [
  { label: '7 Days',  days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
]

const COLORS = ['#4ade80', '#fb923c', '#60a5fa', '#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#818cf8']
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const UNIT_TO_FL_OZ = { gal: 128, qt: 32, pint: 16, oz: 1, 'fl oz': 1, liter: 33.814 }

// ─── Blend cost helpers (mirrors BlendsSection.jsx) ───────────────────────────
function componentCost(bc) {
  const p = bc.products
  if (!p?.cost_per_container || !p?.container_size || !bc.rate_fl_oz_per_100_gal) return null
  const containerFlOz = p.container_size * (UNIT_TO_FL_OZ[p.container_unit] || 128)
  const costPerFlOz   = p.cost_per_container / containerFlOz
  return costPerFlOz * bc.rate_fl_oz_per_100_gal
}

function blendTotalCost(components = []) {
  let total = 0, hasCost = false
  for (const bc of components) {
    const c = componentCost(bc)
    if (c !== null) { total += c; hasCost = true }
  }
  return hasCost ? total : null
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, prefix = '', unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-xl border border-white/10">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-semibold">
          {prefix}{typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}{unit}
        </p>
      ))}
    </div>
  )
}

// ─── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <h3 className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-4">
      {children}
    </h3>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function Empty({ text = 'No data in this period.' }) {
  return <p className="text-white/20 text-sm text-center py-10">{text}</p>
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function AnalyticsSection() {
  const [range, setRange]           = useState(30)
  const [transactions, setTx]       = useState([])
  const [crmJobs, setCrmJobs]       = useState([])
  const [products, setProducts]     = useState([])
  const [blends, setBlends]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [selectedTech, setSelectedTech] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setSelectedTech(null)
      const since = format(subDays(new Date(), range), 'yyyy-MM-dd')

      const [txRes, jobsRes, prodRes, blendRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, products(name), blends(name), technicians(first_name, last_initial)')
          .gte('date', since)
          .order('date', { ascending: true }),

        supabase
          .from('crm_jobs')
          .select('id, status, service_type, scheduled_date')
          .gte('scheduled_date', since)
          .neq('status', 'cancelled'),

        supabase
          .from('products')
          .select('id, name, containers_in_stock, low_stock_threshold'),

        supabase
          .from('blends')
          .select('id, name, emoji, blend_components(*, products(name, cost_per_container, container_size, container_unit))'),
      ])

      setTx(txRes.data || [])
      setCrmJobs(jobsRes.data || [])
      setProducts(prodRes.data || [])
      setBlends(blendRes.data || [])
      setLoading(false)
    }
    load()
  }, [range])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const techName = tx =>
    tx.technicians
      ? `${tx.technicians.first_name} ${tx.technicians.last_initial || ''}.`.trim()
      : 'Unknown'

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const usageTx     = transactions.filter(t => t.type !== 'RESTOCK')
  const totalUsage  = usageTx.reduce((s, t) => s + (t.amount || 0), 0)
  const totalCost   = transactions.reduce((s, t) => s + (t.estimated_cost || 0), 0)
  const txCount     = usageTx.length
  const jobsCompleted  = crmJobs.filter(j => j.status === 'completed').length
  const jobsTotal      = crmJobs.length
  const completionRate = jobsTotal > 0 ? Math.round((jobsCompleted / jobsTotal) * 100) : null

  // ── Chart 1: Top Products (with optional tech filter) ─────────────────────────
  const productUsage = useMemo(() => {
    const map = {}
    transactions.forEach(tx => {
      if (tx.type === 'RESTOCK') return
      if (selectedTech && techName(tx) !== selectedTech) return
      const name = tx.products?.name || tx.blends?.name || 'Unknown'
      map[name] = (map[name] || 0) + (tx.amount || 0)
    })
    return Object.entries(map)
      .map(([name, total]) => ({ name: name.length > 22 ? name.slice(0, 20) + '…' : name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [transactions, selectedTech])

  // ── Chart 2: Usage by Technician ─────────────────────────────────────────────
  const techUsage = useMemo(() => {
    const map = {}
    transactions.forEach(tx => {
      if (tx.type === 'RESTOCK') return
      const name = techName(tx)
      map[name] = (map[name] || 0) + (tx.amount || 0)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [transactions])

  // ── Chart 3: Daily Volume ─────────────────────────────────────────────────────
  const dailyVolume = useMemo(() => {
    const map = {}
    for (let i = range; i >= 0; i--) map[format(subDays(new Date(), i), 'MMM d')] = 0
    transactions.forEach(tx => {
      if (tx.type === 'RESTOCK') return
      const d = format(parseISO(tx.date), 'MMM d')
      if (map[d] !== undefined) map[d] += tx.amount || 0
    })
    return Object.entries(map).map(([date, amount]) => ({ date, amount }))
  }, [transactions, range])

  // ── Chart 4: Cost Trend (per day) ────────────────────────────────────────────
  const costTrend = useMemo(() => {
    const map = {}
    for (let i = range; i >= 0; i--) map[format(subDays(new Date(), i), 'MMM d')] = 0
    transactions.forEach(tx => {
      const d = format(parseISO(tx.date), 'MMM d')
      if (map[d] !== undefined) map[d] += tx.estimated_cost || 0
    })
    return Object.entries(map).map(([date, cost]) => ({ date, cost }))
  }, [transactions, range])

  // ── Chart 5: Restock vs Usage Balance ────────────────────────────────────────
  const balanceData = useMemo(() => {
    const usageMap = {}, restockMap = {}
    transactions.forEach(tx => {
      const name = tx.products?.name
      if (!name) return
      if (tx.type === 'USAGE' || tx.type === 'BLEND') {
        usageMap[name] = (usageMap[name] || 0) + (tx.amount || 0)
      } else if (tx.type === 'RESTOCK') {
        restockMap[name] = (restockMap[name] || 0) + (tx.amount || 0)
      }
    })
    const all = new Set([...Object.keys(usageMap), ...Object.keys(restockMap)])
    return [...all]
      .map(name => ({
        name: name.length > 18 ? name.slice(0, 16) + '…' : name,
        usage:   +(usageMap[name]   || 0).toFixed(1),
        restock: +(restockMap[name] || 0).toFixed(1),
      }))
      .sort((a, b) => b.usage + b.restock - (a.usage + a.restock))
      .slice(0, 8)
  }, [transactions])

  // ── Chart 6: Day-of-Week Heatmap ─────────────────────────────────────────────
  const dowHeatmap = useMemo(() => {
    const totals = Array(7).fill(0)
    transactions.forEach(tx => {
      if (tx.type === 'RESTOCK') return
      const d = parseISO(tx.date).getDay() // 0=Sun
      totals[d] += tx.amount || 0
    })
    const max = Math.max(...totals, 1)
    return DAYS.map((label, i) => ({
      label,
      value: totals[i],
      opacity: Math.max(0.08, totals[i] / max),
    }))
  }, [transactions])

  // ── Chart 7: Service Type Breakdown ──────────────────────────────────────────
  const serviceBreakdown = useMemo(() => {
    const map = {}
    crmJobs.forEach(job => {
      const t = job.service_type || 'Unknown'
      map[t] = (map[t] || 0) + 1
    })
    return Object.entries(map)
      .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, count }))
      .sort((a, b) => b.count - a.count)
  }, [crmJobs])

  // ── Table 1: Burn Rate Predictor ─────────────────────────────────────────────
  const burnRateRows = useMemo(() => {
    const usageByProduct = {}
    transactions.forEach(tx => {
      if (tx.type === 'RESTOCK' || !tx.products?.name) return
      usageByProduct[tx.products.name] = (usageByProduct[tx.products.name] || 0) + (tx.amount || 0)
    })
    return products
      .filter(p => p.containers_in_stock > 0 && usageByProduct[p.name])
      .map(p => {
        const totalUnitsUsed = usageByProduct[p.name] || 0
        const avgPerDay = totalUnitsUsed / range
        const daysLeft = avgPerDay > 0 ? Math.floor(p.containers_in_stock / avgPerDay) : Infinity
        return { name: p.name, stock: p.containers_in_stock, avgPerDay, daysLeft }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 10)
  }, [transactions, products, range])

  // ── Table 2: Blend Realized Cost ─────────────────────────────────────────────
  const blendCostRows = useMemo(() =>
    blends
      .map(b => ({ name: b.name, emoji: b.emoji, cost: blendTotalCost(b.blend_components || []) }))
      .filter(b => b.cost !== null),
    [blends]
  )

  // ─────────────────────────────────────────────────────────────────────────────

  const xAxisInterval = range <= 7 ? 0 : range <= 30 ? 4 : 9

  return (
    <div className="p-6 max-w-4xl">

      {/* ── Header + Range Selector ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-bold text-xl">Analytics</h2>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                range === r.days
                  ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards (4-col) ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Log Entries',    value: txCount,                             color: 'text-white',        sub: null },
          { label: 'Total Usage',    value: `${totalUsage.toFixed(1)} units`,    color: 'text-brand-blue',   sub: null },
          { label: 'Estimated Cost', value: `$${totalCost.toFixed(2)}`,          color: 'text-brand-orange', sub: null },
          {
            label: 'Jobs Completed',
            value: jobsCompleted,
            color: 'text-brand-green',
            sub: completionRate !== null ? `${completionRate}% completion` : null,
          },
        ].map(k => (
          <div key={k.label} className="glass rounded-xl p-4">
            <p className="text-white/40 text-xs mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>
              {loading ? <span className="inline-block w-20 h-5 bg-white/10 rounded animate-pulse" /> : k.value}
            </p>
            {k.sub && !loading && (
              <p className="text-white/30 text-[10px] mt-0.5">{k.sub}</p>
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[200, 200, 180, 200, 160, 160].map((h, i) => (
            <div key={i} className="glass rounded-xl animate-pulse" style={{ height: h }} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* ── Cost Trend ─────────────────────────────────────────────── */}
          <div className="glass rounded-xl p-5">
            <SectionLabel>Cost Trend</SectionLabel>
            {costTrend.every(d => d.cost === 0) ? <Empty /> : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={costTrend} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={xAxisInterval} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(0)}`} />
                  <Tooltip content={<CustomTooltip prefix="$" />} />
                  <Line type="monotone" dataKey="cost" stroke="#fb923c" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#fb923c' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Top Products by Usage (with drilldown filter) ──────────── */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>
                Top Products by Usage
                {selectedTech && <span className="ml-2 text-brand-orange normal-case font-normal">— {selectedTech}</span>}
              </SectionLabel>
              {selectedTech && (
                <button
                  onClick={() => setSelectedTech(null)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50 hover:text-white hover:bg-white/20 transition-all flex-shrink-0 mb-4"
                >
                  × Clear filter
                </button>
              )}
            </div>
            {productUsage.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={productUsage} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip unit=" units" />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {productUsage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Tech Donut + Daily Volume ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Technician donut — click slice to drilldown */}
            <div className="glass rounded-xl p-5">
              <SectionLabel>Usage by Technician</SectionLabel>
              <p className="text-white/30 text-[10px] mb-3 -mt-2">Click a slice to filter Top Products</p>
              {techUsage.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={techUsage}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      cursor="pointer"
                      onClick={(entry) => {
                        setSelectedTech(prev => prev === entry.name ? null : entry.name)
                      }}
                    >
                      {techUsage.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={COLORS[i % COLORS.length]}
                          opacity={selectedTech === null || selectedTech === entry.name ? 1 : 0.25}
                          stroke={selectedTech === entry.name ? '#fff' : 'transparent'}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip unit=" units" />} />
                    <Legend formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Daily Activity */}
            <div className="glass rounded-xl p-5">
              <SectionLabel>Daily Activity</SectionLabel>
              {dailyVolume.every(d => d.amount === 0) ? <Empty /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dailyVolume} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} interval={xAxisInterval} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip unit=" units" />} />
                    <Line type="monotone" dataKey="amount" stroke="#4ade80" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#4ade80' }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Restock vs Usage Balance ────────────────────────────────── */}
          <div className="glass rounded-xl p-5">
            <SectionLabel>Restock vs. Usage Balance</SectionLabel>
            {balanceData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={balanceData} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip unit=" units" />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="usage" name="Usage" fill="#60a5fa" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="restock" name="Restock" fill="#4ade80" radius={[0, 4, 4, 0]} />
                  <Legend formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>{value}</span>} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Day-of-Week Heatmap + Service Breakdown ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Day-of-week heatmap */}
            <div className="glass rounded-xl p-5">
              <SectionLabel>Busiest Days of Week</SectionLabel>
              <div className="flex gap-2 mt-2">
                {dowHeatmap.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full rounded-lg transition-all"
                      style={{
                        height: 64,
                        backgroundColor: `rgba(74, 222, 128, ${day.opacity})`,
                        border: '1px solid rgba(74,222,128,0.15)',
                      }}
                      title={`${day.label}: ${day.value.toFixed(1)} units`}
                    />
                    <span className="text-white/40 text-[9px] font-semibold">{day.label}</span>
                    <span className="text-white/25 text-[9px] font-mono">{day.value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Service type breakdown */}
            <div className="glass rounded-xl p-5">
              <SectionLabel>Jobs by Service Type</SectionLabel>
              {serviceBreakdown.length === 0 ? <Empty text="No jobs in this period." /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={serviceBreakdown} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip unit=" jobs" />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {serviceBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Low-Stock Burn Rate Predictor ───────────────────────────── */}
          {burnRateRows.length > 0 && (
            <div className="glass rounded-xl p-5">
              <SectionLabel>Low-Stock Burn Rate Predictor</SectionLabel>
              <p className="text-white/30 text-[11px] mb-4 -mt-2">
                At current burn rate — products with usage in the last {range} days.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-white/30 pb-2 font-medium">Product</th>
                      <th className="text-right text-white/30 pb-2 font-medium">In Stock</th>
                      <th className="text-right text-white/30 pb-2 font-medium">Avg / Day</th>
                      <th className="text-right text-white/30 pb-2 font-medium">Days Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {burnRateRows.map((row, i) => {
                      const isRed    = row.daysLeft < 7
                      const isOrange = row.daysLeft >= 7 && row.daysLeft < 14
                      const color    = isRed ? 'text-red-400' : isOrange ? 'text-brand-orange' : 'text-brand-green'
                      return (
                        <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                          <td className="text-white/70 py-2.5">{row.name}</td>
                          <td className="text-right text-white/50 py-2.5 font-mono">{row.stock.toFixed(2)}</td>
                          <td className="text-right text-white/50 py-2.5 font-mono">{row.avgPerDay.toFixed(3)}</td>
                          <td className={`text-right py-2.5 font-bold font-mono ${color}`}>
                            {row.daysLeft === Infinity ? '—' : row.daysLeft}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Blend Realized Cost Calculator ─────────────────────────── */}
          {blendCostRows.length > 0 && (
            <div className="glass rounded-xl p-5">
              <SectionLabel>Blend Realized Cost</SectionLabel>
              <p className="text-white/30 text-[11px] mb-4 -mt-2">
                Calculated from current product costs and blend component formula rates.
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-white/30 pb-2 font-medium">Blend</th>
                    <th className="text-right text-white/30 pb-2 font-medium">Cost / 100 gal application</th>
                  </tr>
                </thead>
                <tbody>
                  {blendCostRows.map((b, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="text-white/70 py-3">{b.emoji} {b.name}</td>
                      <td className="text-right text-brand-green font-bold font-mono py-3">${b.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

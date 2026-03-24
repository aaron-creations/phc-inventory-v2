import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
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
const UNIT_TO_FL_OZ = { gal: 128, qt: 32, pint: 16, oz: 1, 'fl oz': 1, liter: 33.814 }

// ─── Blend cost helpers ────────────────────────────────────────────────────────
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

function SectionLabel({ children }) {
  return (
    <h3 className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-4">
      {children}
    </h3>
  )
}

function Empty({ text = 'No data in this period.' }) {
  return <p className="text-white/20 text-sm text-center py-10">{text}</p>
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function AnalyticsSection() {
  const [range, setRange]       = useState(30)
  const [transactions, setTx]   = useState([])
  const [products, setProducts] = useState([])
  const [blends, setBlends]     = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const since = format(subDays(new Date(), range), 'yyyy-MM-dd')

      const [txRes, prodRes, blendRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, products(name), blends(name), technicians(first_name, last_initial)')
          .gte('date', since)
          .order('date', { ascending: true }),
        supabase
          .from('products')
          .select('id, name, containers_in_stock, low_stock_threshold'),
        supabase
          .from('blends')
          .select('id, name, emoji, blend_components(*, products(name, cost_per_container, container_size, container_unit))'),
      ])

      setTx(txRes.data || [])
      setProducts(prodRes.data || [])
      setBlends(blendRes.data || [])
      setLoading(false)
    }
    load()
  }, [range])

  const techName = tx =>
    tx.technicians
      ? `${tx.technicians.first_name} ${tx.technicians.last_initial || ''}.`.trim()
      : 'Unknown'

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const usageTx    = transactions.filter(t => t.type !== 'RESTOCK')
  const totalUsage = usageTx.reduce((s, t) => s + (t.amount || 0), 0)
  const totalCost  = transactions.reduce((s, t) => s + (t.estimated_cost || 0), 0)
  const txCount    = usageTx.length

  // ── 1. Burn Rate Predictor ───────────────────────────────────────────────────
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

  const criticalBurnRows = burnRateRows.filter(r => r.daysLeft !== Infinity && r.daysLeft < 21)

  // ── 2. Cost Trend ────────────────────────────────────────────────────────────
  const costTrend = useMemo(() => {
    const map = {}
    for (let i = range; i >= 0; i--) map[format(subDays(new Date(), i), 'MMM d')] = 0
    transactions.forEach(tx => {
      const d = format(parseISO(tx.date), 'MMM d')
      if (map[d] !== undefined) map[d] += tx.estimated_cost || 0
    })
    return Object.entries(map).map(([date, cost]) => ({ date, cost }))
  }, [transactions, range])

  // ── 3. Top Products ──────────────────────────────────────────────────────────
  const productUsage = useMemo(() => {
    const map = {}
    transactions.forEach(tx => {
      if (tx.type === 'RESTOCK') return
      const name = tx.products?.name || tx.blends?.name || 'Unknown'
      map[name] = (map[name] || 0) + (tx.amount || 0)
    })
    return Object.entries(map)
      .map(([name, total]) => ({ name: name.length > 22 ? name.slice(0, 20) + '…' : name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [transactions])

  // ── 4. Per-Tech Summary ──────────────────────────────────────────────────────
  const techSummary = useMemo(() => {
    const map = {}
    transactions.forEach(tx => {
      const name = techName(tx)
      if (!map[name]) map[name] = { logs: 0, productSet: new Set(), cost: 0 }
      if (tx.type !== 'RESTOCK') {
        map[name].logs++
        if (tx.products?.name) map[name].productSet.add(tx.products.name)
        map[name].cost += tx.estimated_cost || 0
      }
    })
    return Object.entries(map).map(([name, d]) => ({
      name,
      logs: d.logs,
      products: d.productSet.size,
      cost: d.cost,
    })).sort((a, b) => b.logs - a.logs)
  }, [transactions])

  // ── 5. Blend Realized Cost ───────────────────────────────────────────────────
  const blendCostRows = useMemo(() =>
    blends
      .map(b => ({ name: b.name, emoji: b.emoji, cost: blendTotalCost(b.blend_components || []) }))
      .filter(b => b.cost !== null),
    [blends]
  )

  const xAxisInterval = range <= 7 ? 0 : range <= 30 ? 4 : 9

  return (
    <div className="p-6 max-w-4xl">

      {/* Header + Range Selector */}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Log Entries',    value: txCount,                          color: 'text-white' },
          { label: 'Total Usage',    value: `${totalUsage.toFixed(1)} units`, color: 'text-blue-400' },
          { label: 'Estimated Cost', value: `$${totalCost.toFixed(2)}`,       color: 'text-brand-orange' },
        ].map(k => (
          <div key={k.label} className="glass rounded-xl p-4">
            <p className="text-white/40 text-xs mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>
              {loading ? <span className="inline-block w-20 h-5 bg-white/10 rounded animate-pulse" /> : k.value}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[120, 200, 200, 180].map((h, i) => (
            <div key={i} className="glass rounded-xl animate-pulse" style={{ height: h }} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* 1. Burn Rate Predictor */}
          {burnRateRows.length > 0 && (
            <div className="glass rounded-xl p-5">
              <SectionLabel>🔥 Burn Rate Predictor</SectionLabel>

              {criticalBurnRows.length > 0 && (
                <div className="mb-4 flex flex-col gap-1.5">
                  {criticalBurnRows.map(row => {
                    const isRed = row.daysLeft < 7
                    const isOrange = row.daysLeft >= 7 && row.daysLeft < 14
                    const emoji = isRed ? '🔴' : isOrange ? '🟠' : '🟡'
                    const urgency = isRed ? 'Reorder now' : isOrange ? 'Reorder within 2 weeks' : 'Reorder soon'
                    return (
                      <p key={row.name} className="text-sm">
                        <span className="mr-1">{emoji}</span>
                        <span className={`font-semibold ${isRed ? 'text-red-400' : isOrange ? 'text-brand-orange' : 'text-yellow-400'}`}>
                          {row.name}
                        </span>
                        <span className="text-white/40"> — {urgency} ({row.daysLeft} day{row.daysLeft !== 1 ? 's' : ''} left at current rate)</span>
                      </p>
                    )
                  })}
                </div>
              )}

              <p className="text-white/30 text-[11px] mb-4">
                Based on usage in the last {range} days · {burnRateRows.length} product{burnRateRows.length !== 1 ? 's' : ''} active
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

          {/* 2. Cost Trend */}
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

          {/* 3. Top Products by Usage */}
          <div className="glass rounded-xl p-5">
            <SectionLabel>Top Products by Usage</SectionLabel>
            {productUsage.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={Math.max(180, productUsage.length * 26)}>
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

          {/* 4. Per-Tech Summary */}
          {techSummary.length > 0 && (
            <div className="glass rounded-xl p-5">
              <SectionLabel>Technician Summary</SectionLabel>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-white/30 pb-2 font-medium">Technician</th>
                    <th className="text-right text-white/30 pb-2 font-medium">Log Entries</th>
                    <th className="text-right text-white/30 pb-2 font-medium">Products Used</th>
                    <th className="text-right text-white/30 pb-2 font-medium">Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {techSummary.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="text-white/70 py-2.5 font-medium">{row.name}</td>
                      <td className="text-right text-white/60 py-2.5 font-mono">{row.logs}</td>
                      <td className="text-right text-white/60 py-2.5 font-mono">{row.products}</td>
                      <td className="text-right text-brand-orange py-2.5 font-mono font-semibold">${row.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 5. Blend Realized Cost */}
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

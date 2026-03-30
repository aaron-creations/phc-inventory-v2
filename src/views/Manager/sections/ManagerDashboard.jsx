import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { format, startOfWeek } from 'date-fns'
import { AlertTriangle, CheckCircle2, Users, TrendingUp, Activity, PackageX, Zap } from 'lucide-react'

export default function ManagerDashboard() {
  const [kpis, setKpis] = useState({ lowStockCount: 0, weekTxCount: 0, weekCost: 0, activeTechs: 0 })
  const [attention, setAttention] = useState({ lowStock: [], pendingUsers: 0 })
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

      const [prodRes, weekTxRes, pendingRes, activityRes, techRes] = await Promise.all([
        // All products to find low/out stock
        supabase.from('products').select('id, name, containers_in_stock, low_stock_threshold'),
        // All transactions this week for cost + count
        supabase.from('transactions').select('estimated_cost, technician_id').gte('date', weekStart),
        // Pending users awaiting approval
        supabase.from('user_profiles').select('id', { count: 'exact' }).eq('role', 'pending'),
        // Recent activity (last 5 transactions)
        supabase.from('transactions')
          .select('*, products(name), blends(name), technicians(first_name, last_initial)')
          .order('date', { ascending: false }).limit(5),
        // Active technicians
        supabase.from('technicians').select('id', { count: 'exact' }),
      ])

      const products = prodRes.data || []
      const lowStock = products.filter(p => p.containers_in_stock <= p.low_stock_threshold)
      const weekTxData = weekTxRes.data || []
      const weekCost = weekTxData.reduce((s, t) => s + (t.estimated_cost || 0), 0)
      const weekTxCount = weekTxData.length
      const activeTechIds = new Set(weekTxData.filter(t => t.technician_id).map(t => t.technician_id))

      setKpis({
        lowStockCount: lowStock.length,
        weekTxCount,
        weekCost,
        activeTechs: activeTechIds.size,
      })

      setAttention({
        lowStock: lowStock.slice(0, 5),
        pendingUsers: pendingRes.count || 0,
      })

      setActivity(activityRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const hasAttentionItems = attention.lowStock.length > 0 || attention.pendingUsers > 0

  function getTypeBadge(type) {
    const map = {
      USAGE:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
      RESTOCK: 'bg-brand-green/15 text-brand-green border-brand-green/20',
      BLEND:   'bg-brand-orange/15 text-brand-orange border-brand-orange/20',
    }
    return map[type] || 'bg-white/10 text-white/50'
  }

  function txLabel(tx) {
    const name = tx.type === 'BLEND' ? tx.blends?.name : tx.products?.name
    const tech = tx.technicians ? `${tx.technicians.first_name} ${tx.technicians.last_initial}.` : ''
    const amount = tx.type === 'RESTOCK' ? `+${tx.amount} containers` : `${tx.amount} ${tx.unit}`
    return { name, tech, amount }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-white font-bold text-xl mb-6">Dashboard</h2>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Low / Out Stock */}
        <div
          onClick={() => navigate('/stock')}
          className={`glass rounded-xl p-4 cursor-pointer hover:bg-white/[0.07] transition-all group ${!loading && kpis.lowStockCount > 0 ? 'border border-red-500/20 bg-red-500/5' : ''}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <PackageX size={14} className={kpis.lowStockCount > 0 ? 'text-red-400' : 'text-white/20'} />
            <p className="text-white/40 text-xs">Low / Out of Stock</p>
          </div>
          <p className={`text-2xl font-bold ${kpis.lowStockCount > 0 ? 'text-red-400' : 'text-white/30'}`}>
            {loading ? <span className="inline-block w-12 h-6 bg-white/10 rounded animate-pulse" /> : kpis.lowStockCount}
          </p>
          <p className="text-white/25 text-[10px] mt-1 group-hover:text-white/40 transition-colors">
            {kpis.lowStockCount > 0 ? 'Tap to view →' : 'All stocked up'}
          </p>
        </div>

        {/* Transactions This Week */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-blue-400" />
            <p className="text-white/40 text-xs">Transactions This Week</p>
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {loading ? <span className="inline-block w-12 h-6 bg-white/10 rounded animate-pulse" /> : kpis.weekTxCount}
          </p>
          <p className="text-white/25 text-[10px] mt-1">{format(new Date(), 'EEEE, MMM d')}</p>
        </div>

        {/* Cost This Week */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-brand-orange" />
            <p className="text-white/40 text-xs">Cost This Week</p>
          </div>
          <p className="text-2xl font-bold text-brand-orange">
            {loading ? <span className="inline-block w-12 h-6 bg-white/10 rounded animate-pulse" /> : `$${kpis.weekCost.toFixed(0)}`}
          </p>
          <p className="text-white/25 text-[10px] mt-1">Mon – today</p>
        </div>

        {/* Active Technicians */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-brand-green" />
            <p className="text-white/40 text-xs">Active This Week</p>
          </div>
          <p className="text-2xl font-bold text-brand-green">
            {loading ? <span className="inline-block w-12 h-6 bg-white/10 rounded animate-pulse" /> : kpis.activeTechs}
          </p>
          <p className="text-white/25 text-[10px] mt-1">technicians logged</p>
        </div>
      </div>

      {/* ── Needs Attention ────────────────────────────────────────────── */}
      <div className="mb-8">
        <h3 className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-3 flex items-center gap-2">
          <Zap size={12} />
          Needs Attention
        </h3>

        {loading ? (
          <div className="glass rounded-xl p-4 animate-pulse h-20" />
        ) : !hasAttentionItems ? (
          <div className="glass rounded-xl p-4 flex items-center gap-3 border border-brand-green/20 bg-brand-green/5">
            <CheckCircle2 size={20} className="text-brand-green flex-shrink-0" />
            <div>
              <p className="text-brand-green font-semibold text-sm">All clear</p>
              <p className="text-white/30 text-xs mt-0.5">No low stock or pending approvals.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">

            {/* Low Stock Items */}
            {attention.lowStock.length > 0 && (
              <div
                onClick={() => navigate('/stock')}
                className="glass rounded-xl p-4 flex items-start gap-3 border border-red-500/20 bg-red-500/[0.04] cursor-pointer hover:bg-red-500/[0.08] transition-all group"
              >
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-red-400 font-semibold text-sm">
                    {attention.lowStock.length} product{attention.lowStock.length !== 1 ? 's' : ''} low or out of stock
                  </p>
                  <p className="text-white/35 text-xs mt-0.5 truncate">
                    {attention.lowStock.map(p => p.name).join(' · ')}
                  </p>
                </div>
                <span className="text-red-400/50 group-hover:text-red-400 transition-colors text-sm flex-shrink-0">→</span>
              </div>
            )}

            {/* Pending Users */}
            {attention.pendingUsers > 0 && (
              <div
                onClick={() => navigate('/manager/users')}
                className="glass rounded-xl p-4 flex items-start gap-3 border border-blue-500/20 bg-blue-500/[0.04] cursor-pointer hover:bg-blue-500/[0.08] transition-all group"
              >
                <Users size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-blue-400 font-semibold text-sm">
                    {attention.pendingUsers} user{attention.pendingUsers !== 1 ? 's' : ''} awaiting approval
                  </p>
                  <p className="text-white/35 text-xs mt-0.5">Approve or reject in Users →</p>
                </div>
                <span className="text-blue-400/50 group-hover:text-blue-400 transition-colors text-sm flex-shrink-0">→</span>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => navigate('/manager/inventory')}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm transition-all"
        >
          📦 Manage Inventory
        </button>
        <button
          onClick={() => navigate('/manager/analytics')}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm transition-all"
        >
          📊 Analytics
        </button>
      </div>

      {/* ── Recent Activity (last 5) ────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white/50 text-xs font-semibold tracking-widest uppercase">Recent Activity</h3>
        <button
          onClick={() => navigate('/manager/history')}
          className="text-xs text-white/30 hover:text-brand-green transition-colors"
        >
          View all →
        </button>
      </div>
      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-white/5 animate-pulse bg-white/2" />
          ))
        ) : activity.length === 0 ? (
          <p className="text-white/25 text-sm text-center py-8">No recent transactions.</p>
        ) : activity.map((tx, i) => {
          const { name, tech, amount } = txLabel(tx)
          return (
            <div key={tx.id} className={`flex items-center gap-3 px-4 py-3 ${i < activity.length - 1 ? 'border-b border-white/5' : ''}`}>
              <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${getTypeBadge(tx.type)}`}>{tx.type}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{name}</p>
                <p className="text-white/30 text-xs">{format(new Date(tx.date + 'T12:00:00'), 'MMM d, yyyy')}{tech ? ` · ${tech}` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white/60 text-xs">{amount}</p>
                {tx.estimated_cost ? <p className="text-white/30 text-xs">${tx.estimated_cost.toFixed(2)}</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

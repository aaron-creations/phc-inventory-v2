import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { format } from 'date-fns'
import LowStockBanner from '../../../components/LowStockBanner'

import { MapPin, User, Clock } from 'lucide-react'

export default function ManagerDashboard() {
  const [stats, setStats] = useState({ products: 0, blends: 0, inventoryValue: 0, usageCost: 0 })
  const [activity, setActivity] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [activeJobs, setActiveJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const [prodRes, blendRes, txRes, jobsRes] = await Promise.all([
        supabase.from('products').select('id, name, containers_in_stock, cost_per_container, low_stock_threshold'),
        supabase.from('blends').select('id', { count: 'exact' }),
        supabase.from('transactions').select('*, products(name), blends(name), technicians(first_name, last_initial)').order('date', { ascending: false }).limit(20),
        supabase.from('crm_jobs').select('*, crm_customers(first_name, last_name), crm_properties(nickname, address_line1), technicians(first_name, last_initial)').eq('status', 'in_progress')
      ])

      const products = prodRes.data || []
      const inventoryValue = products.reduce((sum, p) =>
        sum + (p.containers_in_stock * (p.cost_per_container || 0)), 0)

      const transactions = txRes.data || []
      const usageCost = transactions.reduce((sum, t) => sum + (t.estimated_cost || 0), 0)

      setStats({
        products: products.length,
        blends: blendRes.count || 0,
        inventoryValue,
        usageCost,
      })
      setAllProducts(products)
      setActivity(transactions)
      setActiveJobs(jobsRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

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
    const amount = tx.type === 'RESTOCK'
      ? `+${tx.amount} containers`
      : `${tx.amount} ${tx.unit}`
    return { name, tech, amount }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-white font-bold text-xl mb-4">Dashboard</h2>

      {/* Low-Stock Alert Banner */}
      {!loading && <LowStockBanner products={allProducts} linkTo="/stock" />}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Products', value: stats.products,                           color: 'text-white' },
          { label: 'Active Blends',  value: stats.blends,                              color: 'text-white' },
          { label: 'Inventory Value',value: `$${stats.inventoryValue.toFixed(2)}`,     color: 'text-brand-green' },
          { label: 'Usage Cost',     value: `$${stats.usageCost.toFixed(2)}`,          color: 'text-brand-orange' },
        ].map(kpi => (
          <div key={kpi.label} className="glass rounded-xl p-4">
            <p className="text-white/40 text-xs mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>
              {loading ? <span className="inline-block w-16 h-6 bg-white/10 rounded animate-pulse" /> : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Active Jobs Section */}
      {(!loading && activeJobs.length > 0) && (
        <div className="mb-8">
          <h3 className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            Active Jobs ({activeJobs.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeJobs.map(job => (
              <div key={job.id} className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-bold">{job.service_type}</h4>
                  <div className="bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">In Progress</div>
                </div>
                
                <div className="space-y-1.5 mb-3">
                  {job.crm_customers && (
                    <div className="flex items-center gap-2 text-white/70 text-sm">
                      <User size={14} className="text-white/30" />
                      {job.crm_customers.first_name} {job.crm_customers.last_name}
                    </div>
                  )}
                  {job.crm_properties && (
                    <div className="flex items-center gap-2 text-white/70 text-sm">
                      <MapPin size={14} className="text-white/30" />
                      {job.crm_properties.nickname || job.crm_properties.address_line1}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 pt-3 border-t border-orange-500/20 text-sm">
                  <Clock size={14} className="text-orange-400" />
                  <span className="text-white/50">Tech:</span>
                  <span className="text-white font-medium">{job.technicians ? `${job.technicians.first_name} ${job.technicians.last_initial}.` : 'Unknown'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => navigate('/restock')}
          className="px-4 py-2 rounded-lg bg-brand-green/10 hover:bg-brand-green/20 border border-brand-green/20 text-brand-green text-sm transition-all"
        >
          + Log Restock
        </button>
        <button
          onClick={() => navigate('/manager/inventory')}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm transition-all"
        >
          📦 Manage Inventory
        </button>
      </div>

      {/* Recent Activity */}
      <h3 className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-3">Recent Activity</h3>
      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-white/5 animate-pulse bg-white/2" />
          ))
        ) : activity.map((tx, i) => {
          const { name, tech, amount } = txLabel(tx)
          return (
            <div key={tx.id} className={`flex items-center gap-3 px-4 py-3 ${i < activity.length - 1 ? 'border-b border-white/5' : ''}`}>
              <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${getTypeBadge(tx.type)}`}>{tx.type}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{name}</p>
                <p className="text-white/30 text-xs">{format(new Date(tx.date), 'MMM d, yyyy')}{tech ? ` · ${tech}` : ''}</p>
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

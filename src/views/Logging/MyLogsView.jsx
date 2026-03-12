import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'
import { Edit2, Trash2, X, Save } from 'lucide-react'

export default function MyLogsView() {
  const [logs, setLogs] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { profile } = useAuth()

  const techId = profile?.technicians?.id
  const techName = profile?.technicians?.first_name

  const [editingLogId, setEditingLogId] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!techId) {
      setLoading(false)
      return
    }
    loadData()
  }, [techId])

  async function loadData() {
    setLoading(true)
    const [transRes, prodRes] = await Promise.all([
      supabase
        .from('transactions')
        .select(`
          *,
          products (*),
          blends (*)
        `)
        .eq('technician_id', techId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('products').select('*')
    ])
    
    setLogs(transRes.data || [])
    setProducts(prodRes.data || [])
    setLoading(false)
  }

  // --- Helpers for Stock Math ---
  function calculateContainers(amount, product) {
    if (!product) return 0
    return product.unit_type === 'direct'
      ? parseFloat(amount) / (product.container_size * 473.176) // mL to pints
      : parseFloat(amount) / product.container_size
  }

  function recalculateCost(amount, product) {
    if (!product || !product.cost_per_container) return null
    return (parseFloat(amount) / (product.container_size * 128)) * product.cost_per_container // based on gal
  }

  // --- Actions ---
  async function handleDelete(log) {
    if (log.type === 'BLEND') {
      alert("Blend transactions cannot be deleted directly because they affect multiple products.")
      return
    }
    if (!window.confirm("Are you sure you want to delete this log? The inventory will be added back.")) return

    const product = products.find(p => p.id === log.product_id)
    if (product) {
      const containersToAddBack = calculateContainers(log.amount, product)
      await supabase
        .from('products')
        .update({ containers_in_stock: product.containers_in_stock + containersToAddBack })
        .eq('id', product.id)
    }

    const { error } = await supabase.from('transactions').delete().eq('id', log.id)
    if (!error) {
      setLogs(logs.filter(l => l.id !== log.id))
      // Refresh products implicitly for next edit/delete
      const { data } = await supabase.from('products').select('*')
      if (data) setProducts(data)
    } else {
      alert(`Error deleting log: ${error.message}`)
    }
  }

  function startEdit(log) {
    if (log.type === 'BLEND') {
      alert("Blend transactions cannot be edited directly. Please speak to your manager to adjust inventory.")
      return
    }
    setEditingLogId(log.id)
    setEditAmount(log.amount.toString())
  }

  function cancelEdit() {
    setEditingLogId(null)
    setEditAmount('')
  }

  async function saveEdit(log) {
    const newAmount = parseFloat(editAmount)
    if (isNaN(newAmount) || newAmount < 0) return

    setSubmitting(true)
    const product = products.find(p => p.id === log.product_id)
    
    if (product) {
      // 1. Add back the old amount
      const oldContainers = calculateContainers(log.amount, product)
      // 2. Subtract the new amount
      const newContainers = calculateContainers(newAmount, product)
      
      const netChange = oldContainers - newContainers // Positive means adding back to stock, negative means subtracting
      const updatedStock = product.containers_in_stock + netChange

      // Calculate new cost
      const newCost = recalculateCost(newAmount, product)

      // Update product stock
      await supabase
        .from('products')
        .update({ containers_in_stock: Math.max(0, updatedStock) })
        .eq('id', product.id)

      // Update transaction
      const payload = { 
        amount: newAmount, 
        estimated_cost: newCost ? parseFloat(newCost.toFixed(2)) : null 
      }
      
      const { error, data } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', log.id)
        .select(`*, products(*), blends(*)`)
        .single()

      if (!error && data) {
        setLogs(logs.map(l => l.id === log.id ? data : l))
        // Refresh products
        const { data: pData } = await supabase.from('products').select('*')
        if (pData) setProducts(pData)
      } else if (error) {
        alert(`Error updating log: ${error.message}`)
      }
    }
    
    setSubmitting(false)
    cancelEdit()
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-screen bg-forest-950">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-brand-green animate-spin"></div>
      </div>
    )
  }

  if (!techId) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center p-8 text-center text-white/50">
        <p>You must be linked to a Technician profile to view logs.</p>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5 transition-colors text-white">Back to Dashboard</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-forest-950 max-w-lg mx-auto px-4 py-8 pb-16">
      {/* Header */}
      <div className="flex items-center mb-8 sticky top-0 bg-forest-950/90 backdrop-blur pb-4 z-10 pt-2">
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white transition-colors text-sm flex-1 text-left">← Back</button>
        <h1 className="text-white font-bold text-lg flex-[2] text-center truncate px-2">
          {techName}'s Logs
        </h1>
        <div className="flex-1"></div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center p-8 bg-black/20 rounded-xl border border-white/5">
          <p className="text-white/40 text-sm">No usage logs found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map(log => {
            const isEditing = editingLogId === log.id
            const title = log.type === 'BLEND' ? log.blends?.name : log.products?.name
            const badgeColor = log.type === 'BLEND' ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/20' : 'bg-brand-green/10 text-brand-green border-brand-green/20'

            return (
              <div key={log.id} className="p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                     <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                      {log.type}
                     </span>
                     <span className="text-white/50 text-xs font-medium">
                       {new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}
                     </span>
                  </div>
                  
                  {/* Action Buttons */}
                   <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
                      <button onClick={() => startEdit(log)} className="text-white/30 hover:text-white transition-colors" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(log)} className="text-white/30 hover:text-red-400 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                </div>

                <h3 className="text-white font-bold leading-tight text-lg mb-2">{title}</h3>
                
                {isEditing ? (
                  <div className="mt-3 pt-3 border-t border-white/5 flex gap-2 items-center">
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      value={editAmount} 
                      onChange={e => setEditAmount(e.target.value)} 
                      className="flex-1 bg-black/40 border border-brand-green/30 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-brand-green/60"
                      autoFocus
                    />
                    <span className="text-white/40 text-xs w-12">{log.unit}</span>
                    <button 
                      onClick={() => saveEdit(log)} 
                      disabled={submitting}
                      className="p-1.5 bg-brand-green text-forest-950 rounded hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      <Save size={16} />
                    </button>
                    <button 
                      onClick={cancelEdit} 
                      className="p-1.5 bg-white/10 text-white/50 rounded hover:bg-white/20 hover:text-white transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-white/5 flex gap-x-6 gap-y-2 text-[11px] uppercase tracking-wider font-semibold">
                    <div className="text-white/30">
                      Amount: <span className="text-brand-green">{log.amount} {log.unit}</span>
                    </div>
                    {typeof log.estimated_cost === 'number' && (
                      <div className="text-white/30">
                        Cost: <span className="text-white/70">${log.estimated_cost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

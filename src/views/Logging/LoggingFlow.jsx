import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'

/* ── Unit conversion helper ─────────────────────────────────────
   Converts a container (size × unit) to millilitres.
   This is the single source of truth for direct-use stock math.
   Supported container_unit values from DB: gal, pint, qt, liter, oz
   ──────────────────────────────────────────────────────────────── */
const ML_PER_UNIT = {
  gal:     3785.41,
  pint:     473.176,
  qt:       946.353,
  liter:   1000,
  oz:        29.5735,
  'fl oz':   29.5735,
}

function containerSizeToMl(containerSize, containerUnit) {
  const factor = ML_PER_UNIT[containerUnit?.toLowerCase()] ?? 473.176 // fallback: pint
  return containerSize * factor
}

export default function LoggingFlow() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()

  // The technician record is embedded in the profile via the FK join
  const linkedTech = profile?.technicians

  const initialDate = location.state?.selectedDate || format(new Date(), 'yyyy-MM-dd')
  const initialJobId = location.state?.selectedJobId || ''

  const [products, setProducts] = useState([])
  const [blends, setBlends] = useState([])
  const [mode, setMode] = useState('single') // 'single' | 'blend'
  const [logs, setLogs] = useState([{ productId: '', blendId: '', amount: '', date: initialDate }])
  const [blendComponents, setBlendComponents] = useState({}) // blendId -> components[]
  const [jobs, setJobs] = useState([])
  const [selectedJobId, setSelectedJobId] = useState(initialJobId)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [completeJobPrompt, setCompleteJobPrompt] = useState(null) // jobId to prompt completion for

  useEffect(() => {
    async function load() {
      const [prodRes, blendRes, jobsRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('blends').select('*, blend_components(*, products(*))').order('name'),
        linkedTech?.id ? supabase.from('crm_jobs')
          .select('id, service_type, scheduled_date, status, crm_customers(last_name), crm_properties(address_line1)')
          .eq('technician_id', linkedTech.id)
          .in('status', ['scheduled', 'in_progress'])
          .order('scheduled_date', { ascending: true }) : Promise.resolve({ data: [] })
      ])
      setProducts(prodRes.data || [])
      const blendsData = blendRes.data || []
      setBlends(blendsData)
      const compMap = {}
      blendsData.forEach(b => { compMap[b.id] = b.blend_components })
      setBlendComponents(compMap)
      setJobs(jobsRes.data || [])
    }
    if (linkedTech?.id) {
      load()
    }
  }, [linkedTech?.id])

  function updateLog(i, field, value) {
    setLogs(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  function addLog() {
    setLogs(prev => [...prev, { productId: '', blendId: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') }])
  }

  function removeLog(i) {
    setLogs(prev => prev.filter((_, idx) => idx !== i))
  }

  function getProduct(id) { return products.find(p => p.id === id) }

  async function handleSubmit() {
    if (submitting || !linkedTech) return
    setSubmitError(null)

    // --- Validation Phase ---
    for (const log of logs) {
      const amount = parseFloat(log.amount)
      if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount greater than 0.")
        return
      }

      if (mode === 'single' && log.productId) {
        const product = getProduct(log.productId)
        if (product) {
          const amountInContainers = product.unit_type === 'direct'
            ? amount / containerSizeToMl(product.container_size, product.container_unit)
            : amount / product.container_size

          if (amountInContainers > product.containers_in_stock + 0.0001) {
            alert(`Cannot submit: The amount for ${product.name} exceeds available inventory.`)
            return
          }
        }
      } else if (mode === 'blend' && log.blendId) {
        const components = blendComponents[log.blendId] || []
        for (const comp of components) {
          const product = comp.products
          if (!product) continue
          const flOzUsed = (amount / 100) * comp.rate_fl_oz_per_100_gal
          const containersUsed = flOzUsed / (product.container_size * 128)

          if (containersUsed > product.containers_in_stock + 0.0001) {
            alert(`Cannot submit blend: Not enough stock of ${product.name}.`)
            return
          }
        }
      }
    }

    setSubmitting(true)
    try {
      for (const log of logs) {
        if (mode === 'single' && log.productId && log.amount) {
          const product = getProduct(log.productId)

          // Use consistent unit math for cost (convert ml capacity → fl oz, then ratio to cost)
          const containerMl = containerSizeToMl(product.container_size, product.container_unit)
          const containerFlOz = containerMl / ML_PER_UNIT['oz']
          const cost = product?.cost_per_container && containerFlOz > 0
            ? (parseFloat(log.amount) / containerFlOz) * product.cost_per_container
            : null

          await supabase.from('transactions').insert({
            type: 'USAGE',
            technician_id: linkedTech.id,
            product_id: log.productId,
            amount: parseFloat(log.amount),
            unit: product?.unit_type === 'direct' ? 'mL' : 'gal mix',
            estimated_cost: cost ? parseFloat(cost.toFixed(2)) : null,
            date: log.date,
            crm_job_id: selectedJobId || null,
          })

          // Decrement stock using correct container unit
          const currentProduct = products.find(p => p.id === log.productId)
          if (currentProduct) {
            const amountInContainers = currentProduct.unit_type === 'direct'
              ? parseFloat(log.amount) / containerSizeToMl(currentProduct.container_size, currentProduct.container_unit)
              : parseFloat(log.amount) / currentProduct.container_size
            await supabase
              .from('products')
              .update({ containers_in_stock: Math.max(0, currentProduct.containers_in_stock - amountInContainers) })
              .eq('id', log.productId)
          }

        } else if (mode === 'blend' && log.blendId && log.amount) {
          const gallons = parseFloat(log.amount)
          const components = blendComponents[log.blendId] || []

          // Insert BLEND transaction
          await supabase.from('transactions').insert({
            type: 'BLEND',
            technician_id: linkedTech.id,
            blend_id: log.blendId,
            amount: gallons,
            unit: 'gal mix',
            date: log.date,
            crm_job_id: selectedJobId || null,
          })

          // Decrement each component (blend components use fl oz rates → gallon containers)
          for (const comp of components) {
            const flOzUsed = (gallons / 100) * comp.rate_fl_oz_per_100_gal
            const product = comp.products
            if (!product) continue
            const containerSizeFlOz = product.container_size * 128
            const containersUsed = flOzUsed / containerSizeFlOz
            await supabase
              .from('products')
              .update({ containers_in_stock: Math.max(0, product.containers_in_stock - containersUsed) })
              .eq('id', product.id)
          }
        }
      }
      if (selectedJobId) {
        setCompleteJobPrompt(selectedJobId)
      } else {
        setSuccess(true)
        setTimeout(() => navigate('/'), 1500)
      }
    } catch (err) {
      console.error('Log submit failed:', err)
      setSubmitError(err?.message || 'Something went wrong submitting your log. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCompleteJob() {
    if (completeJobPrompt) {
      await supabase.from('crm_jobs').update({ status: 'completed' }).eq('id', completeJobPrompt)
    }
    navigate('/')
  }

  const canSubmit = logs.every(l => {
    const amt = parseFloat(l.amount)
    return mode === 'single' ? (l.productId && amt > 0) : (l.blendId && amt > 0)
  })

  if (!linkedTech) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center px-4">
        <div className="text-center glass rounded-2xl p-8 max-w-sm w-full">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-white font-semibold text-lg mb-2">No Technician Linked</p>
          <p className="text-white/40 text-sm mb-6">
            Your account isn't linked to a technician profile yet. Ask your manager to set this up in the Team section.
          </p>
          <button
            onClick={() => navigate('/hub')}
            className="text-white/60 hover:text-white text-sm transition-colors"
          >
            ← Back to Hub
          </button>
        </div>
      </div>
    )
  }

  if (completeJobPrompt) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-white font-bold text-xl mb-1">Log submitted!</p>
          <p className="text-white/50 text-sm mb-6">Is this job finished for today?</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCompleteJob}
              className="w-full py-3 rounded-xl bg-brand-green text-forest-950 font-bold text-sm transition-all hover:bg-brand-green/90"
            >
              ✓ Yes, Mark Job Complete
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 font-medium text-sm transition-all"
            >
              Not Yet — Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-white font-semibold text-lg">Log submitted!</p>
          <p className="text-white/40 text-sm mt-1">Returning to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-forest-950 max-w-lg mx-auto px-4 py-8 pb-16">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button onClick={() => navigate('/hub')} className="text-white/50 hover:text-white transition-colors text-sm flex-1 text-left">← Back</button>
        <h1 className="text-white font-bold text-lg flex-[2] justify-center truncate px-2">
          {linkedTech.first_name} {linkedTech.last_initial}. — Log
        </h1>
        <div className="flex-1 flex justify-end gap-3">
          <button onClick={() => navigate('/mix-rates')} className="text-white/50 hover:text-white transition-colors" title="Mix Rates">📋</button>
          <button onClick={() => navigate('/hub')} className="text-white/50 hover:text-white transition-colors" title="Hub">🏠</button>
        </div>
      </div>

      {/* Submit Error Toast */}
      {submitError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{submitError}</span>
          <button onClick={() => setSubmitError(null)} className="ml-auto text-red-400/60 hover:text-red-300 shrink-0">✕</button>
        </div>
      )}

      {/* Link to Job (Optional) */}
      <div className="mb-6 px-1">
        <label className="text-white/40 text-xs mb-1.5 block font-bold uppercase tracking-wider">Link to Job (Optional)</label>
        <select
          value={selectedJobId}
          onChange={e => setSelectedJobId(e.target.value)}
          className="w-full bg-forest-800 border border-white/10 rounded-lg px-3 py-3 text-white text-sm outline-none focus:border-brand-green/50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%23ffffff%22%20stroke-opacity%3D%220.5%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] bg-[length:1.5em]"
        >
          <option value="">No Active Job</option>
          {jobs.map(j => {
            const dateStr = j.scheduled_date ? new Date(j.scheduled_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unscheduled'
            const statusIndicator = j.status === 'in_progress' ? '🟢 ' : '🗓️ '
            const label = `${statusIndicator}${j.service_type} - ${j.crm_customers?.last_name}`
            return <option key={j.id} value={j.id}>{label} ({dateStr})</option>
          })}
        </select>
      </div>

      {/* Mode Toggle */}
      <div className="flex glass rounded-xl p-1 mb-6">
        {[['single', '🧪 Single Product'], ['blend', '🧬 Blend']].map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === m ? 'bg-brand-green text-forest-950' : 'text-white/50 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Log Entries */}
      <div className="flex flex-col gap-4 mb-4">
        {logs.map((log, i) => (
          <LogEntry
            key={i}
            log={log}
            index={i}
            mode={mode}
            products={products}
            blends={blends}
            blendComponents={blendComponents}
            onUpdate={updateLog}
            onRemove={logs.length > 1 ? () => removeLog(i) : null}
          />
        ))}
      </div>

      {/* Add Another */}
      <button
        onClick={addLog}
        className="w-full py-3 rounded-xl border border-dashed border-white/20 text-white/40 hover:text-white/60 hover:border-white/40 text-sm transition-all mb-6"
      >
        + Add Another
      </button>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full py-4 rounded-xl bg-brand-green text-forest-950 font-bold text-base transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-brand-green/90"
      >
        {submitting ? 'Submitting...' : 'Submit Log'}
      </button>
    </div>
  )
}

function LogEntry({ log, index, mode, products, blends, blendComponents, onUpdate, onRemove }) {
  const selectedProduct = products.find(p => p.id === log.productId)
  const selectedBlend = blends.find(b => b.id === log.blendId)
  const components = blendComponents[log.blendId] || []

  return (
    <div className="glass rounded-xl p-4 relative">
      {onRemove && (
        <button onClick={onRemove} className="absolute top-3 right-3 text-white/20 hover:text-red-400 text-xs transition-colors">✕</button>
      )}

      {/* Date */}
      <label className="text-white/40 text-xs mb-1 block">Date</label>
      <input
        type="date"
        value={log.date}
        onChange={e => onUpdate(index, 'date', e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3 outline-none focus:border-brand-green/50"
      />

      {mode === 'single' ? (
        <>
          {/* Product Dropdown */}
          <label className="text-white/40 text-xs mb-1 block">Product</label>
          <select
            value={log.productId}
            onChange={e => onUpdate(index, 'productId', e.target.value)}
            className="w-full bg-forest-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3 outline-none focus:border-brand-green/50"
          >
            <option value="">Select a product...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Mix rate helper */}
          {selectedProduct?.unit_type === 'mixed' && (
            <p className="text-brand-green/70 text-xs mb-2 font-mono">Mix rate: {selectedProduct.mix_rate}</p>
          )}

          {/* Amount Input */}
          {selectedProduct && (
            <>
              <label className="text-white/40 text-xs mb-1 block">
                {selectedProduct.unit_type === 'direct' ? 'Amount (mL)' : 'Gallons of Mix Applied'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={log.amount}
                onChange={e => onUpdate(index, 'amount', e.target.value)}
                placeholder={selectedProduct.unit_type === 'direct' ? 'e.g. 20' : 'e.g. 100'}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50"
              />
            </>
          )}
        </>
      ) : (
        <>
          {/* Blend Dropdown */}
          <label className="text-white/40 text-xs mb-1 block">Blend</label>
          <select
            value={log.blendId}
            onChange={e => onUpdate(index, 'blendId', e.target.value)}
            className="w-full bg-forest-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3 outline-none focus:border-brand-green/50"
          >
            <option value="">Select a blend...</option>
            {blends.map(b => (
              <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>
            ))}
          </select>

          {/* Blend recipe summary */}
          {selectedBlend && components.length > 0 && (
            <div className="glass rounded-lg p-3 mb-3">
              <p className="text-white/40 text-xs mb-2 font-semibold">Recipe (per 100 gal)</p>
              {components.map(c => (
                <div key={c.id} className="flex justify-between">
                  <span className="text-white/60 text-xs">{c.products?.name}</span>
                  <span className="text-white/40 text-xs font-mono">{c.rate_fl_oz_per_100_gal} fl oz</span>
                </div>
              ))}
            </div>
          )}

          {/* Gallons input */}
          {selectedBlend && (
            <>
              <label className="text-white/40 text-xs mb-1 block">Gallons of Mix Applied</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={log.amount}
                onChange={e => onUpdate(index, 'amount', e.target.value)}
                placeholder="e.g. 100"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-green/50"
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

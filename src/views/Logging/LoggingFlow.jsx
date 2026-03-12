import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { format } from 'date-fns'

export default function LoggingFlow() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Passed state from Dashboard or MyJobs
  const preSelectedJobId = location.state?.selectedJobId || ''
  const initialDate = location.state?.selectedDate || format(new Date(), 'yyyy-MM-dd')

  const [date, setDate] = useState(initialDate)
  const [techId, setTechId] = useState('')
  const [jobId, setJobId] = useState(preSelectedJobId)
  
  const [mode, setMode] = useState('single') // 'single' | 'blend'
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedBlendId, setSelectedBlendId] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('') // gal, oz, lb
  
  const [technicians, setTechnicians] = useState([])
  const [products, setProducts] = useState([])
  const [blends, setBlends] = useState([])
  const [jobs, setJobs] = useState([]) // For the "Link to Job" dropdown

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadData() {
      const [techs, prods, blds] = await Promise.all([
        supabase.from('technicians').select('id, first_name, last_initial').order('first_name'),
        supabase.from('products').select('id, name, container_unit, unit_type, containers_in_stock, cost_per_container, container_size').order('name'),
        supabase.from('blends').select('id, name').order('name')
      ])
      
      const techData = techs.data || []
      setTechnicians(techData)
      setProducts(prods.data || [])
      setBlends(blds.data || [])
      
      // Auto-select technician if there's only one active in the system
      if (techData.length === 1 && !techId) {
        setTechId(techData[0].id)
      }
    }
    loadData()
  }, [])

  // Load jobs when technician or date changes
  useEffect(() => {
    async function loadJobs() {
      if (!techId) {
        setJobs([])
        return
      }
      
      const { data } = await supabase
        .from('crm_jobs')
        .select(`
          id,
          service_type,
          scheduled_date,
          status,
          crm_properties ( address_line1, nickname ),
          crm_customers ( last_name )
        `)
        .eq('technician_id', techId)
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_date')
        
      setJobs(data || [])
      
      // If preSelectedJobId exists but isn't in this list (maybe marked complete?), you might want to fetch it explicitly.
      // But for simplicity, we assume it's in the list if passed from dash.
    }
    loadJobs()
  }, [techId])

  // Reset dependent fields when mode changes
  useEffect(() => {
    setAmount('')
    setUnit('')
    setSelectedProductId('')
    setSelectedBlendId('')
    setErrorMsg('')
  }, [mode])

  // Auto-set unit when product is selected
  useEffect(() => {
    if (mode === 'single' && selectedProductId) {
      const prod = products.find(p => p.id === selectedProductId)
      if (prod) {
        setUnit(prod.container_unit)
      }
    } else if (mode === 'blend') {
      setUnit('gal') // Blends are always applied in gallons of mix
    }
  }, [selectedProductId, mode, products])


  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')

    if (!techId) {
      setErrorMsg("Please select a technician.")
      setSubmitting(false); return
    }

    try {
      const numericAmount = parseFloat(amount)
      let costEstimate = 0

      // -------- SINGLE PRODUCT LOGGING --------
      if (mode === 'single') {
        const prod = products.find(p => p.id === selectedProductId)
        
        // Calculate estimated cost
        if (prod.cost_per_container && prod.container_size) {
          // Rule: amount is usually entered in the container's native unit here.
          // For direct application, if they enter 1, and unit is gal, and container_size is 1 gal.
          // Let's do simple straight math: (Input Amount / Container Size) * Cost Per Container
          costEstimate = (numericAmount / prod.container_size) * prod.cost_per_container
        }

        // 1. Insert Transaction
        const { error: txError } = await supabase.from('transactions').insert({
          type: 'USAGE',
          technician_id: techId,
          product_id: selectedProductId,
          job_id: jobId || null,
          amount: numericAmount,
          unit: unit,
          estimated_cost: costEstimate > 0 ? parseFloat(costEstimate.toFixed(2)) : null,
          date: date
        })
        if (txError) throw txError

        // 2. Decrement Stock
        const containersUsed = numericAmount / prod.container_size
        const newStock = Math.max(0, prod.containers_in_stock - containersUsed)
        
        const { error: stockError } = await supabase
          .from('products')
          .update({ containers_in_stock: Number(newStock.toFixed(2)) })
          .eq('id', selectedProductId)
          
        if (stockError) throw stockError

      // -------- BLEND LOGGING --------
      } else {
        const { data: components, error: compError } = await supabase
          .from('blend_components')
          .select(`
            product_id,
            fl_oz_per_100_gal,
            products ( container_unit, container_size, containers_in_stock, cost_per_container )
          `)
          .eq('blend_id', selectedBlendId)
          
        if (compError) throw compError

        // Insert primary blend transaction
        const { error: txError } = await supabase.from('transactions').insert({
          type: 'BLEND',
          technician_id: techId,
          blend_id: selectedBlendId,
          job_id: jobId || null,
          amount: numericAmount,
          unit: 'gal',
          date: date
        })
        if (txError) throw txError

        // Process each component in the blend
        // E.g. Apply 50 gal. Formula = 50 fl oz / 100 gal. Thus, 25 fl oz used.
        const multiplier = numericAmount / 100

        for (let comp of components) {
          const flOzUsed = comp.fl_oz_per_100_gal * multiplier
          
          let flOzContainerSize = comp.products.container_size
          if (comp.products.container_unit === 'gal') flOzContainerSize *= 128
          if (comp.products.container_unit === 'qt')  flOzContainerSize *= 32
          if (comp.products.container_unit === 'pint') flOzContainerSize *= 16

          const containersUsed = flOzUsed / flOzContainerSize
          const updatedStock = Math.max(0, comp.products.containers_in_stock - containersUsed)

          await supabase.from('products')
            .update({ containers_in_stock: Number(updatedStock.toFixed(2)) })
            .eq('id', comp.product_id)
        }
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        navigate('/') // Go back to dashboard on success
      }, 1500)

    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'An error occurred while logging.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-forest-950 p-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <button onClick={() => navigate(-1)} className="text-white/50 text-2xl px-2">×</button>
        <h1 className="text-white font-bold text-lg">Log Material</h1>
        <div className="w-8"></div>
      </div>

      {success ? (
        <div className="flex flex-col items-center justify-center py-20 animate-in zoom-in duration-300">
          <div className="w-24 h-24 bg-brand-green/20 text-brand-green rounded-full flex items-center justify-center text-5xl mb-4">
            ✓
          </div>
          <h2 className="text-white font-bold text-xl">Logged Successfully</h2>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-6">
          
          {/* Mode Toggle */}
          <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${mode === 'single' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40'}`}
            >
              Single Product
            </button>
            <button
              type="button"
              onClick={() => setMode('blend')}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${mode === 'blend' ? 'bg-brand-blue/20 text-brand-blue shadow-sm' : 'text-white/40'}`}
            >
              Tank Blend
            </button>
          </div>

          <div className="glass p-5 rounded-2xl border border-white/5 space-y-5">
            {/* Meta row: Date + Tech */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Date</label>
                <input
                  type="date"
                  required
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-brand-green text-sm"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Technician</label>
                <select
                  required
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-brand-green text-sm appearance-none"
                  value={techId}
                  onChange={e => setTechId(e.target.value)}
                >
                  <option value="" disabled>Select...</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_initial}.</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional Job Link */}
            {techId && jobs.length > 0 && (
              <div className="pt-2 animate-in slide-in-from-top-2">
                <label className="flex items-center gap-2 text-brand-orange border-brand-orange/20 text-xs font-semibold uppercase tracking-wider mb-2">
                  <span>📍</span> Link to Job? (Optional)
                </label>
                <select
                  className="w-full bg-brand-orange/5 border border-brand-orange/20 rounded-xl px-4 py-3 text-brand-orange focus:outline-none focus:border-brand-orange text-sm appearance-none"
                  value={jobId}
                  onChange={e => setJobId(e.target.value)}
                >
                  <option value="">No specific job</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id} className="text-black">
                      {j.service_type} - {j.crm_customers?.last_name} ({j.crm_properties?.nickname || j.crm_properties?.address_line1})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="border-t border-white/5 my-4"></div>

            {/* Selection */}
            {mode === 'single' ? (
               <div>
                <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Product Applied</label>
                <select
                  required
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-brand-green text-base appearance-none"
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                >
                  <option value="" disabled>Select Product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-brand-blue/70 text-xs font-semibold uppercase tracking-wider mb-2">Blend Applied</label>
                <select
                  required
                  className="w-full bg-brand-blue/5 border border-brand-blue/20 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-brand-blue text-base appearance-none"
                  value={selectedBlendId}
                  onChange={e => setSelectedBlendId(e.target.value)}
                >
                  <option value="" disabled>Select Blend Recipe</option>
                  {blends.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 text-white text-lg font-bold focus:outline-none focus:border-brand-green"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Unit</label>
                <input
                  type="text"
                  readOnly
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-4 text-white/50 text-lg font-bold cursor-not-allowed"
                  value={unit}
                />
              </div>
            </div>
            
            {mode === 'blend' && amount && (
              <p className="text-brand-blue xl text-[11px] leading-tight opacity-70">
                Logging {amount} gallons of mix will automatically decrement stock for all associated component products based on their set rates per 100 gallons.
              </p>
            )}

          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium text-center">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-4.5 rounded-xl font-bold text-lg uppercase tracking-wider transition-all
              ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98] shadow-lg'}
              ${mode === 'single' ? 'bg-brand-green text-forest-950 shadow-brand-green/20' : 'bg-brand-blue text-black shadow-brand-blue/20'}
            `}
          >
            {submitting ? 'Logging...' : 'Submit Log'}
          </button>
        </form>
      )}
    </div>
  )
}

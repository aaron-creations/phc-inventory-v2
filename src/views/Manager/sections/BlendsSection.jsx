import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function BlendsSection() {
  const [blends, setBlends] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({}) // track which blend cards are open

  // Components edit states
  const [editingBlendId, setEditingBlendId] = useState(null)
  const [products, setProducts] = useState([]) // For the dropdown

  // Form states
  const [form, setForm] = useState({ product_id: '', amount_fl_oz_per_100_gal: '' })

  const loadData = async () => {
    // Fetch blends with their nested components and related products
    const { data: bData } = await supabase
      .from('blends')
      .select(`
        id, name,
        blend_components (
          id, amount_fl_oz_per_100_gal,
          products ( id, name )
        )
      `)
      .order('name')
    setBlends(bData || [])

    // Fetch products for the dropdown
    const { data: pData } = await supabase.from('products').select('id, name').order('name')
    setProducts(pData || [])

    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // ─── Component CRUD ─────────────────────────────────────
  async function handleAddComponent() {
    if (!form.product_id || !form.amount_fl_oz_per_100_gal) return
    await supabase.from('blend_components').insert([{
      blend_id: editingBlendId,
      product_id: form.product_id,
      amount_fl_oz_per_100_gal: parseFloat(form.amount_fl_oz_per_100_gal)
    }])
    setForm({ product_id: '', amount_fl_oz_per_100_gal: '' })
    loadData()
  }

  async function handleDeleteComponent(id) {
    if (!confirm('Remove this product from the blend?')) return
    await supabase.from('blend_components').delete().eq('id', id)
    loadData()
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-white font-bold text-xl mb-6">Blend Recipes</h2>

      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="h-16 rounded-xl bg-white/5 border border-white/5" />
          <div className="h-16 rounded-xl bg-white/5 border border-white/5" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {blends.map(blend => (
            <div key={blend.id} className="glass rounded-xl overflow-x-auto mb-6">
              <div
                className="flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-white/5 transition-all"
                onClick={() => setExpanded(e => ({ ...e, [blend.id]: !e[blend.id] }))}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center text-xl">🧬</div>
                  <h3 className="text-white font-semibold">{blend.name}</h3>
                </div>
                <div className="text-white/30 text-xs flex items-center gap-3">
                  <span>{blend.blend_components?.length || 0} liquid products</span>
                  <span className={`transform transition-transform ${expanded[blend.id] ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </div>

              {expanded[blend.id] && (
                <div className="border-t border-white/5 bg-black/20 p-4">
                  
                  {/* Component Table */}
                  <div className="bg-forest-900 border border-white/5 rounded-lg overflow-hidden mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/5">
                          <th className="text-left text-white/40 font-medium px-4 py-2">Product Name</th>
                          <th className="text-right text-white/40 font-medium px-4 py-2">Rate (fl oz / 100 gal)</th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {blend.blend_components?.length === 0 ? (
                          <tr><td colSpan="3" className="px-4 py-4 text-center text-white/30 text-xs italic">No products added yet.</td></tr>
                        ) : (
                          blend.blend_components?.map(comp => (
                            <tr key={comp.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                              <td className="px-4 py-2.5 text-white/80">{comp.products?.name}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-brand-orange">{comp.amount_fl_oz_per_100_gal} fl oz</td>
                              <td className="px-4 py-2.5 text-right">
                                {editingBlendId === blend.id && (
                                  <button onClick={() => handleDeleteComponent(comp.id)} className="text-white/20 hover:text-red-400 transition-colors">✕</button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Edit Toggle / Add Component Form */}
                  <div className="flex justify-end">
                    {editingBlendId === blend.id ? (
                      <div className="w-full flex flex-wrap gap-2 items-center bg-white/5 p-3 rounded-lg border border-brand-orange/20">
                        <select
                          className="flex-1 bg-forest-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none"
                          value={form.product_id}
                          onChange={e => setForm({ ...form, product_id: e.target.value })}
                        >
                          <option value="">-- Select Product --</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="fl oz rate"
                            className="w-24 bg-forest-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none"
                            value={form.amount_fl_oz_per_100_gal}
                            onChange={e => setForm({ ...form, amount_fl_oz_per_100_gal: e.target.value })}
                          />
                          <button
                            onClick={handleAddComponent}
                            className="bg-brand-orange/20 hover:bg-brand-orange text-brand-orange hover:text-forest-950 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => { setEditingBlendId(null); setForm({ product_id: '', amount_fl_oz_per_100_gal: ''}) }}
                            className="text-white/40 hover:text-white px-2 py-2 text-xs transition-colors ml-2"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingBlendId(blend.id)}
                        className="text-xs text-brand-orange hover:text-white transition-colors flex items-center gap-1.5 px-2 py-1"
                      >
                        <span>✏️</span> Edit Recipe
                      </button>
                    )}
                  </div>

                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {/* Standalone instructions area */}
      <div className="glass rounded-xl p-6 mt-8 overflow-x-auto">
        <h3 className="text-white font-bold mb-4">Add/Edit Blend Component</h3>
        <table className="w-full min-w-[500px]">
          <tbody>
            <tr>
              <td>
                <p className="text-white/40 text-sm leading-relaxed">
                  Blend recipes are pre-defined templates used by technicians during logging.<br/><br/>
                  When a technician logs a <strong>Blend Application</strong> (e.g., 200 gal), the system automatically looks up these rates.
                  It will pull <strong>({"{rate}"} × 200 ÷ 100) fl oz</strong> of each component from the stock levels, accurately updating all inventory in real-time.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

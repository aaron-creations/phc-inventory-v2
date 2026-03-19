import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function MixRatesView() {
  const [blends, setBlends] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const [blendRes, productRes] = await Promise.all([
        supabase.from('blends').select('*, blend_components(*, products(*))').order('name'),
        supabase.from('products').select('*').order('name'),
      ])
      setBlends(blendRes.data || [])
      setProducts(productRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const mixedProducts = products.filter(p => p.unit_type === 'mixed')
  const directProducts = products.filter(p => p.unit_type === 'direct')

  const badgeColors = {
    green:  'border-brand-green/40 text-brand-green',
    orange: 'border-brand-orange/40 text-brand-orange',
    blue:   'border-brand-blue/40 text-brand-blue',
  }

  return (
    <div className="min-h-screen bg-forest-950 max-w-lg mx-auto px-4 py-8 pb-16">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white transition-colors text-sm flex-1 text-left">
          ← Back
        </button>
        <h1 className="text-white font-bold text-xl flex-[2] text-center whitespace-nowrap">📋 Mix Rates</h1>
        <div className="flex-1 flex justify-end">
          <button onClick={() => navigate('/hub')} className="text-white/50 hover:text-white transition-colors" title="Hub">
            🏠
          </button>
        </div>
      </div>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl glass animate-pulse mb-4" />
        ))
      ) : (
        <>
          {/* Section 1: Blends */}
          <SectionHeader icon="🧬" title="Blends" />
          <div className="flex flex-col gap-3 mb-8">
            {blends.map(blend => {
              const blendCost = calcBlendCost(blend.blend_components)
              return (
                <div key={blend.id} className={`glass rounded-xl p-4 border-l-2 ${badgeColors[blend.badge_color]?.replace('text-', 'border-l-') || 'border-l-brand-green'}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className={`font-semibold text-sm ${badgeColors[blend.badge_color]?.split(' ')[1] || 'text-brand-green'}`}>
                      {blend.emoji} {blend.name}
                    </p>
                    {blendCost !== null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20 font-mono flex-shrink-0">
                        ${blendCost.toFixed(2)} / 100 gal
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {blend.blend_components?.map(bc => (
                      <div key={bc.id} className="flex justify-between items-center">
                        <span className="text-white/70 text-xs">{bc.products?.name}</span>
                        <span className="text-white/40 text-xs font-mono">{bc.rate_fl_oz_per_100_gal} fl oz / 100 gal</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Section 2: Mixed Products */}
          <SectionHeader icon="🧪" title="Mixed Products" />
          <div className="glass rounded-xl overflow-hidden mb-8">
            {mixedProducts.map((p, i) => (
              <div key={p.id} className={`flex justify-between items-center px-4 py-3 ${i < mixedProducts.length - 1 ? 'border-b border-white/5' : ''}`}>
                <span className="text-white/80 text-xs flex-1 pr-2">{p.name}</span>
                <span className="text-white/40 text-xs font-mono flex-shrink-0">{p.mix_rate}</span>
              </div>
            ))}
          </div>

          {/* Section 3: Direct Use */}
          <SectionHeader icon="💉" title="Direct Use" />
          <div className="glass rounded-xl overflow-hidden">
            {directProducts.map((p, i) => (
              <div key={p.id} className={`flex justify-between items-center px-4 py-3 ${i < directProducts.length - 1 ? 'border-b border-white/5' : ''}`}>
                <span className="text-white/80 text-xs flex-1 pr-2">{p.name}</span>
                <span className="text-white/40 text-xs font-mono flex-shrink-0">
                  {p.container_size} {p.container_unit}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Cost calculator (mirrors BlendsSection logic)
const UNIT_TO_FL_OZ = { gal: 128, qt: 32, pint: 16, oz: 1, liter: 33.814 }
function calcBlendCost(components = []) {
  let total = 0; let hasCost = false
  for (const bc of components) {
    const p = bc.products
    if (!p?.cost_per_container || !p?.container_size || !bc.rate_fl_oz_per_100_gal) continue
    const containerFlOz = p.container_size * (UNIT_TO_FL_OZ[p.container_unit] || 128)
    total += (p.cost_per_container / containerFlOz) * bc.rate_fl_oz_per_100_gal
    hasCost = true
  }
  return hasCost ? total : null
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <h2 className="text-white/60 text-xs font-semibold tracking-widest uppercase">{title}</h2>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  )
}

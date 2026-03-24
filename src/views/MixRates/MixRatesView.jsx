import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function formatFlOz(oz) {
  if (oz >= 128) return `${(oz / 128).toFixed(2)} gal`
  if (oz >= 32)  return `${(oz / 32).toFixed(2)} qt`
  if (oz >= 16)  return `${(oz / 16).toFixed(2)} pint`
  return `${oz.toFixed(1)} fl oz`
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

// ─── Calculator Tab ───────────────────────────────────────────────────────────
function CalculatorTab({ blends, products }) {
  const [selectedBlend, setSelectedBlend] = useState(null)
  const [gallons, setGallons] = useState('')

  useEffect(() => {
    if (blends.length > 0 && !selectedBlend) setSelectedBlend(blends[0].id)
  }, [blends])

  const blend = blends.find(b => b.id === selectedBlend)

  const results = useMemo(() => {
    if (!blend || !gallons || isNaN(Number(gallons)) || Number(gallons) <= 0) return null
    const g = Number(gallons)
    const components = blend.blend_components || []
    const items = components.map(bc => {
      const flOzNeeded = (bc.rate_fl_oz_per_100_gal / 100) * g
      return {
        name: bc.products?.name || 'Unknown product',
        flOz: flOzNeeded,
      }
    })
    const totalProductFlOz = items.reduce((sum, i) => sum + i.flOz, 0)
    const waterFlOz = Math.max(0, g * 128 - totalProductFlOz)
    return { items, waterFlOz, totalGal: g }
  }, [blend, gallons])

  const directProducts = products.filter(p => p.unit_type === 'direct')
  const mixedProducts  = products.filter(p => p.unit_type === 'mixed')
  const allNonBlend    = [...mixedProducts, ...directProducts]

  return (
    <div className="flex flex-col gap-6">

      {/* Blend Calculator */}
      <div className="glass rounded-xl p-5">
        <SectionHeader icon="🧬" title="Blend Calculator" />
        <p className="text-white/35 text-xs mb-4 -mt-1">
          Select a blend and enter your tank/treatment volume to get exact amounts.
        </p>

        <div className="flex flex-col gap-3 mb-5">
          <div>
            <label className="text-white/50 text-xs font-medium mb-1.5 block">Select Blend</label>
            <div className="flex flex-col gap-2">
              {blends.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBlend(b.id)}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-left transition-all border ${
                    selectedBlend === b.id
                      ? 'border-brand-green/40 bg-brand-green/10 text-brand-green'
                      : 'border-white/8 bg-white/3 text-white/60 hover:border-white/15 hover:text-white/80'
                  }`}
                >
                  <span className="text-base">{b.emoji}</span>
                  <span className="flex-1">{b.name}</span>
                  {selectedBlend === b.id && <span className="text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs font-medium mb-1.5 block">Treatment Volume (gallons)</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 100"
              value={gallons}
              onChange={e => setGallons(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm outline-none focus:border-brand-green/50 transition-colors"
            />
          </div>
        </div>

        {results ? (
          <div className="rounded-xl bg-white/[0.04] border border-white/8 overflow-hidden">
            <div className="px-4 py-2 bg-white/[0.04] border-b border-white/8">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                Results for {results.totalGal} gallon{results.totalGal !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y divide-white/5">
              {results.items.map((item, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-3">
                  <span className="text-white/80 text-sm">{item.name}</span>
                  <span className="text-brand-green font-bold font-mono text-sm">{formatFlOz(item.flOz)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-3 bg-blue-500/[0.04]">
                <span className="text-blue-300/80 text-sm">Water to fill</span>
                <span className="text-blue-400 font-bold font-mono text-sm">{formatFlOz(results.waterFlOz)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
            <p className="text-white/20 text-sm">Enter a volume above to see required amounts</p>
          </div>
        )}
      </div>

      {/* Individual Product Calculator — Coming Soon */}
      <div className="glass rounded-xl p-5 border border-yellow-500/10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🧪</span>
          <h2 className="text-white/60 text-xs font-semibold tracking-widest uppercase">Individual Product Calculator</h2>
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 font-semibold uppercase tracking-wide flex-shrink-0">In Progress</span>
        </div>

        <p className="text-white/35 text-xs mb-4">
          Formulas for individual products are being compiled from SDS sheets. Once Kenneth provides the product data sheets, exact calculator amounts will be available here for each product.
        </p>

        <div className="flex flex-col gap-2">
          {allNonBlend.map(p => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/6 opacity-60">
              <div>
                <p className="text-white/60 text-sm">{p.name}</p>
                {p.mix_rate && <p className="text-white/30 text-xs mt-0.5 font-mono">{p.mix_rate}</p>}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500/70 border border-yellow-500/15 font-semibold">
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ─── Reference Tab ────────────────────────────────────────────────────────────
function ReferenceTab({ blends, products }) {
  const mixedProducts  = products.filter(p => p.unit_type === 'mixed')
  const directProducts = products.filter(p => p.unit_type === 'direct')

  const badgeColors = {
    green:  'border-brand-green/40 text-brand-green',
    orange: 'border-brand-orange/40 text-brand-orange',
    blue:   'border-brand-blue/40 text-brand-blue',
  }

  return (
    <>
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

      <SectionHeader icon="🧪" title="Mixed Products" />
      <div className="glass rounded-xl overflow-hidden mb-8">
        {mixedProducts.map((p, i) => (
          <div key={p.id} className={`flex justify-between items-center px-4 py-3 ${i < mixedProducts.length - 1 ? 'border-b border-white/5' : ''}`}>
            <span className="text-white/80 text-xs flex-1 pr-2">{p.name}</span>
            <span className="text-white/40 text-xs font-mono flex-shrink-0">{p.mix_rate}</span>
          </div>
        ))}
      </div>

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
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────
export default function MixRatesView() {
  const [blends, setBlends]     = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('reference')
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

  return (
    <div className="min-h-screen bg-forest-950 max-w-lg mx-auto px-4 py-8 pb-16">
      {/* Header */}
      <div className="flex items-center mb-5">
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

      {/* Tab Toggle */}
      <div className="flex gap-1 p-1 glass rounded-xl mb-6">
        {[
          { key: 'reference',  label: '📖 Reference' },
          { key: 'calculator', label: '🧮 Calculator' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl glass animate-pulse mb-4" />
        ))
      ) : activeTab === 'reference' ? (
        <ReferenceTab blends={blends} products={products} />
      ) : (
        <CalculatorTab blends={blends} products={products} />
      )}
    </div>
  )
}

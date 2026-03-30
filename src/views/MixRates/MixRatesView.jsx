import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

// --- Unit conversion helpers ---
const UNIT_TO_FL_OZ = { gal: 128, qt: 32, pint: 16, oz: 1, 'fl oz': 1, liter: 33.814 }

function formatFlOz(oz) {
  if (oz >= 128) return `${(oz / 128).toFixed(2)} gal`
  if (oz >= 32)  return `${(oz / 32).toFixed(2)} qt`
  if (oz >= 16)  return `${(oz / 16).toFixed(2)} pint`
  return `${oz.toFixed(1)} fl oz`
}

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

function ResultRow({ label, value, highlight }) {
  return (
    <div className={`flex justify-between items-center px-4 py-3 ${highlight ? 'bg-blue-500/[0.04]' : ''}`}>
      <span className={`text-sm ${highlight ? 'text-blue-300/80' : 'text-white/80'}`}>{label}</span>
      <span className={`font-bold font-mono text-sm ${highlight ? 'text-blue-400' : 'text-brand-green'}`}>{value}</span>
    </div>
  )
}

function ResultBox({ children }) {
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/8 overflow-hidden divide-y divide-white/5 mt-4">
      {children}
    </div>
  )
}

function EmptyResult({ text = 'Fill in the fields above to see results' }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center mt-4">
      <p className="text-white/20 text-sm">{text}</p>
    </div>
  )
}

function NumberInput({ label, value, onChange, placeholder, unit }) {
  return (
    <div>
      <label className="text-white/50 text-xs font-medium mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0"
          step="any"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm outline-none focus:border-brand-green/50 transition-colors"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs pointer-events-none">{unit}</span>
        )}
      </div>
    </div>
  )
}

// --- Blend Calculator ---
function BlendCalc({ blends }) {
  const [selectedBlend, setSelectedBlend] = useState(null)
  const [gallons, setGallons] = useState('')

  useEffect(() => {
    if (blends.length > 0 && !selectedBlend) setSelectedBlend(blends[0].id)
  }, [blends])

  const blend = blends.find(b => b.id === selectedBlend)

  const results = useMemo(() => {
    if (!blend || !gallons || isNaN(Number(gallons)) || Number(gallons) <= 0) return null
    const g = Number(gallons)
    const items = (blend.blend_components || []).map(bc => ({
      name: bc.products?.name || 'Unknown product',
      flOz: (bc.rate_fl_oz_per_100_gal / 100) * g,
    }))
    const totalProductFlOz = items.reduce((sum, i) => sum + i.flOz, 0)
    const waterFlOz = Math.max(0, g * 128 - totalProductFlOz)
    return { items, waterFlOz, totalGal: g }
  }, [blend, gallons])

  return (
    <div className="glass rounded-xl p-5">
      <SectionHeader icon="🧬" title="Blend Mix Calculator" />
      <p className="text-white/35 text-xs mb-4 -mt-1">
        Select a blend recipe and enter your total tank volume to get exact amounts per ingredient.
      </p>

      <div className="flex flex-col gap-3">
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

        <NumberInput
          label="Treatment Volume (gallons)"
          value={gallons}
          onChange={setGallons}
          placeholder="e.g. 100"
          unit="gal"
        />
      </div>

      {results ? (
        <ResultBox>
          <div className="px-4 py-2 bg-white/[0.04] border-b border-white/8">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
              Results for {results.totalGal} gallon{results.totalGal !== 1 ? 's' : ''}
            </p>
          </div>
          {results.items.map((item, i) => (
            <ResultRow key={i} label={item.name} value={formatFlOz(item.flOz)} />
          ))}
          <ResultRow label="Water to fill" value={formatFlOz(results.waterFlOz)} highlight />
        </ResultBox>
      ) : <EmptyResult />}
    </div>
  )
}

// --- Shortstop / Cambistat DBH Calculator ---
// Formula: mL product = DBH^2 / 12
function ShortstopCalc() {
  const [dbh, setDbh] = useState('')
  const [volPerInch, setVolPerInch] = useState('20')

  const results = useMemo(() => {
    const d = parseFloat(dbh)
    const v = parseFloat(volPerInch)
    if (!d || d <= 0 || !v || v <= 0) return null
    const productMl = (d * d) / 12
    const totalMl   = d * v
    const waterMl   = Math.max(0, totalMl - productMl)
    return { productMl, waterMl, totalMl }
  }, [dbh, volPerInch])

  return (
    <div className="glass rounded-xl p-5">
      <SectionHeader icon="🌲" title="Shortstop / Cambistat Calculator (DBH)" />
      <p className="text-white/35 text-xs mb-4 -mt-1">
        Direct-injection trunk treatment. Scales by DBH (diameter at breast height).
        <span className="block mt-1 text-white/20">Formula: mL product = DBH² ÷ 12</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="DBH (inches)" value={dbh} onChange={setDbh} placeholder="e.g. 12" unit="in" />
        <NumberInput label="Volume/Inch (mL)" value={volPerInch} onChange={setVolPerInch} placeholder="20" unit="mL/in" />
      </div>
      {results ? (
        <ResultBox>
          <ResultRow label="Product (Shortstop / Cambistat)" value={`${results.productMl.toFixed(1)} mL`} />
          <ResultRow label="Water" value={`${results.waterMl.toFixed(1)} mL`} highlight />
          <ResultRow label="Total syringe volume" value={`${results.totalMl.toFixed(1)} mL`} />
        </ResultBox>
      ) : <EmptyResult />}
    </div>
  )
}

// --- PhosphoJet Calculator ---
// Formula: sites = DBH/2, total = sites*20mL, product = total/2.85, water = total - product
function PhosphoJetCalc() {
  const [dbh, setDbh] = useState('')

  const results = useMemo(() => {
    const d = parseFloat(dbh)
    if (!d || d <= 0) return null
    const sites      = Math.round(d / 2)
    const totalMl    = sites * 20
    const productMl  = totalMl / 2.85
    const waterMl    = totalMl - productMl
    return { sites, totalMl, productMl, waterMl }
  }, [dbh])

  return (
    <div className="glass rounded-xl p-5">
      <SectionHeader icon="🦫" title="PhosphoJet Calculator (DBH)" />
      <p className="text-white/35 text-xs mb-4 -mt-1">
        Trunk injection for phosphonate treatments. Cheat sheet: 3.5 mL/in DBH, diluted 1:2 with water.
        <span className="block mt-1 text-white/20">Formula: sites = DBH ÷ 2 · total = sites × 20 mL · product = total ÷ 2.85</span>
      </p>
      <NumberInput label="DBH (inches)" value={dbh} onChange={setDbh} placeholder="e.g. 18" unit="in" />
      {results ? (
        <ResultBox>
          <ResultRow label="Injection Sites" value={`${results.sites} sites`} />
          <ResultRow label="Total Syringe Volume" value={`${results.totalMl.toFixed(0)} mL`} />
          <ResultRow label="PhosphoJet" value={`${results.productMl.toFixed(1)} mL`} />
          <ResultRow label="Water" value={`${results.waterMl.toFixed(1)} mL`} highlight />
        </ResultBox>
      ) : <EmptyResult />}
    </div>
  )
}

// --- Mn-Jet Calculator (Spring & Fall) ---
// Formula: Circumference = DBH*3, sites = C/6
//   Spring: DBH*5 mL (undiluted), Fall: DBH*12 mL (undiluted)
function MnJetCalc() {
  const [dbh, setDbh] = useState('')
  const [season, setSeason] = useState('spring')

  const results = useMemo(() => {
    const d = parseFloat(dbh)
    if (!d || d <= 0) return null
    const circumference = d * 3
    const sites = Math.round(circumference / 6)
    const totalMl = season === 'spring' ? d * 5 : d * 12
    return { circumference, sites, totalMl }
  }, [dbh, season])

  return (
    <div className="glass rounded-xl p-5">
      <SectionHeader icon="🍂" title="Mn-Jet Calculator (DBH)" />
      <p className="text-white/35 text-xs mb-4 -mt-1">
        Manganese injection for chlorosis / nutrient deficiency. Seasonal doses differ.
        <span className="block mt-1 text-white/20">Circumference = DBH × 3 · sites = C ÷ 6 · Spring: DBH × 5 mL · Fall: DBH × 12 mL</span>
      </p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <NumberInput label="DBH (inches)" value={dbh} onChange={setDbh} placeholder="e.g. 10" unit="in" />
        <div>
          <label className="text-white/50 text-xs font-medium mb-1.5 block">Season</label>
          <div className="flex gap-1 p-1 glass rounded-xl">
            {[['spring', '🌱 Spring'], ['fall', '🍂 Fall']].map(([s, label]) => (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                  season === s
                    ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {results ? (
        <ResultBox>
          <ResultRow label="Circumference (est.)" value={`${results.circumference.toFixed(0)} in`} />
          <ResultRow label="Injection Sites" value={`${results.sites} sites`} />
          <ResultRow label="Mn-Jet (full concentration)" value={`${results.totalMl.toFixed(0)} mL`} />
          <ResultRow label="Water" value="0 mL — inject undiluted" highlight />
        </ResultBox>
      ) : <EmptyResult />}
    </div>
  )
}

// --- Spray Mix Calculator ---
// BUG FIX: native <select> dropdowns render with the OS browser chrome (white background).
// Using text-white on the <select> causes options to be invisible (white-on-white).
// Fix: use bg-forest-900 for the select element and add bg-white + text-gray-900 to each <option>.
function SprayMixCalc({ products }) {
  const mixedProducts = products.filter(p => p.unit_type === 'mixed' && p.mix_rate)
  const [selectedId, setSelectedId] = useState('')
  const [gallons, setGallons] = useState('')

  const product = mixedProducts.find(p => p.id === selectedId)

  const parsedRate = useMemo(() => {
    if (!product?.mix_rate) return null
    const m = product.mix_rate.match(/^([\d.]+)\s*(.+?)\/([\d.]+)\s*gal$/i)
    if (!m) return null
    return { amount: parseFloat(m[1]), unit: m[2].trim(), per: parseFloat(m[3]) }
  }, [product])

  const results = useMemo(() => {
    if (!parsedRate || !gallons || isNaN(Number(gallons)) || Number(gallons) <= 0) return null
    const g = Number(gallons)
    const rateInFlOz = parsedRate.unit === 'fl oz' ? parsedRate.amount
      : parsedRate.amount * (UNIT_TO_FL_OZ[parsedRate.unit] || 1)
    const productFlOz = (g / parsedRate.per) * rateInFlOz
    const waterFlOz = Math.max(0, g * 128 - productFlOz)
    return { productFlOz, waterFlOz }
  }, [parsedRate, gallons])

  return (
    <div className="glass rounded-xl p-5">
      <SectionHeader icon="💧" title="Spray Mix Calculator (Mixed Products)" />
      <p className="text-white/35 text-xs mb-4 -mt-1">
        For products mixed with water in a tank. Select a product and enter spray volume.
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-white/50 text-xs font-medium mb-1.5 block">Product</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full bg-forest-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-brand-green/50 transition-colors"
          >
            <option value="" className="bg-white text-gray-900">Select a mixed product…</option>
            {mixedProducts.map(p => (
              <option key={p.id} value={p.id} className="bg-white text-gray-900">{p.name} ({p.mix_rate})</option>
            ))}
          </select>
        </div>
        {parsedRate && (
          <div className="px-3 py-2 rounded-lg bg-brand-green/5 border border-brand-green/15 text-brand-green/70 text-xs font-mono">
            Rate: {parsedRate.amount} {parsedRate.unit} per {parsedRate.per} gal
          </div>
        )}
        <NumberInput label="Tank/Spray Volume (gallons)" value={gallons} onChange={setGallons} placeholder="e.g. 100" unit="gal" />
      </div>
      {results ? (
        <ResultBox>
          <ResultRow label={product.name} value={formatFlOz(results.productFlOz)} />
          <ResultRow label="Water" value={formatFlOz(results.waterFlOz)} highlight />
          <ResultRow label="Total tank volume" value={`${gallons} gal`} />
        </ResultBox>
      ) : <EmptyResult />}
    </div>
  )
}

// --- Reference Tab ---
function ReferenceTab({ blends, products }) {
  const mixedProducts  = products.filter(p => p.unit_type === 'mixed')
  const directProducts = products.filter(p => p.unit_type === 'direct')

  return (
    <>
      <SectionHeader icon="🧬" title="Blends" />
      <div className="flex flex-col gap-3 mb-8">
        {blends.map(blend => {
          const blendCost = calcBlendCost(blend.blend_components)
          return (
            <div key={blend.id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-brand-green font-semibold text-sm">
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

      <SectionHeader icon="🧪" title="Mixed Products (spray tank)" />
      <div className="glass rounded-xl overflow-hidden mb-8">
        {mixedProducts.map((p, i) => (
          <div key={p.id} className={`flex justify-between items-center px-4 py-3 ${i < mixedProducts.length - 1 ? 'border-b border-white/5' : ''}`}>
            <span className="text-white/80 text-xs flex-1 pr-2">{p.name}</span>
            <span className="text-white/40 text-xs font-mono flex-shrink-0">{p.mix_rate}</span>
          </div>
        ))}
      </div>

      <SectionHeader icon="💉" title="Direct Use (trunk injection)" />
      <div className="glass rounded-xl overflow-hidden mb-8">
        {directProducts.map((p, i) => (
          <div key={p.id} className={`flex justify-between items-center px-4 py-3 ${i < directProducts.length - 1 ? 'border-b border-white/5' : ''}`}>
            <span className="text-white/80 text-xs flex-1 pr-2">{p.name}</span>
            <span className="text-white/40 text-xs font-mono flex-shrink-0">
              {p.container_size} {p.container_unit}
            </span>
          </div>
        ))}
      </div>

      <SectionHeader icon="📋" title="Application Cheat Sheet" />
      <div className="flex flex-col gap-2">
        {[
          { name: 'PhosphoJet', rate: '3.5 mL / inch DBH', note: '1 part PhosphoJet : 2 parts water (diluted to 1:2.85 ratio)' },
          { name: 'Mn-Jet',     rate: '5 mL / inch DBH (spring) · 12 mL (fall)', note: 'Inject undiluted at full concentration' },
          { name: 'Shortstop',  rate: 'DBH² ÷ 12 mL of product', note: 'Balance with water to reach volume per inch target' },
        ].map(item => (
          <div key={item.name} className="glass rounded-xl px-4 py-3">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-white text-xs font-semibold">{item.name}</span>
              <span className="text-brand-green text-xs font-mono">{item.rate}</span>
            </div>
            <span className="text-white/35 text-xs">{item.note}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// --- Calculator Tab ---
function CalculatorTab({ blends, products }) {
  const [calc, setCalc] = useState('blend')

  const calcOptions = [
    { key: 'blend',     label: '🧬 Blend' },
    { key: 'spray',     label: '💧 Spray Mix' },
    { key: 'shortstop', label: '🌲 Shortstop' },
    { key: 'phospho',   label: '🦫 PhosphoJet' },
    { key: 'mnjet',     label: '🍂 Mn-Jet' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-1 p-1 glass rounded-xl">
        {calcOptions.slice(0, 3).map(opt => (
          <button
            key={opt.key}
            onClick={() => setCalc(opt.key)}
            className={`py-2 rounded-lg text-xs font-semibold transition-all ${
              calc === opt.key
                ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1 p-1 glass rounded-xl -mt-3">
        {calcOptions.slice(3).map(opt => (
          <button
            key={opt.key}
            onClick={() => setCalc(opt.key)}
            className={`py-2 rounded-lg text-xs font-semibold transition-all ${
              calc === opt.key
                ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {calc === 'blend'     && <BlendCalc blends={blends} />}
      {calc === 'spray'     && <SprayMixCalc products={products} />}
      {calc === 'shortstop' && <ShortstopCalc />}
      {calc === 'phospho'   && <PhosphoJetCalc />}
      {calc === 'mnjet'     && <MnJetCalc />}
    </div>
  )
}

// --- Main View ---
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

      <div className="flex gap-1 p-1 glass rounded-xl mb-6">
        {[
          { key: 'reference',  label: '📖 Reference' },
          { key: 'calculator', label: '🧭 Calculator' },
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

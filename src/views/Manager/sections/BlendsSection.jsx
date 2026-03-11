import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function BlendsSection() {
  const [blends, setBlends] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    supabase
      .from('blends')
      .select('*, blend_components(*, products(name, mix_rate, cost_per_container, container_size, container_unit))')
      .order('name')
      .then(({ data }) => { setBlends(data || []); setLoading(false) })
  }, [])

  const badgeColors = {
    green:  'border-brand-green/40 text-brand-green bg-brand-green/5',
    orange: 'border-brand-orange/40 text-brand-orange bg-brand-orange/5',
    blue:   'border-brand-blue/40 text-brand-blue bg-brand-blue/5',
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-bold text-xl">Blends</h2>
        <span className="text-white/30 text-sm">{blends.length} active</span>
      </div>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 glass rounded-xl animate-pulse mb-3" />)
      ) : (
        <div className="flex flex-col gap-3">
          {blends.map(blend => (
            <div key={blend.id} className="glass rounded-xl overflow-x-auto">
              <div
                className="flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-white/5 transition-all"
                onClick={() => setExpanded(e => ({ ...e, [blend.id]: !e[blend.id] }))}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border ${badgeColors[blend.badge_color] || badgeColors.green}`}>
                    {blend.emoji} {blend.name}
                  </span>
                  <span className="text-white/30 text-xs">{blend.blend_components?.length || 0} products</span>
                </div>
                <div className="flex items-center gap-3">
                  <BlendCostBadge components={blend.blend_components} />
                  <span className="text-white/30 text-sm">{expanded[blend.id] ? '▲' : '▼'}</span>
                </div>
              </div>

              {expanded[blend.id] && (
                <div className="border-t border-white/5 px-4 pb-4">
                  <CostBreakdownTable components={blend.blend_components} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Calculates cost per 100 gallons for one blend component.
 * Formula:
 *   cost_per_fl_oz = cost_per_container / (container_size converted to fl oz)
 *   cost_for_component = cost_per_fl_oz * rate_fl_oz_per_100_gal
 *
 * Container unit → fl oz conversion table:
 *   gal  = 128 fl oz
 *   qt   = 32  fl oz
 *   pint = 16  fl oz
 *   oz   = 1   fl oz (already fl oz)
 *   liter= 33.814 fl oz
 */
const UNIT_TO_FL_OZ = { gal: 128, qt: 32, pint: 16, oz: 1, liter: 33.814 }

function componentCost(bc) {
  const p = bc.products
  if (!p?.cost_per_container || !p?.container_size || !bc.rate_fl_oz_per_100_gal) return null
  const containerFlOz = p.container_size * (UNIT_TO_FL_OZ[p.container_unit] || 128)
  const costPerFlOz   = p.cost_per_container / containerFlOz
  return costPerFlOz * bc.rate_fl_oz_per_100_gal
}

function blendTotalCost(components = []) {
  let total = 0
  let hasCost = false
  for (const bc of components) {
    const c = componentCost(bc)
    if (c !== null) { total += c; hasCost = true }
  }
  return hasCost ? total : null
}

function BlendCostBadge({ components = [] }) {
  const total = blendTotalCost(components)
  if (total === null) return null
  return (
    <span className="text-xs px-2.5 py-1 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20 font-mono font-semibold">
      ${total.toFixed(2)} / 100 gal
    </span>
  )
}

function CostBreakdownTable({ components = [] }) {
  const total = blendTotalCost(components)
  const hasCostData = components.some(bc => componentCost(bc) !== null)

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full min-w-[400px]">
        <thead>
          <tr>
            <th className="text-left text-white/30 text-xs pb-2">Product</th>
            <th className="text-right text-white/30 text-xs pb-2">Rate</th>
            {hasCostData && <th className="text-right text-white/30 text-xs pb-2">Cost / 100 gal</th>}
          </tr>
        </thead>
        <tbody>
          {components?.map(bc => {
            const cost = componentCost(bc)
            return (
              <tr key={bc.id} className="border-t border-white/5">
                <td className="text-white/70 text-xs py-2">{bc.products?.name}</td>
                <td className="text-right text-white/40 text-xs font-mono py-2">{bc.rate_fl_oz_per_100_gal} fl oz</td>
                {hasCostData && (
                  <td className="text-right text-xs font-mono py-2">
                    {cost !== null
                      ? <span className="text-brand-green">${cost.toFixed(3)}</span>
                      : <span className="text-white/20">—</span>}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
        {hasCostData && total !== null && (
          <tfoot>
            <tr className="border-t border-white/10">
              <td colSpan={2} className="text-white/40 text-xs pt-2 font-semibold">Total / 100 gal</td>
              <td className="text-right text-brand-green text-sm pt-2 font-bold font-mono">${total.toFixed(2)}</td>
            </tr>
          </tfoot>
        )}
        {!hasCostData && (
          <tfoot>
            <tr>
              <td colSpan={3} className="text-white/20 text-xs pt-3 text-center">
                Add cost data to products to see cost breakdown.
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { Truck, Search, Plus, Wrench, ChevronRight } from 'lucide-react'

export default function EquipmentSection() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchAssets()
  }, [])

  async function fetchAssets() {
    setLoading(true)
    const { data, error } = await supabase
      .from('fleet_assets')
      .select('*')
      .order('type', { ascending: true })
      .order('name', { ascending: true })
      
    if (!error) setAssets(data || [])
    setLoading(false)
  }

  const filtered = assets.filter(a => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) ||
      a.make_model?.toLowerCase().includes(q) ||
      a.license_plate?.toLowerCase().includes(q)
    )
  })

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full min-h-[50vh]">
      <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-brand-green animate-spin"></div>
    </div>
  )

  const activeAssets = filtered.filter(a => a.status === 'active')
  const inShopAssets = filtered.filter(a => a.status === 'in_shop')

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <input 
            type="text" 
            placeholder="Search trucks, sprayers, plates..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-forest-900 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-brand-orange/50 outline-none transition-colors"
          />
        </div>
      </div>

      {inShopAssets.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Wrench size={14} /> In the Shop / Out of Service
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inShopAssets.map(asset => <AssetCard key={asset.id} asset={asset} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">
          Active Fleet ({activeAssets.length})
        </h2>
        {activeAssets.length === 0 ? (
         <div className="p-8 bg-forest-900 border border-white/5 rounded-xl text-center text-white/40 text-sm">No active assets found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAssets.map(asset => <AssetCard key={asset.id} asset={asset} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function AssetCard({ asset }) {
  const isInShop = asset.status === 'in_shop'

  return (
    <Link to={`/fleet/asset/${asset.id}`} className={`block p-5 rounded-xl border transition-all duration-200 group ${
      isInShop 
        ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30' 
        : 'bg-forest-900 border-white/5 hover:bg-white/5 hover:border-white/10'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1 block">
            {asset.type}
          </span>
          <h3 className="text-white font-bold leading-tight group-hover:text-brand-orange transition-colors">
            {asset.name}
          </h3>
        </div>
        <ChevronRight size={18} className="text-white/20 group-hover:text-brand-orange transition-colors" />
      </div>
      
      <div className="space-y-1 content-start mt-3">
        {asset.make_model && (
          <p className="text-xs text-white/50">{asset.make_model}</p>
        )}
        {asset.license_plate && (
          <p className="text-xs text-white/50 font-mono bg-black/20 px-2 py-0.5 rounded inline-block">
            {asset.license_plate}
          </p>
        )}
      </div>
    </Link>
  )
}

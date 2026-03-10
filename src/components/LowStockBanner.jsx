import { useNavigate } from 'react-router-dom'

export default function LowStockBanner({ products = [], linkTo = '/stock', compact = false }) {
  const navigate = useNavigate()
  const outProducts = products.filter(p => p.containers_in_stock <= 0)
  const lowProducts = products.filter(p => p.containers_in_stock > 0 && p.containers_in_stock <= p.low_stock_threshold)
  if (outProducts.length === 0 && lowProducts.length === 0) return null
  if (compact) {
    const total = outProducts.length + lowProducts.length
    const hasOut = outProducts.length > 0
    return (
      <button onClick={() => navigate(linkTo)} className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl mb-5 text-sm font-medium transition-all hover:brightness-110 ${hasOut ? 'bg-red-500/10 border border-red-500/25 text-red-400' : 'bg-brand-orange/10 border border-brand-orange/25 text-brand-orange'}`}>
        <span className="text-base">{hasOut ? '🔴' : '🟡'}</span>
        <span className="flex-1 text-left">
          {hasOut && outProducts.length > 0 && <span className="text-red-400 font-semibold">{outProducts.length} out of stock</span>}
          {hasOut && lowProducts.length > 0 && <span className="text-white/40"> · </span>}
          {lowProducts.length > 0 && <span>{lowProducts.length} low stock</span>}
        </span>
        <span className="text-white/30 text-xs">View →</span>
      </button>
    )
  }
  return (
    <div className="mb-6 rounded-xl overflow-hidden border border-white/5">
      {outProducts.length > 0 && (
        <div className="bg-red-500/10 border-b border-red-500/15 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-red-400 text-xs font-semibold tracking-widest uppercase flex items-center gap-1.5">🔴 Out of Stock ({outProducts.length})</span>
            <button onClick={() => navigate(linkTo)} className="text-red-400/60 text-xs hover:text-red-400 transition-colors">View Stock →</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {outProducts.map(p => <span key={p.id} className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">{p.name}</span>)}
          </div>
        </div>
      )}
      {lowProducts.length > 0 && (
        <div className="bg-brand-orange/8 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-brand-orange text-xs font-semibold tracking-widest uppercase flex items-center gap-1.5">🟡 Low Stock ({lowProducts.length})</span>
            {outProducts.length === 0 && <button onClick={() => navigate(linkTo)} className="text-brand-orange/60 text-xs hover:text-brand-orange transition-colors">View Stock →</button>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lowProducts.map(p => <span key={p.id} className="text-xs px-2 py-0.5 rounded-full bg-brand-orange/15 text-brand-orange border border-brand-orange/25">{p.name} <span className="opacity-60">({p.containers_in_stock.toFixed(1)} left)</span></span>)}
          </div>
        </div>
      )}
    </div>
  )
}

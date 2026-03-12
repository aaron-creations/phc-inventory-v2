import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight } from 'lucide-react'

export default function PropertiesSection() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchProperties()
  }, [])

  async function fetchProperties() {
    setLoading(true)
    const { data, error } = await supabase
      .from('crm_properties')
      .select(`
        *,
        crm_customers ( id, first_name, last_name, company_name )
      `)
      .order('created_at', { ascending: false })
      
    if (!error) setProperties(data || [])
    setLoading(false)
  }

  const filtered = properties.filter(p => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      p.address_line1?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.nickname?.toLowerCase().includes(q) ||
      p.crm_customers?.last_name?.toLowerCase().includes(q)
    )
  })

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full"><div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin"></div></div>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-white mb-1">Properties</h1>
          <p className="text-sm text-white/40">Address directory for all customer locations.</p>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <input 
            type="text" 
            placeholder="Search addresses..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-forest-900 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-white/30 focus:border-blue-400/50 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="bg-forest-900 border border-white/5 rounded-xl overflow-hidden shadow-lg">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-white/40">
            {searchQuery ? 'No properties found matching your search.' : 'No properties.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-black/20">
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Address</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Customer</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">City</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(p => (
                  <tr 
                    key={p.id} 
                    onClick={() => navigate(`/crm/customers/${p.customer_id}`)}
                    className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      {p.nickname && <div className="text-white/60 text-xs mb-0.5 font-medium">{p.nickname}</div>}
                      <div className="text-white font-medium">{p.address_line1}</div>
                      {p.address_line2 && <div className="text-white/50 text-xs mt-0.5">{p.address_line2}</div>}
                    </td>
                    <td className="p-4">
                      <div className="text-white/80 text-sm">
                        {p.crm_customers?.first_name} {p.crm_customers?.last_name}
                      </div>
                      {p.crm_customers?.company_name && (
                        <div className="text-white/40 text-xs mt-0.5">{p.crm_customers?.company_name}</div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-white/60 text-sm">{p.city || '—'}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-[10px] text-white/20 uppercase tracking-wider group-hover:text-blue-400 transition-colors flex items-center justify-end gap-1">
                        View Customer <ChevronRight size={14} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

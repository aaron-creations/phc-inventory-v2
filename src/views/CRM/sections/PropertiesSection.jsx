import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabaseClient'

export default function PropertiesSection() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadProperties()
  }, [])

  async function loadProperties() {
    setLoading(true)
    const { data } = await supabase
      .from('crm_properties')
      .select(`
        *,
        crm_customers ( first_name, last_name, company_name )
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    setProperties(data || [])
    setLoading(false)
  }

  const filteredProperties = properties.filter(p => {
    const search = searchTerm.toLowerCase()
    return (
      p.address_line1.toLowerCase().includes(search) ||
      p.city?.toLowerCase().includes(search) ||
      p.nickname?.toLowerCase().includes(search) ||
      p.crm_customers?.last_name?.toLowerCase().includes(search)
    )
  })

  return (
    <div className="p-4 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Properties Database</h2>
          <p className="text-white/50 text-sm">Global lookup for all service locations.</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by address, city, or customer name..."
          className="w-full bg-forest-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="glass rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="p-3 text-white/50 font-medium text-sm">Address</th>
                <th className="p-3 text-white/50 font-medium text-sm">City</th>
                <th className="p-3 text-white/50 font-medium text-sm">Customer</th>
                <th className="p-3 text-white/50 font-medium text-sm hidden md:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-white/50">Loading properties...</td>
                </tr>
              ) : filteredProperties.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-white/50">
                    No properties match your search.
                  </td>
                </tr>
              ) : (
                filteredProperties.map(property => (
                  <tr key={property.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-3">
                      <div className="text-white font-medium">{property.address_line1}</div>
                      {property.nickname && (
                        <div className="text-white/40 text-xs">"{property.nickname}"</div>
                      )}
                    </td>
                    <td className="p-3 text-white/70 text-sm">{property.city || '—'}</td>
                    <td className="p-3">
                      <div className="text-white text-sm">
                        {property.crm_customers?.company_name || `${property.crm_customers?.first_name} ${property.crm_customers?.last_name}`}
                      </div>
                    </td>
                    <td className="p-3 text-white/50 text-xs hidden md:table-cell max-w-[200px] truncate">
                      {property.access_notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

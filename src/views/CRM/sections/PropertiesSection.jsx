import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, Edit, Trash2, X } from 'lucide-react'

export default function PropertiesSection() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const [isEditingProperty, setIsEditingProperty] = useState(false)
  const [editPropertyForm, setEditPropertyForm] = useState({})
  const [isUpdatingProperty, setIsUpdatingProperty] = useState(false)

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

  function openEditProperty(p, e) {
    if (e) e.stopPropagation()
    setEditPropertyForm(p)
    setIsEditingProperty(true)
  }

  async function handleUpdateProperty(e) {
    e.preventDefault()
    setIsUpdatingProperty(true)
    const { data, error } = await supabase.from('crm_properties').update({
      nickname: editPropertyForm.nickname,
      address_line1: editPropertyForm.address_line1,
      address_line2: editPropertyForm.address_line2,
      city: editPropertyForm.city,
      state: editPropertyForm.state,
      zip: editPropertyForm.zip,
      access_notes: editPropertyForm.access_notes
    }).eq('id', editPropertyForm.id).select('*, crm_customers ( id, first_name, last_name, company_name )').single()

    setIsUpdatingProperty(false)
    if (error) {
      alert(`Error updating property: ${error.message}`)
    } else {
      setProperties(properties.map(p => p.id === data.id ? data : p))
      setIsEditingProperty(false)
    }
  }

  async function handleDeleteProperty(id, e) {
    if (e) e.stopPropagation()
    if (confirm('Are you sure you want to delete this property? This might affect existing jobs.')) {
      const { error } = await supabase.from('crm_properties').delete().eq('id', id)
      if (error) alert(`Error deleting property: ${error.message}`)
      else setProperties(properties.filter(p => p.id !== id))
    }
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
                      <span className="text-white/60 text-sm">{p.city || '—'}{p.state ? `, ${p.state}` : ''}{p.zip ? ` ${p.zip}` : ''}</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button onClick={(e) => openEditProperty(p, e)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Edit Property">
                          <Edit size={16} />
                        </button>
                        <button onClick={(e) => handleDeleteProperty(p.id, e)} className="p-1.5 text-red-500/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Property">
                          <Trash2 size={16} />
                        </button>
                        <span className="text-[10px] text-white/20 uppercase tracking-wider group-hover:text-blue-400 transition-colors flex items-center justify-end gap-1 ml-2 border-l border-white/10 pl-2">
                          Customer <ChevronRight size={14} />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT PROPERTY MODAL */}
      {isEditingProperty && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 p-6 rounded-xl w-full max-w-lg shadow-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif font-bold text-white">Edit Property</h2>
              <button title="Close" onClick={() => setIsEditingProperty(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateProperty} className="space-y-4">
              <input required placeholder="Address Line 1" value={editPropertyForm.address_line1 || ''} onChange={e => setEditPropertyForm({...editPropertyForm, address_line1: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />
              <input placeholder="Address Line 2 (Apt, Suite, etc.)" value={editPropertyForm.address_line2 || ''} onChange={e => setEditPropertyForm({...editPropertyForm, address_line2: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />
              
              <div className="grid grid-cols-3 gap-3">
                <input placeholder="City" value={editPropertyForm.city || ''} onChange={e => setEditPropertyForm({...editPropertyForm, city: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                <input placeholder="State" maxLength={2} value={editPropertyForm.state || ''} onChange={e => setEditPropertyForm({...editPropertyForm, state: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white uppercase" />
                <input placeholder="ZIP" value={editPropertyForm.zip || ''} onChange={e => setEditPropertyForm({...editPropertyForm, zip: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />
              </div>
              
              <input placeholder="Nickname (e.g. Main House)" value={editPropertyForm.nickname || ''} onChange={e => setEditPropertyForm({...editPropertyForm, nickname: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />
              
              <textarea placeholder="Gate codes, dogs, access notes..." value={editPropertyForm.access_notes || ''} onChange={e => setEditPropertyForm({...editPropertyForm, access_notes: e.target.value})} rows={2} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />

              
              <div className="flex gap-3 justify-end mt-8 border-t border-white/10 pt-4">
                <button type="button" onClick={() => setIsEditingProperty(false)} className="px-4 py-2 text-white/50 hover:text-white transition-colors text-sm font-medium">Cancel</button>
                <button type="submit" disabled={isUpdatingProperty || !editPropertyForm.address_line1} className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 font-semibold rounded-lg transition-colors text-sm disabled:opacity-50">
                  {isUpdatingProperty ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

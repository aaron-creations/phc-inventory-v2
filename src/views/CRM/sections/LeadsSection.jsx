import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { UserPlus, Settings, CheckCircle2, ChevronRight, Edit, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function LeadsSection() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Add Lead Form State
  const [isAddingMode, setIsAddingMode] = useState(false)
  const [newLead, setNewLead] = useState({
    email: '', phone_mobile: '', lead_source: '', notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  
  const [editingLeadId, setEditingLeadId] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [isUpdating, setIsUpdating] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    setLoading(true)
    const { data, error } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('status', 'lead')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching leads:', error)
      setError(error.message)
    } else {
      setLeads(data || [])
    }
    setLoading(false)
  }

  async function handleAddLead(e) {
    e.preventDefault()
    setSubmitting(true)

    const { data, error } = await supabase
      .from('crm_customers')
      .insert([{
        ...newLead,
        status: 'lead'
      }])
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      alert(`Error adding lead: ${error.message}`)
    } else {
      setLeads([data, ...leads])
      setIsAddingMode(false)
      setNewLead({ first_name: '', last_name: '', company_name: '', email: '', phone_mobile: '', lead_source: '', notes: '' })
    }
  }

  function openEditLead(lead) {
    setEditFormData(lead)
    setEditingLeadId(lead.id)
  }

  async function handleUpdateLead(e) {
    e.preventDefault()
    setIsUpdating(true)
    const { data, error } = await supabase.from('crm_customers').update({
      first_name: editFormData.first_name,
      last_name: editFormData.last_name,
      company_name: editFormData.company_name,
      email: editFormData.email,
      phone_mobile: editFormData.phone_mobile,
      lead_source: editFormData.lead_source,
      notes: editFormData.notes
    }).eq('id', editingLeadId).select().single()

    setIsUpdating(false)
    if (error) {
      alert(`Error updating lead: ${error.message}`)
    } else {
      setLeads(leads.map(l => l.id === editingLeadId ? data : l))
      setEditingLeadId(null)
    }
  }

  async function deleteLead(id) {
    if (confirm('Are you sure you want to delete this lead?')) {
      const { error } = await supabase.from('crm_customers').delete().eq('id', id)
      if (error) alert(`Error deleting lead: ${error.message}`)
      else setLeads(leads.filter(l => l.id !== id))
    }
  }

  async function promoteToCustomer(id) {
    const { data, error } = await supabase
      .from('crm_customers')
      .update({ status: 'active' })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      alert(`Error converting lead: ${error.message}`)
    } else {
      // Remove from leads table
      setLeads(leads.filter(l => l.id !== id))
      // Option to navigate to the new customer detail page
      navigate(`/crm/customers/${id}`)
    }
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin"></div>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-white mb-1">Leads</h1>
          <p className="text-sm text-white/40">Manage and convert prospective customers.</p>
        </div>
        
        {!isAddingMode && (
          <button
            onClick={() => setIsAddingMode(true)}
            className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-forest-950 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <UserPlus size={18} />
            Add Lead manually
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      {/* NEW LEAD FORM */}
      {isAddingMode && (
        <div className="bg-forest-900 border border-white/10 rounded-xl p-5 mb-8 animate-in slide-in-from-top-4 fade-in duration-200">
          <form onSubmit={handleAddLead}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">First Name *</label>
                <input required type="text" value={newLead.first_name} onChange={e => setNewLead({...newLead, first_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" />
              </div>
              <div>
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">Last Name</label>
                <input type="text" value={newLead.last_name} onChange={e => setNewLead({...newLead, last_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" />
              </div>
              <div>
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">Company (Optional)</label>
                <input type="text" value={newLead.company_name} onChange={e => setNewLead({...newLead, company_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" />
              </div>
              <div>
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">Mobile Phone</label>
                <input type="tel" value={newLead.phone_mobile} onChange={e => setNewLead({...newLead, phone_mobile: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" placeholder="(555) 123-4567" />
              </div>
              <div>
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">Email</label>
                <input type="email" value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" placeholder="name@domain.com" />
              </div>
              <div>
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">Lead Source</label>
                <select value={newLead.lead_source} onChange={e => setNewLead({...newLead, lead_source: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none appearance-none">
                  <option value="" className="bg-forest-900">Select...</option>
                  <option value="Website" className="bg-forest-900">Website</option>
                  <option value="Referral" className="bg-forest-900">Referral</option>
                  <option value="Truck Wrap" className="bg-forest-900">Truck Wrap</option>
                  <option value="Other" className="bg-forest-900">Other</option>
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">Notes</label>
                <textarea rows={2} value={newLead.notes} onChange={e => setNewLead({...newLead, notes: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" placeholder="Interested in..." />
              </div>
            </div>
            
            <div className="flex gap-3 justify-end items-center border-t border-white/10 pt-4">
              <button type="button" onClick={() => setIsAddingMode(false)} className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={submitting || !newLead.first_name} className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                {submitting ? 'Saving...' : 'Save Lead'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LEADS LIST */}
      <div className="bg-forest-900 border border-white/5 rounded-xl overflow-hidden shadow-lg">
        {leads.length === 0 ? (
          <div className="p-8 text-center text-white/40">
            No active leads found. 
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-black/20">
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Name</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Contact</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Source</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Date Added</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4 align-top">
                      <div className="text-white font-medium">{lead.first_name} {lead.last_name}</div>
                      {lead.company_name && <div className="text-white/40 text-xs mt-0.5">{lead.company_name}</div>}
                    </td>
                    <td className="p-4 align-top">
                      {lead.phone_mobile && <div className="text-white/70 text-sm">{lead.phone_mobile}</div>}
                      {lead.email && <div className="text-white/40 text-xs mt-0.5 truncate max-w-[200px]">{lead.email}</div>}
                    </td>
                    <td className="p-4 align-top text-white/50 text-sm">
                      {lead.lead_source || '—'}
                    </td>
                    <td className="p-4 align-top text-white/50 text-sm">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 align-top text-right w-48">
                      <div className="flex justify-end items-center gap-2 mb-2">
                        <button onClick={() => openEditLead(lead)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Edit Lead">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => deleteLead(lead.id)} className="p-1.5 text-red-500/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Lead">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <button 
                        onClick={() => promoteToCustomer(lead.id)}
                        className="inline-flex items-center justify-center w-full gap-1.5 px-3 py-1.5 bg-brand-green/10 hover:bg-brand-green/20 text-brand-green rounded-lg text-[10px] uppercase font-bold tracking-wider transition-colors"
                      >
                        <CheckCircle2 size={14} />
                        Convert
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT LEAD MODAL */}
      {editingLeadId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 p-6 rounded-xl w-full max-w-lg shadow-2xl relative">
            <h2 className="text-xl font-serif font-bold text-white mb-6">Edit Lead</h2>
            <form onSubmit={handleUpdateLead} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">First Name *</label>
                  <input required value={editFormData.first_name || ''} onChange={e => setEditFormData({...editFormData, first_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Last Name</label>
                  <input value={editFormData.last_name || ''} onChange={e => setEditFormData({...editFormData, last_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Company Name</label>
                <input value={editFormData.company_name || ''} onChange={e => setEditFormData({...editFormData, company_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Mobile Phone</label>
                  <input type="tel" value={editFormData.phone_mobile || ''} onChange={e => setEditFormData({...editFormData, phone_mobile: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Email</label>
                  <input type="email" value={editFormData.email || ''} onChange={e => setEditFormData({...editFormData, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Lead Source</label>
                <select value={editFormData.lead_source || ''} onChange={e => setEditFormData({...editFormData, lead_source: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none">
                  <option value="" className="bg-forest-900">Select...</option>
                  <option value="Website" className="bg-forest-900">Website</option>
                  <option value="Referral" className="bg-forest-900">Referral</option>
                  <option value="Truck Wrap" className="bg-forest-900">Truck Wrap</option>
                  <option value="Other" className="bg-forest-900">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Notes</label>
                <textarea rows={3} value={editFormData.notes || ''} onChange={e => setEditFormData({...editFormData, notes: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="flex gap-3 justify-end mt-8 border-t border-white/10 pt-4">
                <button type="button" onClick={() => setEditingLeadId(null)} className="px-4 py-2 text-white/50 hover:text-white transition-colors text-sm font-medium">Cancel</button>
                <button type="submit" disabled={isUpdating || !editFormData.first_name} className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 font-semibold rounded-lg transition-colors text-sm disabled:opacity-50">
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

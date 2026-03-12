import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, UserPlus } from 'lucide-react'

export default function CustomersSection() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  // Add Customer Form State
  const [isAddingMode, setIsAddingMode] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    first_name: '', last_name: '', company_name: '', 
    email: '', phone_mobile: '', notes: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('status', 'active')
      .order('last_name', { ascending: true })
      
    if (!error) setCustomers(data || [])
    setLoading(false)
  }

  async function handleAddCustomer(e) {
    e.preventDefault()
    setSubmitting(true)

    const { data, error } = await supabase
      .from('crm_customers')
      .insert([{
        ...newCustomer,
        status: 'active'
      }])
      .select()
      .single()

    setSubmitting(false)

    if (error) {
      alert(`Error adding customer: ${error.message}`)
    } else {
      setCustomers([...customers, data].sort((a,b) => (a.last_name || '').localeCompare(b.last_name || '')))
      setIsAddingMode(false)
      setNewCustomer({ first_name: '', last_name: '', company_name: '', email: '', phone_mobile: '', notes: '' })
    }
  }

  const filtered = customers.filter(c => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  })

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full"><div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin"></div></div>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-white mb-1">Customers</h1>
          <p className="text-sm text-white/40">Manage active clients and view their property history.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input 
              type="text" 
              placeholder="Search customers..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-forest-900 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-blue-400/50 outline-none transition-colors"
            />
          </div>
          {!isAddingMode && (
            <button
              onClick={() => setIsAddingMode(true)}
              className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-forest-950 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <UserPlus size={18} />
              Add Customer
            </button>
          )}
        </div>
      </div>

      {/* NEW CUSTOMER FORM */}
      {isAddingMode && (
        <div className="bg-forest-900 border border-white/10 rounded-xl p-5 mb-8 animate-in slide-in-from-top-4 fade-in duration-200">
          <form onSubmit={handleAddCustomer}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">First Name *</label>
                <input required type="text" value={newCustomer.first_name} onChange={e => setNewCustomer({...newCustomer, first_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" />
              </div>
              <div>
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">Last Name</label>
                <input type="text" value={newCustomer.last_name} onChange={e => setNewCustomer({...newCustomer, last_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" />
              </div>
              <div>
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">Company (Optional)</label>
                <input type="text" value={newCustomer.company_name} onChange={e => setNewCustomer({...newCustomer, company_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" />
              </div>
              <div>
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">Mobile Phone</label>
                <input type="tel" value={newCustomer.phone_mobile} onChange={e => setNewCustomer({...newCustomer, phone_mobile: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" placeholder="(555) 123-4567" />
              </div>
              <div>
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">Email</label>
                <input type="email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" placeholder="name@domain.com" />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block tracking-wide text-white/40 text-[10px] font-bold uppercase mb-1.5">Notes</label>
                <textarea rows={1} value={newCustomer.notes} onChange={e => setNewCustomer({...newCustomer, notes: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-blue-400/50 outline-none" placeholder="Optional notes..." />
              </div>
            </div>
            
            <div className="flex gap-3 justify-end items-center border-t border-white/10 pt-4">
              <button type="button" onClick={() => setIsAddingMode(false)} className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={submitting || !newCustomer.first_name} className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                {submitting ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-forest-900 border border-white/5 rounded-xl overflow-hidden shadow-lg">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-white/40">
            {searchQuery ? 'No customers found matching your search.' : 'No active customers.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-black/20">
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Name</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Contact</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(c => (
                  <tr 
                    key={c.id} 
                    onClick={() => navigate(`/crm/customers/${c.id}`)}
                    className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <div className="text-white font-medium">{c.first_name} {c.last_name}</div>
                      {c.company_name && <div className="text-white/40 text-xs mt-0.5">{c.company_name}</div>}
                    </td>
                    <td className="p-4">
                      {c.phone_mobile && <div className="text-white/70 text-sm">{c.phone_mobile}</div>}
                      {c.email && <div className="text-white/40 text-xs mt-0.5">{c.email}</div>}
                    </td>
                    <td className="p-4 text-right">
                      <ChevronRight className="inline-block text-white/20 group-hover:text-blue-400 transition-colors" size={20} />
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

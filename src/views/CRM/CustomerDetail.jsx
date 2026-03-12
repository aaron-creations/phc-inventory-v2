import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { ArrowLeft, User, Phone, Mail, MapPin, Briefcase, Plus, Save, X, Edit, Trash2, CalendarPlus, Clock } from 'lucide-react'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [customer, setCustomer] = useState(null)
  const [properties, setProperties] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Property Add State
  const [isAddingProperty, setIsAddingProperty] = useState(false)
  const [newProperty, setNewProperty] = useState({
    nickname: '', address_line1: '', address_line2: '', 
    city: '', state: '', zip: '', access_notes: ''
  })

  const [isEditingCustomer, setIsEditingCustomer] = useState(false)
  const [editCustomerForm, setEditCustomerForm] = useState({})
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false)
  
  const [technicians, setTechnicians] = useState([])
  const [isSchedulingJob, setIsSchedulingJob] = useState(false)
  const [schedulingProperty, setSchedulingProperty] = useState(null)
  const [newJob, setNewJob] = useState({ service_type: 'Spring Fert', scheduled_date: '', technician_id: '', quoted_price: '' })
  const [isScheduling, setIsScheduling] = useState(false)

  useEffect(() => {
    fetchCustomerData()
  }, [id])

  async function fetchCustomerData() {
    setLoading(true)
    
    // Fetch Customer
    const { data: cData, error: cErr } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('id', id)
      .single()
      
    if (cErr) {
      console.error(cErr)
      setLoading(false)
      return
    }
    setCustomer(cData)

    // Fetch Properties
    const { data: pData } = await supabase
      .from('crm_properties')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      
    if (pData) setProperties(pData)

    // Fetch Jobs
    const { data: jData } = await supabase
      .from('crm_jobs')
      .select(`
        *,
        crm_properties ( address_line1, nickname ),
        technicians ( first_name, last_name )
      `)
      .eq('customer_id', id)
      .order('scheduled_date', { ascending: false })
      
    if (jData) setJobs(jData)

    const { data: techData } = await supabase.from('technicians').select('*').eq('is_active', true)
    if (techData) setTechnicians(techData)

    setLoading(false)
  }

  function openEditCustomer() {
    setEditCustomerForm(customer)
    setIsEditingCustomer(true)
  }

  async function handleUpdateCustomer(e) {
    e.preventDefault()
    setIsUpdatingCustomer(true)
    const { data, error } = await supabase.from('crm_customers').update({
      first_name: editCustomerForm.first_name,
      last_name: editCustomerForm.last_name,
      company_name: editCustomerForm.company_name,
      email: editCustomerForm.email,
      phone_mobile: editCustomerForm.phone_mobile,
      notes: editCustomerForm.notes
    }).eq('id', customer.id).select().single()

    setIsUpdatingCustomer(false)
    if (error) {
      alert(`Error updating customer: ${error.message}`)
    } else {
      setCustomer(data)
      setIsEditingCustomer(false)
    }
  }

  async function handleDeleteCustomer() {
    if (confirm('Are you sure you want to delete this customer? All their properties and jobs will be deleted as well.')) {
      const { error } = await supabase.from('crm_customers').delete().eq('id', customer.id)
      if (error) alert(`Error deleting customer: ${error.message}`)
      else navigate('/crm/customers')
    }
  }

  function openScheduleJob(property) {
    setSchedulingProperty(property)
    setNewJob({ 
      service_type: 'Spring Fert', 
      scheduled_date: '', 
      technician_id: '', 
      quoted_price: '',
      is_recurring: false,
      frequency: 'monthly',
      interval_days: ''
    })
    setIsSchedulingJob(true)
  }

  async function handleScheduleJob(e) {
    e.preventDefault()
    setIsScheduling(true)

    if (newJob.is_recurring) {
      // 1. Create the recurring schedule
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('crm_recurring_schedules')
        .insert([{
          customer_id: customer.id,
          property_id: schedulingProperty.id,
          service_type: newJob.service_type,
          quoted_price: newJob.quoted_price ? parseFloat(newJob.quoted_price) : null,
          technician_id: newJob.technician_id || null,
          frequency: newJob.frequency,
          interval_days: newJob.frequency === 'custom' ? parseInt(newJob.interval_days) : null,
          start_date: newJob.scheduled_date
        }])
        .select()
        .single()

      if (scheduleError) {
        alert(`Error creating schedule: ${scheduleError.message}`)
        setIsScheduling(false)
        return
      }
      
      // 2. Run the pg_cron function manually to immediately generate the first batch of jobs
      await supabase.rpc('generate_upcoming_recurring_jobs')
      
      setIsSchedulingJob(false)
      setIsScheduling(false)
      // Re-fetch jobs to get the newly generated ones
      const { data: refreshedJobs } = await supabase
        .from('crm_jobs')
        .select(`*, crm_properties ( address_line1, nickname ), technicians ( first_name, last_name )`)
        .eq('customer_id', customer.id)
        .order('scheduled_date', { ascending: false })
      if (refreshedJobs) setJobs(refreshedJobs)
      return
    }

    const { data, error } = await supabase.from('crm_jobs').insert([{
      ...newJob,
      property_id: schedulingProperty.id,
      customer_id: customer.id,
      status: 'scheduled',
      technician_id: newJob.technician_id || null,
      quoted_price: newJob.quoted_price ? parseFloat(newJob.quoted_price) : null
    }]).select().single()

    setIsScheduling(false)
    if (error) {
      alert(`Error scheduling job: ${error.message}`)
    } else {
      const jobWithRelations = {
        ...data,
        crm_properties: { nickname: schedulingProperty.nickname, address_line1: schedulingProperty.address_line1 },
        technicians: technicians.find(t => t.id === newJob.technician_id) || null
      }
      setJobs([jobWithRelations, ...jobs].sort((a,b) => new Date(b.scheduled_date || 0) - new Date(a.scheduled_date || 0)))
      setIsSchedulingJob(false)
    }
  }

  async function handleAddProperty(e) {
    e.preventDefault()
    
    const { data, error } = await supabase
      .from('crm_properties')
      .insert([{
        ...newProperty,
        customer_id: id
      }])
      .select()
      .single()

    if (error) {
      alert(`Error saving property: ${error.message}`)
    } else {
      setProperties([data, ...properties])
      setIsAddingProperty(false)
      setNewProperty({ nickname: '', address_line1: '', address_line2: '', city: '', state: '', zip: '', access_notes: '' })
    }
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full"><div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin"></div></div>
  )

  if (!customer) return (
    <div className="p-8 text-white/40">Customer not found.</div>
  )

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      
      {/* HEADER */}
      <div>
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors mb-4 text-sm font-medium pr-4 py-2"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex flex-col md:flex-row gap-4 justify-between md:items-end">
          <div>
            <h1 className="text-3xl font-serif font-bold text-white mb-2 leading-none flex items-center gap-3">
              {customer.first_name} {customer.last_name}
            </h1>
            {customer.company_name && (
              <p className="text-brand-green font-medium tracking-wide flex items-center gap-1.5">
                <Briefcase size={14} /> {customer.company_name}
              </p>
            )}
            <span className="inline-block mt-3 px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              {customer.status}
            </span>
          </div>
          
          <div className="flex flex-col gap-2 bg-forest-900 border border-white/5 rounded-xl p-4 min-w-[240px]">
            {customer.phone_mobile && (
              <a href={`tel:${customer.phone_mobile}`} className="flex items-center gap-2.5 text-sm text-white/70 hover:text-white auto">
                <Phone size={14} className="text-white/30" /> {customer.phone_mobile}
              </a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-2.5 text-sm text-white/70 hover:text-white">
                <Mail size={14} className="text-white/30" /> {customer.email}
              </a>
            )}
            {!customer.phone_mobile && !customer.email && (
              <div className="text-xs text-white/30 italic">No contact info provided</div>
            )}
            <div className="flex items-center gap-2 mt-2 pt-3 border-t border-white/10">
               <button onClick={openEditCustomer} className="flex-1 flex justify-center items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider">
                 <Edit size={12} /> Edit
               </button>
               <button onClick={handleDeleteCustomer} className="flex-1 flex justify-center items-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-2 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider border border-red-500/20">
                 <Trash2 size={12} /> Delete
               </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* PROPERTIES PANEL */}
        <section className="bg-forest-900 border border-white/5 rounded-xl overflow-hidden shadow-lg flex flex-col">
          <div className="p-4 border-b border-white/5 bg-black/10 flex justify-between items-center">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <MapPin size={16} className="text-blue-400" /> Properties ({properties.length})
            </h2>
            {!isAddingProperty && (
              <button onClick={() => setIsAddingProperty(true)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors" title="Add Property">
                <Plus size={16} />
              </button>
            )}
          </div>

          <div className="p-4 flex-1">
            {isAddingProperty && (
              <div className="mb-6 p-4 bg-black/20 rounded-lg border border-white/10 animate-in fade-in duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">New Property</h3>
                  <button onClick={() => setIsAddingProperty(false)} className="text-white/40 hover:text-white"><X size={14} /></button>
                </div>
                <form onSubmit={handleAddProperty} className="space-y-3">
                  <input required placeholder="Address Line 1" value={newProperty.address_line1} onChange={e => setNewProperty({...newProperty, address_line1: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                  <input placeholder="Address Line 2 (Apt, Suite, etc.)" value={newProperty.address_line2} onChange={e => setNewProperty({...newProperty, address_line2: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="City" value={newProperty.city} onChange={e => setNewProperty({...newProperty, city: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                    <input placeholder="Nickname (e.g. Main House)" value={newProperty.nickname} onChange={e => setNewProperty({...newProperty, nickname: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                  </div>
                  
                  <textarea placeholder="Gate codes, dogs, access notes..." value={newProperty.access_notes} onChange={e => setNewProperty({...newProperty, access_notes: e.target.value})} rows={2} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                  
                  <div className="flex justify-end pt-2">
                    <button type="submit" disabled={!newProperty.address_line1} className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 font-semibold text-xs rounded transition-colors disabled:opacity-50">
                      <Save size={14} /> Save Property
                    </button>
                  </div>
                </form>
              </div>
            )}

            {properties.length === 0 && !isAddingProperty ? (
              <p className="text-sm text-white/30 italic text-center py-6">No properties listed.</p>
            ) : (
              <div className="space-y-3">
                {properties.map(p => (
                  <div key={p.id} className="p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                    {p.nickname && <div className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-1">{p.nickname}</div>}
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="text-white font-medium text-sm leading-tight">{p.address_line1}</div>
                        {p.address_line2 && <div className="text-white/60 text-xs mt-0.5">{p.address_line2}</div>}
                        {p.city && <div className="text-white/40 text-xs mt-0.5">{p.city}</div>}
                      </div>
                      <button onClick={() => openScheduleJob(p)} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 w-8 h-8 rounded flex items-center justify-center transition-colors shadow-sm flex-shrink-0 border border-blue-500/30" title="Schedule Service">
                        <Plus size={16} />
                      </button>
                    </div>
                    
                    {p.access_notes && (
                      <div className="mt-2 text-xs text-orange-200/70 bg-orange-500/10 px-2 py-1.5 rounded flex items-start gap-1.5">
                        <span className="font-bold">NOTE:</span> {p.access_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* JOBS HISTORY PANEL */}
        <section className="bg-forest-900 border border-white/5 rounded-xl overflow-hidden shadow-lg flex flex-col">
          <div className="p-4 border-b border-white/5 bg-black/10">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-brand-green">🗓️</span> Service History
            </h2>
          </div>
          
          <div className="p-4 flex-1">
            {jobs.length === 0 ? (
              <p className="text-sm text-white/30 italic text-center py-6">No jobs scheduled or completed yet.</p>
            ) : (
              <div className="space-y-4">
                {jobs.map(job => (
                  <div key={job.id} className="relative pl-4 border-l-2 border-white/10 pb-4 last:pb-0 last:border-transparent">
                    <div className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-forest-900 ${
                      job.status === 'completed' ? 'bg-brand-green' : 
                      job.status === 'in_progress' ? 'bg-orange-400' : 'bg-blue-400'
                    }`} />
                    
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <div className="font-medium text-white text-sm">{job.service_type}</div>
                      <div className="text-xs text-white/40 whitespace-nowrap">
                        {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'Unscheduled'}
                      </div>
                    </div>
                    
                    <div className="text-xs text-white/60 flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                      {job.crm_properties && (
                        <div className="flex items-center gap-1"><MapPin size={12}/> {job.crm_properties.nickname || job.crm_properties.address_line1}</div>
                      )}
                      {job.technicians && (
                        <div className="flex items-center gap-1"><User size={12}/> {job.technicians.first_name}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        
      </div>

      {/* EDIT CUSTOMER MODAL */}
      {isEditingCustomer && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-forest-900 border border-white/10 p-6 rounded-xl w-full max-w-lg shadow-2xl relative">
            <h2 className="text-xl font-serif font-bold text-white mb-6">Edit Customer</h2>
            <form onSubmit={handleUpdateCustomer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">First Name *</label>
                  <input required value={editCustomerForm.first_name || ''} onChange={e => setEditCustomerForm({...editCustomerForm, first_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Last Name</label>
                  <input value={editCustomerForm.last_name || ''} onChange={e => setEditCustomerForm({...editCustomerForm, last_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Company Name</label>
                <input value={editCustomerForm.company_name || ''} onChange={e => setEditCustomerForm({...editCustomerForm, company_name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Mobile Phone</label>
                  <input type="tel" value={editCustomerForm.phone_mobile || ''} onChange={e => setEditCustomerForm({...editCustomerForm, phone_mobile: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
                <div>
                  <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Email</label>
                  <input type="email" value={editCustomerForm.email || ''} onChange={e => setEditCustomerForm({...editCustomerForm, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Notes</label>
                <textarea rows={3} value={editCustomerForm.notes || ''} onChange={e => setEditCustomerForm({...editCustomerForm, notes: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="flex gap-3 justify-end mt-8 border-t border-white/10 pt-4">
                <button type="button" onClick={() => setIsEditingCustomer(false)} className="px-4 py-2 text-white/50 hover:text-white transition-colors text-sm font-medium">Cancel</button>
                <button type="submit" disabled={isUpdatingCustomer || !editCustomerForm.first_name} className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 font-semibold rounded-lg transition-colors text-sm disabled:opacity-50">
                  {isUpdatingCustomer ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE JOB MODAL */}
      {isSchedulingJob && (
         <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
           <div className="bg-forest-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center p-6 border-b border-white/10">
               <div>
                 <h2 className="text-lg font-bold text-white leading-tight">Schedule Service</h2>
                 <p className="text-xs text-brand-green mt-1 tracking-wide uppercase font-bold">{schedulingProperty?.address_line1}</p>
               </div>
               <button onClick={() => setIsSchedulingJob(false)} className="text-white/40 hover:text-white"><X size={20}/></button>
             </div>
             
             <form onSubmit={handleScheduleJob} className="p-6 space-y-4">
               <div>
                 <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Service Type *</label>
                 <input required placeholder="e.g. Spring Fert, Tree Spray..." value={newJob.service_type} onChange={e => setNewJob({...newJob, service_type: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Date</label>
                   <input type="date" value={newJob.scheduled_date} onChange={e => setNewJob({...newJob, scheduled_date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" style={{colorScheme: 'dark'}} />
                 </div>
                 <div>
                   <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Quoted Price ($)</label>
                   <input type="number" step="0.01" min="0" placeholder="0.00" value={newJob.quoted_price} onChange={e => setNewJob({...newJob, quoted_price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                 </div>
               </div>

               <div>
                 <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Assign To Technician</label>
                 <select value={newJob.technician_id} onChange={e => setNewJob({...newJob, technician_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                   <option value="" className="bg-forest-900">Unassigned</option>
                   {technicians.map(t => (
                     <option key={t.id} value={t.id} className="bg-forest-900">{t.first_name} {t.last_name}</option>
                   ))}
                 </select>
               </div>

               <div className="pt-3 pb-1 border-t border-white/10 mt-4">
                 <label className="flex items-center gap-2 cursor-pointer group">
                   <input 
                     type="checkbox" 
                     checked={newJob.is_recurring} 
                     onChange={e => setNewJob({...newJob, is_recurring: e.target.checked})} 
                     className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-forest-900"
                   />
                   <span className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">Make this a recurring service</span>
                 </label>
               </div>

               {newJob.is_recurring && (
                 <div className="grid grid-cols-2 gap-4 bg-black/20 p-4 rounded-xl border border-blue-500/20 animate-in fade-in duration-200">
                   <div>
                     <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Frequency</label>
                     <select value={newJob.frequency} onChange={e => setNewJob({...newJob, frequency: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                       <option value="weekly" className="bg-forest-900">Weekly</option>
                       <option value="biweekly" className="bg-forest-900">Bi-Weekly</option>
                       <option value="monthly" className="bg-forest-900">Monthly</option>
                       <option value="quarterly" className="bg-forest-900">Quarterly</option>
                       <option value="yearly" className="bg-forest-900">Yearly</option>
                       <option value="custom" className="bg-forest-900">Custom Days</option>
                     </select>
                   </div>
                   {newJob.frequency === 'custom' && (
                     <div>
                       <label className="block text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1.5">Every X Days</label>
                       <input type="number" min="1" required={newJob.frequency === 'custom'} value={newJob.interval_days} onChange={e => setNewJob({...newJob, interval_days: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. 21" />
                     </div>
                   )}
                 </div>
               )}

               <div className="pt-4 flex justify-end gap-3 mt-4">
                 <button type="button" onClick={() => setIsSchedulingJob(false)} className="px-4 py-2 text-sm text-white/60 hover:text-white">Cancel</button>
                 <button type="submit" disabled={isScheduling || !newJob.service_type || !newJob.scheduled_date} className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-forest-950 font-bold rounded-lg text-sm transition-colors disabled:opacity-50">
                   {isScheduling ? 'Saving...' : 'Schedule Service'}
                 </button>
               </div>
             </form>
           </div>
         </div>
      )}

    </div>
  )
}

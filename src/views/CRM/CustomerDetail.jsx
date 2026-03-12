import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { format } from 'date-fns'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [properties, setProperties] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCustomerData()
  }, [id])

  async function loadCustomerData() {
    setLoading(true)
    
    // 1. Fetch Customer
    const { data: custData } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('id', id)
      .single()
      
    setCustomer(custData)

    if (custData) {
      // 2. Fetch Properties
      const { data: propData } = await supabase
        .from('crm_properties')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: true })
        
      setProperties(propData || [])

      // 3. Fetch Job History
      const { data: jobData } = await supabase
        .from('crm_jobs')
        .select(`
          *,
          crm_properties ( address_line1, nickname ),
          technicians ( first_name, last_initial )
        `)
        .eq('customer_id', id)
        .order('scheduled_date', { ascending: false })
        
      setJobs(jobData || [])
    }
    
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-white/50 text-center animate-pulse">Loading customer profile...</div>
  if (!customer) return <div className="p-8 text-white/50 text-center">Customer not found.</div>

  const displayName = customer.company_name || `${customer.first_name} ${customer.last_name || ''}`.trim()
  const activeJobs = jobs.filter(j => ['scheduled', 'in_progress'].includes(j.status))
  const pastJobs = jobs.filter(j => ['completed', 'cancelled'].includes(j.status))

  return (
    <div className="flex flex-col h-full bg-forest-950">
      
      {/* Header Profile Section */}
      <div className="flex-shrink-0 p-6 border-b border-white/10 bg-forest-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/crm')}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              ←
            </button>
            <div>
              <h2 className="text-2xl font-bold text-white leading-tight flex items-center gap-2">
                {displayName}
                {customer.status === 'active' && <span className="px-2.5 py-0.5 rounded-full bg-brand-green/20 text-brand-green text-[10px] font-bold uppercase tracking-wider">Active</span>}
                {customer.status === 'lead' && <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider">Lead</span>}
              </h2>
              {customer.company_name && customer.first_name && (
                <p className="text-white/50 text-sm mt-0.5">Contact: {customer.first_name} {customer.last_name}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
             <button className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors">
              Edit
            </button>
             <button className="px-3 py-1.5 bg-brand-green hover:bg-brand-green/90 text-forest-950 text-xs font-bold rounded-lg transition-colors shadow-lg shadow-brand-green/20">
              + New Job
            </button>
          </div>
        </div>

         {/* Quick Contact Bar */}
        <div className="flex flex-wrap gap-4 mt-4">
          {customer.phone_mobile && (
            <a href={`tel:${customer.phone_mobile}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 transition-colors group">
              <span className="text-white/40 group-hover:text-brand-green">📱</span>
              <span className="text-white text-sm font-medium">{customer.phone_mobile}</span>
            </a>
          )}
           {customer.email && (
            <a href={`mailto:${customer.email}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 transition-colors group">
              <span className="text-white/40 group-hover:text-brand-green">✉️</span>
              <span className="text-white text-sm font-medium">{customer.email}</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Properties Layer */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold text-lg">Service Locations</h3>
            <button className="text-xs font-medium text-brand-green hover:text-brand-green/80 flex items-center gap-1">
              + Add Property
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {properties.map(prop => (
              <div key={prop.id} className="glass rounded-xl p-4 border border-white/5">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-medium flex items-center gap-2">
                     <span>📍</span> {prop.nickname || 'Primary Address'}
                  </h4>
                  {prop.is_billing_addr && (
                    <span className="text-[10px] text-brand-orange uppercase font-bold tracking-wider">Billing</span>
                  )}
                </div>
                <p className="text-white/60 text-sm pl-7">{prop.address_line1}</p>
                {prop.address_line2 && <p className="text-white/60 text-sm pl-7">{prop.address_line2}</p>}
                <p className="text-white/60 text-sm pl-7">{prop.city}, {prop.state} {prop.zip}</p>
                
                {prop.access_notes && (
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <p className="text-brand-orange/80 text-xs font-medium">⚠️ {prop.access_notes}</p>
                  </div>
                )}
              </div>
            ))}
            {properties.length === 0 && (
              <div className="col-span-full p-6 text-center text-white/40 border border-dashed border-white/20 rounded-xl">
                No properties added yet.
              </div>
            )}
          </div>
        </section>

        {/* Active Jobs */}
        {activeJobs.length > 0 && (
          <section>
            <h3 className="text-white font-bold text-lg mb-4">Active Jobs</h3>
            <div className="space-y-3">
              {activeJobs.map(job => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          </section>
        )}

        {/* Job History */}
        <section>
           <h3 className="text-white font-bold text-lg mb-4">Service History</h3>
           <div className="space-y-3">
              {pastJobs.map(job => (
                <JobRow key={job.id} job={job} past />
              ))}
              {pastJobs.length === 0 && (
                <div className="p-6 text-center text-white/40 bg-black/20 rounded-xl">
                  No past service history.
                </div>
              )}
           </div>
        </section>

      </div>
    </div>
  )
}

function JobRow({ job, past = false }) {
  const isScheduled = job.status === 'scheduled'
  const inProgress = job.status === 'in_progress'
  const isCancelled = job.status === 'cancelled'

  return (
    <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
      past ? 'bg-black/20 border-white/5 opacity-80' : 'glass border-white/10'
    }`}>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          <h4 className="text-white font-bold">{job.service_type}</h4>
          {!past && isScheduled && <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase">Scheduled</span>}
          {!past && inProgress && <span className="px-2 py-0.5 rounded bg-brand-orange/20 text-brand-orange text-[10px] font-bold uppercase animate-pulse">In Progress</span>}
          {past && isCancelled && <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-500 text-[10px] font-bold uppercase">Cancelled</span>}
          {past && !isCancelled && <span className="px-2 py-0.5 rounded bg-brand-green/10 text-brand-green/60 text-[10px] font-bold uppercase">Completed</span>}
        </div>
        <p className="text-white/50 text-xs flex gap-3">
          <span>📅 {format(new Date(job.scheduled_date), 'MMM d, yyyy')}</span>
          <span>📍 {job.crm_properties?.nickname || job.crm_properties?.address_line1?.split(',')[0]}</span>
          {job.technicians && <span>👷‍♂️ {job.technicians.first_name}</span>}
        </p>
      </div>

      <div className="flex gap-2 text-right self-start md:self-auto">
         {job.quoted_price && (
            <div className="bg-black/40 px-3 py-1.5 rounded-lg flex flex-col items-end">
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Quote</span>
              <span className="text-white font-mono text-sm">${job.quoted_price.toFixed(2)}</span>
            </div>
         )}
         <div className={`px-3 py-1.5 rounded-lg flex flex-col items-end border ${
            job.invoice_status === 'paid' ? 'bg-brand-green/10 border-brand-green/20' : 
            job.invoice_status === 'pending' ? 'bg-brand-orange/10 border-brand-orange/20' : 
            'bg-black/40 border-white/5'
         }`}>
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Invoice</span>
            <span className={`text-sm font-bold capitalize ${
              job.invoice_status === 'paid' ? 'text-brand-green' : 
              job.invoice_status === 'pending' ? 'text-brand-orange' : 
              'text-white/60'
            }`}>
              {job.invoice_status}
            </span>
         </div>
      </div>
    </div>
  )
}

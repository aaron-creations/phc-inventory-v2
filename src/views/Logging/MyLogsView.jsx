import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { format } from 'date-fns'

export default function MyLogsView() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [techId, setTechId] = useState(null) // Hardcode or derive from auth context later

  useEffect(() => {
    // In a real app with Auth, you get this from useAuth()
    // For now, we'll try to find "Kevin R" and use his ID as a demo assumption, 
    // or just fetch all logs if we don't care about isolation yet.
    async function loadMyLogs() {
      // 1. Get the first technician to act as "Me"
      const { data: techs } = await supabase.from('technicians').select('*').limit(1)
      const myId = techs?.[0]?.id

      if (!myId) {
        setLoading(false)
        return
      }
      setTechId(myId)

      // 2. Fetch recent usages & blends
      const { data: txs } = await supabase
        .from('transactions')
        .select(`
          id, date, amount, unit, type,
          products ( name ),
          blends ( name ),
          crm_jobs ( service_type, crm_properties(address_line1) )
        `)
        .eq('technician_id', myId)
        .in('type', ['USAGE', 'BLEND'])
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)

      setLogs(txs || [])
      setLoading(false)
    }

    loadMyLogs()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col p-4">
        <div className="h-8 w-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin m-auto"></div>
      </div>
    )
  }

  // Group by date
  const groupedLogs = logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = []
    acc[log.date].push(log)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/"
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          ←
        </Link>
        <h1 className="text-2xl font-bold text-white leading-tight">History</h1>
      </div>

      {!techId ? (
         <div className="text-center py-20 text-white/50 text-sm">
           Cannot find technician profile.
         </div>
      ) : Object.keys(groupedLogs).length === 0 ? (
        <div className="text-center py-20 text-white/50 text-sm glass rounded-2xl mx-2 border-white/5">
          <span className="text-4xl block mb-2 opacity-50">📜</span>
          You haven't logged any materials yet.
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedLogs).map(([dateStr, dayLogs]) => (
            <div key={dateStr} className="relative">
              <div className="sticky top-0 bg-forest-950/90 backdrop-blur-sm py-2 z-10 mb-3 border-b border-white/10">
                <h2 className="text-brand-green text-sm font-bold tracking-wider uppercase">
                  {format(new Date(dateStr + 'T12:00:00Z'), 'EEEE, MMM d')}
                </h2>
              </div>
              
              <div className="space-y-3">
                {dayLogs.map(log => {
                  const isBlend = log.type === 'BLEND'
                  const colorClass = isBlend ? 'text-brand-blue' : 'text-white'
                  const bgClass = isBlend ? 'bg-brand-blue/10 border-brand-blue/20' : 'bg-white/5 border-white/10'
                  
                  return (
                    <div key={log.id} className={`p-4 rounded-xl border flex flex-col gap-1 ${bgClass}`}>
                      <div className="flex justify-between items-start">
                        <span className={`font-bold ${colorClass}`}>
                          {isBlend ? `🧪 ${log.blends?.name}` : log.products?.name}
                        </span>
                        <span className="text-white/70 font-mono text-sm">
                          {log.amount} {log.unit}
                        </span>
                      </div>
                      
                      {/* Show Job context if linked */}
                      {log.crm_jobs && (
                        <div className="text-xs text-brand-orange mt-1 font-medium bg-brand-orange/10 inline-flex px-2 py-0.5 rounded w-max items-center gap-1.5 border border-brand-orange/20">
                          <span>📍</span> {log.crm_jobs.service_type} @ {log.crm_jobs.crm_properties?.address_line1?.split(',')[0]}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

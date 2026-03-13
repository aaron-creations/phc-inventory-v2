import { useState } from 'react'
import { 
  format, addDays, subDays, startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, 
  isSameDay, addMonths, subMonths, addWeeks, subWeeks, parseISO 
} from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Clock } from 'lucide-react'

// Helpful constants
const HOURS = Array.from({ length: 12 }, (_, i) => i + 7) // 7 AM to 6 PM

// Convert "HH:MM" or "HH:MM:SS" to fractional hours since midnight for absolute positioning
function timeToFraction(timeString) {
  if (!timeString) return null
  const [h, m] = timeString.split(':').map(Number)
  return h + (m / 60)
}

function calculateJobStyle(job) {
  const start = timeToFraction(job.start_time)
  const end = timeToFraction(job.end_time)
  
  if (start === null || end === null) {
    // Fallback if no time assigned - show it as an all-day or placed at top
    return { top: '0%', height: 'auto', minHeight: '3rem', position: 'relative' }
  }

  // Our timeline starts at 7 AM (7.0) and ends at 7 PM (19.0), so 12 hours total.
  const timelineStart = 7
  const timelineDuration = 12

  // Clamp values inside our 7AM - 7PM scale
  const boxStart = Math.max(timelineStart, start)
  const boxEnd = Math.min(timelineStart + timelineDuration, end > start ? end : start + 1)
  
  const topPercent = ((boxStart - timelineStart) / timelineDuration) * 100
  const heightPercent = ((boxEnd - boxStart) / timelineDuration) * 100

  return {
    top: `${Math.max(0, topPercent)}%`,
    height: `${Math.max(5, heightPercent)}%`, // At least 5% height
    position: 'absolute',
    left: '4px',
    right: '4px',
    zIndex: 10
  }
}

function QuickJobCard({ job, onEdit, isMonthView = false }) {
  const isCompleted = job.status === 'completed'
  const isCancelled = job.status === 'cancelled'
  const isInProgress = job.status === 'in_progress'
  const hasTime = job.start_time && job.end_time
  
  // Only apply absolute positioning/height if we have time AND we are not in the month view
  const applyTimeStyle = hasTime && !isMonthView
  const style = applyTimeStyle ? calculateJobStyle(job) : { position: 'relative', marginBottom: '4px' }

  return (
    <div 
      onClick={(e) => { e.stopPropagation(); onEdit(job) }}
      className={`p-1.5 rounded text-xs border cursor-pointer hover:z-20 transition-all ${
        isCompleted ? 'bg-brand-green/10 border-brand-green/20 text-brand-green' : 
        isInProgress ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 
        isCancelled ? 'bg-red-500/10 border-red-500/20 text-red-500/50 line-through' :
        'bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20'
      } ${applyTimeStyle ? 'overflow-hidden shadow-md' : 'mb-1'}`}
      style={style}
      title={`${job.service_type} - ${job.crm_customers?.last_name}`}
    >
      <div className="font-bold truncate leading-none mb-0.5">{job.service_type}</div>
      <div className="truncate text-[10px] opacity-80 leading-none">{job.crm_customers?.last_name}</div>
      {hasTime && (
        <div className="text-[9px] opacity-60 mt-0.5 font-medium flex items-center gap-0.5">
          <Clock size={8} />
          {format(parseISO(`2000-01-01T${job.start_time}`), 'h:mm a')}
        </div>
      )}
    </div>
  )
}

export default function JobsCalendarView({ jobs, onStatusChange, onEdit, onDelete }) {
  const [viewMode, setViewMode] = useState('week') // 'day', 'week', 'month'
  const [currentDate, setCurrentDate] = useState(new Date())

  // Navigation handlers
  const next = () => {
    if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1))
    if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1))
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1))
  }
  const prev = () => {
    if (viewMode === 'day') setCurrentDate(subDays(currentDate, 1))
    if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1))
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1))
  }
  const today = () => setCurrentDate(new Date())

  // Format header string
  function getHeaderLabel() {
    if (viewMode === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy')
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate)
      const end = endOfWeek(currentDate)
      if (isSameMonth(start, end)) return `${format(start, 'MMMM d')} - ${format(end, 'd, yyyy')}`
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
    }
    return format(currentDate, 'MMMM yyyy')
  }

  // Filter jobs for a specific day
  const getJobsForDay = (date) => {
    const dateString = format(date, 'yyyy-MM-dd')
    return jobs.filter(j => j.scheduled_date === dateString)
  }

  // Render Daily View
  function renderDay() {
    const dayJobs = getJobsForDay(currentDate)
    const timedJobs = dayJobs.filter(j => j.start_time && j.end_time)
    const untimedJobs = dayJobs.filter(j => !j.start_time || !j.end_time)

    return (
      <div className="flex flex-col bg-forest-900 border border-white/10 rounded-xl overflow-hidden min-h-[600px]">
        {untimedJobs.length > 0 && (
          <div className="p-3 border-b border-white/10 bg-black/20">
            <h4 className="text-xs font-bold text-white/40 uppercase mb-2">All-Day / Unscheduled Time</h4>
            <div className="flex flex-wrap gap-2">
              {untimedJobs.map(job => <div key={job.id} className="w-48"><QuickJobCard job={job} onEdit={onEdit} /></div>)}
            </div>
          </div>
        )}
        <div className="flex flex-1 relative bg-forest-950 overflow-y-auto">
          {/* Time Scale */}
          <div className="w-16 flex-shrink-0 border-r border-white/5 py-4 bg-forest-900/50">
            {HOURS.map(hour => (
              <div key={hour} className="h-16 text-right pr-2 text-[10px] text-white/40 -mt-1.5">
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </div>
            ))}
          </div>
          {/* Timeline Grid */}
          <div className="flex-1 relative py-4" style={{ height: `${HOURS.length * 4}rem` }}>
            {HOURS.map(hour => (
              <div key={hour} className="h-16 border-t border-white/5 w-full pointer-events-none" />
            ))}
            {/* The absolute positioned jobs */}
            <div className="absolute inset-x-0 top-4 bottom-4">
               {timedJobs.map(job => <QuickJobCard key={job.id} job={job} onEdit={onEdit} />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render Weekly View
  function renderWeek() {
    const start = startOfWeek(currentDate)
    const days = eachDayOfInterval({ start, end: addDays(start, 6) })

    return (
      <div className="flex flex-col bg-forest-900 border border-white/10 rounded-xl overflow-hidden min-h-[600px]">
        {/* Week Header */}
        <div className="flex border-b border-white/10 bg-black/20 pl-12 md:pl-16">
          {days.map(day => (
            <div key={day.toString()} className={`flex-1 p-2 text-center border-l first:border-l-0 border-white/5 ${isSameDay(day, new Date()) ? 'bg-blue-500/10' : ''}`}>
              <div className="text-[10px] text-white/50 uppercase font-bold">{format(day, 'EEE')}</div>
              <div className={`text-sm md:text-lg font-bold ${isSameDay(day, new Date()) ? 'text-blue-400' : 'text-white'}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
        
        {/* All-Day Bar */}
        <div className="flex border-b border-white/10 bg-forest-900/50 pl-12 md:pl-16 min-h-[2rem]">
          {days.map(day => {
            const dayJobs = getJobsForDay(day).filter(j => !j.start_time || !j.end_time)
            return (
              <div key={day.toString()} className="flex-1 border-l first:border-l-0 border-white/5 p-1 relative">
                {dayJobs.map(job => <QuickJobCard key={job.id} job={job} onEdit={onEdit} />)}
              </div>
            )
          })}
        </div>

        {/* Timeline Grid */}
        <div className="flex flex-1 relative bg-forest-950 overflow-y-auto">
          {/* Time Scale */}
          <div className="w-12 md:w-16 flex-shrink-0 border-r border-white/5 py-4 bg-forest-900/50 sticky left-0 z-20">
            {HOURS.map(hour => (
              <div key={hour} className="h-16 text-right pr-1 md:pr-2 text-[10px] text-white/40 -mt-1.5 hidden md:block">
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </div>
            ))}
            {/* Mobile truncated timescale */}
            {HOURS.map(hour => (
              <div key={`m-${hour}`} className="h-16 text-right pr-1 text-[9px] text-white/40 -mt-1.5 md:hidden">
                {hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`}
              </div>
            ))}
          </div>

          {/* Days Columns */}
          <div className="flex flex-1 relative py-4" style={{ height: `${HOURS.length * 4}rem` }}>
            {days.map((day, idx) => {
              const timedJobs = getJobsForDay(day).filter(j => j.start_time && j.end_time)
              return (
                <div key={day.toString()} className={`flex-1 relative border-l first:border-l-0 border-white/5 ${isSameDay(day, new Date()) ? 'bg-blue-500/[0.02]' : ''}`}>
                  {/* Grid Lines */}
                  {HOURS.map(hour => (
                     <div key={hour} className="h-16 border-t border-white/5 w-full pointer-events-none" />
                  ))}
                  <div className="absolute inset-x-0 top-0 bottom-0">
                    {timedJobs.map(job => <QuickJobCard key={job.id} job={job} onEdit={onEdit} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Render Monthly View
  function renderMonth() {
    const start = startOfWeek(startOfMonth(currentDate))
    const end = endOfWeek(endOfMonth(currentDate))
    const days = eachDayOfInterval({ start, end })

    return (
      <div className="flex flex-col bg-forest-900 border border-white/10 rounded-xl overflow-hidden min-h-[600px]">
        {/* Month Header (Days of week) */}
        <div className="flex border-b border-white/10 bg-black/20">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="flex-1 p-2 text-center text-[10px] text-white/50 uppercase font-bold">
              {day}
            </div>
          ))}
        </div>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {days.map(day => {
            const dayJobs = getJobsForDay(day)
            const isCurrentMonth = isSameMonth(day, currentDate)
            return (
              <div key={day.toString()} className={`min-h-[100px] border-r border-b border-white/5 p-1 ${!isCurrentMonth ? 'bg-black/20 opacity-50' : ''} ${isSameDay(day, new Date()) ? 'bg-blue-500/10' : ''}`}>
                <div className={`text-right text-xs p-1 ${isSameDay(day, new Date()) ? 'text-blue-400 font-bold' : 'text-white/40'}`}>
                  {format(day, 'd')}
                </div>
                <div className="flex flex-col gap-1 overflow-y-auto max-h-[80px] no-scrollbar">
                  {dayJobs.map(job => (
                    <QuickJobCard key={job.id} job={job} onEdit={onEdit} isMonthView={true} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-4">
      
      {/* Calendar Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-forest-900 border border-white/5 rounded-xl p-2 gap-4">
        
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button onClick={today} className="px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors">
            Today
          </button>
          <div className="flex items-center bg-black/20 rounded-lg border border-white/5">
            <button onClick={prev} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-l-lg transition-colors"><ChevronLeft size={18}/></button>
            <div className="px-4 text-sm font-bold text-white min-w-[160px] text-center">{getHeaderLabel()}</div>
            <button onClick={next} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-r-lg transition-colors"><ChevronRight size={18}/></button>
          </div>
        </div>

        {/* View Selection */}
        <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
          <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'day' ? 'bg-blue-500 text-forest-950 shadow-sm' : 'text-white/40 hover:text-white'}`}>Day</button>
          <button onClick={() => setViewMode('week')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'week' ? 'bg-blue-500 text-forest-950 shadow-sm' : 'text-white/40 hover:text-white'}`}>Week</button>
          <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'month' ? 'bg-blue-500 text-forest-950 shadow-sm' : 'text-white/40 hover:text-white'}`}>Month</button>
        </div>

      </div>

      {/* Calendar Container */}
      <div className="w-full relative shadow-2xl">
        {viewMode === 'day' && renderDay()}
        {viewMode === 'week' && renderWeek()}
        {viewMode === 'month' && renderMonth()}
      </div>
    </div>
  )
}
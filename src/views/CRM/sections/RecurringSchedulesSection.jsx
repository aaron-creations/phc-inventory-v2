import { useState } from 'react'

export default function RecurringSchedulesSection() {
  const [schedules, setSchedules] = useState([]) // Placeholder

  return (
    <div className="p-4 flex flex-col h-full items-center justify-center text-center">
      <div className="max-w-md space-y-4">
        <span className="text-6xl block mb-4">🗓️</span>
        <h2 className="text-2xl font-bold text-white">Recurring Programs</h2>
        <p className="text-white/50 text-sm leading-relaxed">
          Create service templates (e.g., "5-Step Lawn Care", "Monthly Mosquito Tick") and assign them to properties to automatically generate job entries throughout the season.
        </p>
        <div className="inline-block mt-4 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-widest">
          Coming Soon
        </div>
      </div>
    </div>
  )
}

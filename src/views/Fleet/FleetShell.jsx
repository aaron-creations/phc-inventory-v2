import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import EquipmentSection from './sections/EquipmentSection'
import FleetDashboardSection from './sections/FleetDashboardSection'
import RecurringMaintenanceSection from './sections/RecurringMaintenanceSection'
import MaintenanceHistorySection from './sections/MaintenanceHistorySection'
import AssetDetail from './sections/AssetDetail'

const NAV_ITEMS = [
  { path: 'dashboard', label: 'Dashboard', icon: '📊' },
  { path: 'equipment', label: 'Equipment', icon: '🚚' },
  { path: 'recurring', label: 'Recurring', icon: '📅' },
  { path: 'history',   label: 'History',   icon: '📋' },
]

export default function FleetShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()

  // Find the active tab based on the URL path
  const currentPath = location.pathname.split('/fleet/')[1]?.split('/')[0] || 'equipment'

  return (
    <div className="h-screen overflow-hidden bg-forest-950 flex flex-col md:flex-row w-full">
      {/* Sidebar / Top Nav */}
      <aside className="w-full md:w-52 flex-shrink-0 bg-forest-900 border-b md:border-b-0 md:border-r border-white/5 flex flex-col z-20 shadow-md md:shadow-none">
        
        {/* Brand */}
        <div className="p-3 md:p-4 border-b border-white/5 flex justify-between items-center md:items-start md:flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <img src="/phc-logo.png" alt="PHC" className="w-7 h-7" />
            <div>
              <p className="text-brand-orange text-xs font-semibold tracking-widest uppercase leading-none">Fleet</p>
              <p className="text-white/25 text-[10px] md:text-xs mt-0.5 truncate max-w-[120px]">{user?.email}</p>
            </div>
          </div>
          
          {/* Mobile-only quick actions header right */}
          <div className="flex md:hidden items-center gap-2">
            <button onClick={() => navigate('/hub')} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10" title="Hub">↩</button>
            <button onClick={signOut} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20" title="Sign Out">🚪</button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-none md:flex-1 p-2 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto no-scrollbar gap-1 md:gap-0">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(`/fleet/${item.path}`)}
              className={`flex-shrink-0 md:w-full flex items-center justify-center md:justify-start gap-1.5 md:gap-2.5 px-3 md:px-3 py-2 md:py-2.5 rounded-lg text-xs md:text-sm mb-0 md:mb-0.5 transition-all text-center md:text-left ${
                currentPath === item.path
                  ? 'bg-brand-orange/15 text-brand-orange font-medium'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-sm md:text-base w-4 md:w-5 text-center">{item.icon}</span>
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Desktop Footer actions (Hidden on mobile) */}
        <div className="hidden md:block p-2 border-t border-white/5 mt-auto">
          <button
            onClick={() => navigate('/hub')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all mb-0.5"
          >
            <span className="w-5 text-center">↩</span> Back to Hub
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-all"
          >
            <span className="w-5 text-center">🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-forest-950">
        <Routes>
          <Route path="/" element={<EquipmentSection />} />
          <Route path="dashboard" element={<FleetDashboardSection />} />
          <Route path="equipment" element={<EquipmentSection />} />
          <Route path="asset/:id" element={<AssetDetail />} />
          <Route path="recurring" element={<RecurringMaintenanceSection />} />
          <Route path="history" element={<MaintenanceHistorySection />} />
        </Routes>
      </main>
    </div>
  )
}

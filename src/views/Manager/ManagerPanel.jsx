import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import ManagerDashboard from './sections/ManagerDashboard'
import InventorySection from './sections/InventorySection'
import BlendsSection from './sections/BlendsSection'
import HistorySection from './sections/HistorySection'
import TeamSection from './sections/TeamSection'
import SettingsSection from './sections/SettingsSection'
import AnalyticsSection from './sections/AnalyticsSection'
import UsersSection from './sections/UsersSection'

const NAV_ITEMS = [
  { path: 'dashboard', label: 'Dashboard', icon: '📊' },
  { path: 'analytics', label: 'Analytics', icon: '📈' },
  { path: 'inventory', label: 'Inventory', icon: '📦' },
  { path: 'blends',    label: 'Blends',    icon: '🧬' },
  { path: 'history',   label: 'History',   icon: '📋' },
  { path: 'team',      label: 'Team',      icon: '👥' },
  { path: 'users',     label: 'Users',     icon: '🔐' },
  { path: 'settings',  label: 'Settings',  icon: '⚙️' },
]

export default function ManagerPanel() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const currentPath = location.pathname.split('/manager/')[1]?.split('/')[0] || 'dashboard'
  return (
    <div className="min-h-screen bg-forest-950 flex">
      <aside className="w-52 flex-shrink-0 bg-forest-900 border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5 flex items-center gap-2.5">
          <img src="/phc-logo.png" alt="PHC" className="w-7 h-7" />
          <div>
            <p className="text-brand-green text-xs font-semibold tracking-widest uppercase leading-none">Manager</p>
            <p className="text-white/25 text-xs mt-0.5 truncate max-w-[120px]">{user?.email}</p>
          </div>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button key={item.path} onClick={() => navigate(`/manager/${item.path}`)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all text-left ${currentPath === item.path ? 'bg-brand-green/15 text-brand-green font-medium' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
              <span className="text-base w-5 text-center">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-white/5">
          <button onClick={() => navigate('/')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all mb-0.5"><span className="w-5 text-center">↩</span> Tech View</button>
          <button onClick={signOut} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-all"><span className="w-5 text-center">🚪</span> Sign Out</button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="dashboard" element={<ManagerDashboard />} />
          <Route path="analytics" element={<AnalyticsSection />} />
          <Route path="inventory" element={<InventorySection />} />
          <Route path="blends"    element={<BlendsSection />} />
          <Route path="history"   element={<HistorySection />} />
          <Route path="team"      element={<TeamSection />} />
          <Route path="users"     element={<UsersSection />} />
          <Route path="settings"  element={<SettingsSection />} />
        </Routes>
      </main>
    </div>
  )
}

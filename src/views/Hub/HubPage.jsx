import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Package, Users, Truck, LogOut, Settings, LayoutDashboard } from 'lucide-react'

export default function HubPage() {
  const { profile, signOut } = useAuth()
  const isManager = profile?.role === 'manager'
  
  const tech = profile?.technicians
  const firstName = tech?.first_name || profile?.first_name || profile?.email?.split('@')[0] || 'Team Member'

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col items-center pt-8 px-4 pb-24">
      <div className="w-full max-w-sm flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <img src="/phc-logo.png" alt="PHC Logo" className="w-10 h-10 object-contain" />
          <h1 className="text-xl font-bold text-white tracking-wide">PHC Hub</h1>
        </div>
        <button 
          onClick={() => signOut()}
          className="p-2 text-forest-200 hover:text-white transition-colors"
          title="Sign Out"
        >
          <LogOut size={20} />
        </button>
      </div>
      
      <p className="w-full max-w-sm text-forest-200 mb-8 pl-1">
        Welcome back, <span className="text-white font-medium">{firstName}</span>. Where to?
      </p>

      <div className="w-full max-w-sm grid grid-cols-1 gap-4">
        {/* Inventory App - All approved users */}
        <Link 
          to="/" 
          className="flex items-center p-6 bg-forest-900 border border-forest-800 rounded-2xl hover:bg-forest-800 hover:border-forest-700 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-accent-500/20 text-accent-400 flex items-center justify-center mr-5 group-hover:scale-110 transition-transform">
            <Package size={24} />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg mb-1">Inventory</h2>
            <p className="text-forest-300 text-sm">Dashboard, logs, & stock levels</p>
          </div>
        </Link>

        {/* Manager View - Managers only */}
        {isManager && (
          <Link 
            to="/manager" 
            className="flex items-center p-6 bg-forest-900 border border-forest-800 rounded-2xl hover:bg-forest-800 hover:border-forest-700 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 text-yellow-500 flex items-center justify-center mr-5 group-hover:scale-110 transition-transform">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">Manager View</h2>
              <p className="text-forest-300 text-sm">Analytics, inventory & history</p>
            </div>
          </Link>
        )}

        {/* CRM App - Managers only */}
        {isManager && (
          <Link 
            to="/crm" 
            className="flex items-center p-6 bg-forest-900 border border-forest-800 rounded-2xl hover:bg-forest-800 hover:border-forest-700 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mr-5 group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">CRM</h2>
              <p className="text-forest-300 text-sm">Customers, properties & jobs</p>
            </div>
          </Link>
        )}

        {/* Fleet App - All approved users */}
        <Link 
          to="/fleet" 
          className="flex items-center p-6 bg-forest-900 border border-forest-800 rounded-2xl hover:bg-forest-800 hover:border-forest-700 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center mr-5 group-hover:scale-110 transition-transform">
            <Truck size={24} />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg mb-1">Fleet</h2>
            <p className="text-forest-300 text-sm">Equipment & maintenance</p>
          </div>
        </Link>

        {/* Admin App - Managers only */}
        {isManager && (
          <Link 
            to="/admin" 
            className="flex items-center p-6 bg-forest-900 border border-forest-800 rounded-2xl hover:bg-forest-800 hover:border-forest-700 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mr-5 group-hover:scale-110 transition-transform">
              <Settings size={24} />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">Administrative</h2>
              <p className="text-forest-300 text-sm">Team, users, & settings</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}

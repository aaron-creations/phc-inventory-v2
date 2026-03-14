import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute, ManagerRoute, GuestRoute } from './components/ProtectedRoute'
import LoginPage from './views/Login/LoginPage'
import SetPassword from './views/Login/SetPassword'
import AccessPending from './views/Login/AccessPending'
import Dashboard from './views/Dashboard/Dashboard'
import HubPage from './views/Hub/HubPage'
import LoggingFlow from './views/Logging/LoggingFlow'
import RestockFlow from './views/Logging/RestockFlow'
import MyLogsView from './views/Logging/MyLogsView'
import MyJobsView from './views/Jobs/MyJobsView'
import StockView from './views/Stock/StockView'
import MixRatesView from './views/MixRates/MixRatesView'
import ManagerPanel from './views/Manager/ManagerPanel'
import CRMShell from './views/CRM/CRMShell'
import FleetShell from './views/Fleet/FleetShell'
import AdminShell from './views/Admin/AdminShell'

export default function App() {
  return (
    <AuthProvider>
      <div className="bg-forest-950">
        <Routes>
          {/* Guest-only (redirects away if already logged in) */}
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />

          {/* Forced password setup */}
          <Route path="/set-password" element={<SetPassword />} />

          {/* Authenticated but pending approval */}
          <Route path="/access-pending" element={<AccessPending />} />

          {/* Protected — any approved user (manager or technician) */}
          <Route path="/hub"        element={<ProtectedRoute><HubPage /></ProtectedRoute>} />
          <Route path="/"           element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/log"        element={<ProtectedRoute><LoggingFlow /></ProtectedRoute>} />
          <Route path="/my-logs"    element={<ProtectedRoute><MyLogsView /></ProtectedRoute>} />
          <Route path="/my-jobs"    element={<ProtectedRoute><MyJobsView /></ProtectedRoute>} />
          <Route path="/stock"      element={<ProtectedRoute><StockView /></ProtectedRoute>} />
          <Route path="/mix-rates"  element={<ProtectedRoute><MixRatesView /></ProtectedRoute>} />
          <Route path="/fleet/*"    element={<ManagerRoute><FleetShell /></ManagerRoute>} />

          {/* Manager-only */}
          <Route path="/restock"   element={<ManagerRoute><RestockFlow /></ManagerRoute>} />
          <Route path="/manager/*" element={<ManagerRoute><ManagerPanel /></ManagerRoute>} />
          <Route path="/crm/*"     element={<ManagerRoute><CRMShell /></ManagerRoute>} />
          <Route path="/admin/*"   element={<ManagerRoute><AdminShell /></ManagerRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/hub" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  )
}

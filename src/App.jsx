import { Routes, Route } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ProtectedRoute, ManagerRoute, GuestRoute } from './components/ProtectedRoute'

// Views
import LoginPage    from './views/Login/LoginPage'
import AccessPending from './views/Login/AccessPending'
import SetPassword  from './views/Login/SetPassword'
import HubPage     from './views/Hub/HubPage'
import Dashboard   from './views/Dashboard/Dashboard'
import LoggingFlow from './views/Logging/LoggingFlow'
import RestockFlow from './views/Logging/RestockFlow'
import MyLogsView  from './views/Logging/MyLogsView'
import StockView   from './views/Stock/StockView'
import MixRatesView from './views/MixRates/MixRatesView'
import MyJobsView  from './views/Jobs/MyJobsView'
import ManagerPanel from './views/Manager/ManagerPanel'
import CRMShell   from './views/CRM/CRMShell'
import AdminShell  from './views/Admin/AdminShell'
import FleetShell  from './views/Fleet/FleetShell'

export default function App() {
  return (
    <Routes>
      {/* Guest-only */}
      <Route path="/login"        element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/access-pending" element={<AccessPending />} />
      <Route path="/set-password" element={<SetPassword />} />

      {/* Authenticated */}
      <Route path="/"            element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/hub"         element={<ProtectedRoute><HubPage /></ProtectedRoute>} />
      <Route path="/log"         element={<ProtectedRoute><LoggingFlow /></ProtectedRoute>} />
      <Route path="/my-logs"     element={<ProtectedRoute><MyLogsView /></ProtectedRoute>} />
      <Route path="/my-jobs"     element={<ProtectedRoute><MyJobsView /></ProtectedRoute>} />
      <Route path="/stock"       element={<ProtectedRoute><StockView /></ProtectedRoute>} />
      <Route path="/mix-rates"   element={<ProtectedRoute><MixRatesView /></ProtectedRoute>} />
      <Route path="/fleet/*"     element={<ManagerRoute><FleetShell /></ManagerRoute>} />

      {/* Manager-only */}
      <Route path="/restock"     element={<ManagerRoute><RestockFlow /></ManagerRoute>} />
      <Route path="/manager/*"   element={<ManagerRoute><ManagerPanel /></ManagerRoute>} />
      <Route path="/crm/*"       element={<ManagerRoute><CRMShell /></ManagerRoute>} />
      <Route path="/admin/*"     element={<ManagerRoute><AdminShell /></ManagerRoute>} />
    </Routes>
  )
}

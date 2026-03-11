import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute, ManagerRoute, GuestRoute } from './components/ProtectedRoute'
import LoginPage from './views/Login/LoginPage'
import SetPassword from './views/Login/SetPassword'
import AccessPending from './views/Login/AccessPending'
import Dashboard from './views/Dashboard/Dashboard'
import LoggingFlow from './views/Logging/LoggingFlow'
import RestockFlow from './views/Logging/RestockFlow'
import StockView from './views/Stock/StockView'
import MixRatesView from './views/MixRates/MixRatesView'
import ManagerPanel from './views/Manager/ManagerPanel'

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
          <Route path="/"           element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/log"        element={<ProtectedRoute><LoggingFlow /></ProtectedRoute>} />
          <Route path="/stock"      element={<ProtectedRoute><StockView /></ProtectedRoute>} />
          <Route path="/mix-rates"  element={<ProtectedRoute><MixRatesView /></ProtectedRoute>} />

          {/* Manager-only */}
          <Route path="/restock"   element={<ManagerRoute><RestockFlow /></ManagerRoute>} />
          <Route path="/manager/*" element={<ManagerRoute><ManagerPanel /></ManagerRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  )
}

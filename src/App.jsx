import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './views/Login/LoginPage'
import AccessPending from './views/Login/AccessPending'
import AppHub from './views/AppHub/AppHub'
import Dashboard from './views/Dashboard/Dashboard'
import LoggingFlow from './views/Logging/LoggingFlow'
import RestockFlow from './views/Logging/RestockFlow'
import MyLogsView from './views/Logging/MyLogsView'
import MyJobsView from './views/Jobs/MyJobsView'
import StockView from './views/Stock/StockView'
import MixRatesView from './views/MixRates/MixRatesView'
import ManagerPanel from './views/Manager/ManagerPanel'
import CRMShell from './views/CRM/CRMShell'
import FleetShell from './views/Fleet/FleetShell'

function ProtectedRoute({ children, reqManager = false }) {
  const { session, profile, isManager, loading } = useAuth()
  
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (profile?.role === 'pending') return <Navigate to="/access-pending" replace />
  if (reqManager && !isManager) return <Navigate to="/" replace />
  return children
}

function GuestRoute({ children }) {
  const { session, profile, loading } = useAuth()
  if (loading) return null
  if (session && profile?.role !== 'pending') return <Navigate to="/hub" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth Flow */}
          <Route path="/login"          element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/access-pending" element={<AccessPending />} />

          {/* New Central Hub */}
          <Route path="/hub"            element={<ProtectedRoute><AppHub /></ProtectedRoute>} />

          {/* Legacy Inventory Module (Now under root for quick access from the hub) */}
          <Route path="/"           element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/log"        element={<ProtectedRoute><LoggingFlow /></ProtectedRoute>} />
          <Route path="/my-logs"    element={<ProtectedRoute><MyLogsView /></ProtectedRoute>} />
          <Route path="/my-jobs"    element={<ProtectedRoute><MyJobsView /></ProtectedRoute>} />
          <Route path="/stock"      element={<ProtectedRoute><StockView /></ProtectedRoute>} />
          <Route path="/mix-rates"  element={<ProtectedRoute><MixRatesView /></ProtectedRoute>} />
          <Route path="/fleet/*"    element={<ProtectedRoute><FleetShell /></ProtectedRoute>} />
          
          <Route path="/restock"    element={<ProtectedRoute reqManager><RestockFlow /></ProtectedRoute>} />
          <Route path="/manager/*"  element={<ProtectedRoute reqManager><ManagerPanel /></ProtectedRoute>} />
          
          {/* New CRM Module */}
          <Route path="/crm/*"      element={<ProtectedRoute><CRMShell /></ProtectedRoute>} />
          
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

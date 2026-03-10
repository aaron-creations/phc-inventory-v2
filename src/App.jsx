import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './views/Dashboard/Dashboard'
import LoggingFlow from './views/Logging/LoggingFlow'
import StockView from './views/Stock/StockView'
import MixRatesView from './views/MixRates/MixRatesView'
import ManagerLogin from './views/Manager/ManagerLogin'
import ManagerPanel from './views/Manager/ManagerPanel'

export default function App() {
  return (
    <div className="min-h-screen bg-forest-950">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/log/:techId" element={<LoggingFlow />} />
        <Route path="/stock" element={<StockView />} />
        <Route path="/mix-rates" element={<MixRatesView />} />
        <Route path="/manager/login" element={<ManagerLogin />} />
        <Route path="/manager/*" element={<ManagerPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

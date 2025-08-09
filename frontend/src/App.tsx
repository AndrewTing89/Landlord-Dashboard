import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Ledger from './pages/Ledger';
import Transactions from './pages/Transactions';
import PaymentRequests from './pages/PaymentRequests';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import MaintenanceTickets from './pages/MaintenanceTickets';
import Review from './pages/Review';
import SyncManagement from './pages/SyncManagement';
import PaymentTrackingSimpleCards from './pages/PaymentTrackingSimpleCards';
import EmailSyncManagement from './pages/EmailSyncManagement';
import HealthCheck from './pages/HealthCheck';

function App() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="review" element={<Review />} />
          <Route path="payment-tracking" element={<PaymentTrackingSimpleCards />} />
          <Route path="payments" element={<PaymentRequests />} />
          <Route path="maintenance" element={<MaintenanceTickets />} />
          <Route path="reports" element={<Reports />} />
          <Route path="sync" element={<SyncManagement />} />
          <Route path="email-sync" element={<EmailSyncManagement />} />
          <Route path="health" element={<HealthCheck />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Box>
  );
}

export default App;
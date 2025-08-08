import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Ledger from './pages/Ledger';
import Transactions from './pages/Transactions';
import PaymentRequests from './pages/PaymentRequests';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Trends from './pages/Trends';
import Review from './pages/Review';
import SyncManagement from './pages/SyncManagement';
import PaymentTrackingSimpleCards from './pages/PaymentTrackingSimpleCards';
import EmailSyncManagement from './pages/EmailSyncManagement';
import HealthCheck from './pages/HealthCheck';

// Lazy load tenant portal
const TenantApp = lazy(() => import('./tenant/App'));

function App() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Routes>
        {/* Tenant Portal Routes */}
        <Route path="/tenant/*" element={
          <Suspense fallback={<div>Loading Tenant Portal...</div>}>
            <TenantApp />
          </Suspense>
        } />
        
        {/* Landlord Dashboard Routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="review" element={<Review />} />
          <Route path="payment-tracking" element={<PaymentTrackingSimpleCards />} />
          <Route path="payments" element={<PaymentRequests />} />
          <Route path="reports" element={<Reports />} />
          <Route path="trends" element={<Trends />} />
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
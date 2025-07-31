import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import PaymentRequests from './pages/PaymentRequests';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Trends from './pages/Trends';
import Review from './pages/Review';
import VenmoTracking from './pages/VenmoTracking';
import SyncManagement from './pages/SyncManagement';
import EmailReview from './pages/EmailReview';
import PaymentTracking from './pages/PaymentTracking';
import PaymentTrackingFixed from './pages/PaymentTrackingFixed';
import PaymentTrackingMinimal from './pages/PaymentTrackingMinimal';
import PaymentTrackingSafe from './pages/PaymentTrackingSafe';
import PaymentTrackingDebug from './pages/PaymentTrackingDebug';
import PaymentTrackingGradual from './pages/PaymentTrackingGradual';
import PaymentTrackingSimpleCards from './pages/PaymentTrackingSimpleCards';
import EmailSyncManagement from './pages/EmailSyncManagement';
import VenmoEmailTracker from './pages/VenmoEmailTracker';

function App() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="review" element={<Review />} />
          <Route path="payment-tracking" element={<PaymentTrackingSimpleCards />} />
          <Route path="payments" element={<PaymentRequests />} />
          <Route path="venmo" element={<VenmoTracking />} />
          <Route path="email-review" element={<EmailReview />} />
          <Route path="venmo-email-tracker" element={<VenmoEmailTracker />} />
          <Route path="reports" element={<Reports />} />
          <Route path="trends" element={<Trends />} />
          <Route path="sync" element={<SyncManagement />} />
          <Route path="email-sync" element={<EmailSyncManagement />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Box>
  );
}

export default App;
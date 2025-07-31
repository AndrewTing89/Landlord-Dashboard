import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';

const PaymentTrackingSimple: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('PaymentTracking component mounted');
    
    // Simple test to see if component loads
    setTimeout(() => {
      setLoading(false);
      console.log('Loading complete');
    }, 1000);
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4">Payment Tracking (Debug)</Typography>
      <Alert severity="info" sx={{ mt: 2 }}>
        Component loaded successfully! Check console for errors.
      </Alert>
    </Container>
  );
};

export default PaymentTrackingSimple;
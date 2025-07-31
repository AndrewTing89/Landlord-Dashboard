import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Alert } from '@mui/material';
import axios from 'axios';

const PaymentTrackingDebug: React.FC = () => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Component mounted');
    setStep(1);
    
    const loadData = async () => {
      try {
        console.log('Starting data fetch...');
        setStep(2);
        
        const response = await axios.get('/api/payment-requests');
        console.log('API response:', response);
        setStep(3);
        
        setData(response.data);
        setStep(4);
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message);
        setStep(99);
      }
    };
    
    loadData();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4">Payment Tracking Debug</Typography>
      
      <Box mt={2}>
        <Alert severity="info">
          Debug Step: {step}
          <br />
          0 = Initial render
          <br />
          1 = Component mounted
          <br />
          2 = Starting fetch
          <br />
          3 = Data received
          <br />
          4 = Data set
          <br />
          99 = Error occurred
        </Alert>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Error: {error}
          </Alert>
        )}
        
        {data && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Data loaded! Count: {data.length}
          </Alert>
        )}
      </Box>
    </Container>
  );
};

export default PaymentTrackingDebug;
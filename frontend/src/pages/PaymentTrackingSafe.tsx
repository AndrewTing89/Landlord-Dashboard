import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Button,
  Chip,
  Stack
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Send as SendIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';
import axios from 'axios';

const PaymentTrackingSafe: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>({
    paymentRequests: [],
    venmoEmails: [],
    stats: {}
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch payment requests
      const requestsRes = await axios.get('/api/payment-requests');
      const paymentRequests = requestsRes.data || [];
      
      // Fetch venmo emails
      const emailsRes = await axios.get('/api/venmo-requests');
      const venmoEmails = emailsRes.data || [];
      
      setData({
        paymentRequests,
        venmoEmails,
        stats: {}
      });
      
    } catch (error: any) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const syncGmail = async () => {
    try {
      const response = await axios.post('/api/gmail/sync');
      console.log('Gmail sync response:', response.data);
      fetchData();
    } catch (error) {
      console.error('Error syncing Gmail:', error);
    }
  };

  useEffect(() => {
    fetchData();
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Payment Tracking</Typography>
        <Stack direction="row" spacing={2}>
          <Button 
            onClick={syncGmail} 
            startIcon={<MoneyIcon />}
            variant="contained"
            color="primary"
          >
            Sync Gmail
          </Button>
          <Button 
            onClick={fetchData} 
            startIcon={<RefreshIcon />}
            variant="outlined"
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Summary Stats */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Venmo Emails
              </Typography>
              <Typography variant="h3">
                {data.venmoEmails.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Requests
              </Typography>
              <Typography variant="h3">
                {data.paymentRequests.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Venmo Emails */}
      <Box mt={4}>
        <Typography variant="h5" gutterBottom>
          Recent Venmo Activity
        </Typography>
        <Grid container spacing={3}>
          {data.venmoEmails.length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">No Venmo emails found. Click "Sync Gmail" to check for new emails.</Alert>
            </Grid>
          ) : (
            data.venmoEmails.map((email: any) => (
              <Grid item xs={12} md={6} key={email.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    borderLeft: 4,
                    borderColor: email.email_type === 'payment_received' ? 'success.main' : 'info.main'
                  }}
                >
                  <CardContent>
                    <Stack spacing={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Chip
                          icon={email.email_type === 'payment_received' ? <CheckCircleIcon /> : <SendIcon />}
                          label={email.email_type === 'payment_received' ? 'Payment Received' : 'Request Sent'}
                          color={email.email_type === 'payment_received' ? 'success' : 'info'}
                          size="small"
                        />
                        {email.matched && (
                          <Chip 
                            label="Matched" 
                            size="small" 
                            variant="outlined" 
                            color="success" 
                          />
                        )}
                      </Box>

                      <Box>
                        <Typography variant="h5" component="div" gutterBottom>
                          ${email.venmo_amount ? email.venmo_amount.toFixed(2) : '0.00'}
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          {email.email_type === 'payment_received' ? 'From' : 'To'}: {email.venmo_actor}
                        </Typography>
                      </Box>

                      {email.venmo_note && (
                        <Typography variant="body2" color="text.secondary">
                          Note: {email.venmo_note}
                        </Typography>
                      )}

                      <Typography variant="caption" color="text.secondary">
                        {new Date(email.received_date).toLocaleDateString()}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </Box>
    </Container>
  );
};

export default PaymentTrackingSafe;
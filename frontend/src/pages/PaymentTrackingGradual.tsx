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
  AttachMoney as MoneyIcon,
  CheckCircle as CheckCircleIcon,
  Send as SendIcon
} from '@mui/icons-material';
import axios from 'axios';

const PaymentTrackingGradual: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>({
    paymentRequests: [],
    venmoEmails: []
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const requestsRes = await axios.get('/api/payment-requests');
      const emailsRes = await axios.get('/api/venmo-requests');
      
      setData({
        paymentRequests: requestsRes.data || [],
        venmoEmails: emailsRes.data || []
      });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <Container>
        <Box p={4}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Payment Tracking
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Box mt={3}>
        <Typography variant="h6">
          Payment Requests: {data.paymentRequests.length}
        </Typography>
        <Typography variant="h6">
          Venmo Emails: {data.venmoEmails.length}
        </Typography>
      </Box>

      {/* Nice Venmo Email Cards */}
      <Box mt={4}>
        <Typography variant="h5" gutterBottom>
          Recent Venmo Activity
        </Typography>
        <Grid container spacing={3}>
          {data.venmoEmails.length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">No Venmo emails found.</Alert>
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
                      {/* Header with type and status */}
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

                      {/* Amount and Actor */}
                      <Box>
                        <Typography variant="h5" component="div" gutterBottom>
                          ${email.venmo_amount ? email.venmo_amount.toFixed(2) : '0.00'}
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          {email.email_type === 'payment_received' ? 'From' : 'To'}: {email.venmo_actor || 'Unknown'}
                        </Typography>
                      </Box>

                      {/* Note if available */}
                      {email.venmo_note && (
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Note: {email.venmo_note}
                          </Typography>
                        </Box>
                      )}

                      {/* Date */}
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

export default PaymentTrackingGradual;
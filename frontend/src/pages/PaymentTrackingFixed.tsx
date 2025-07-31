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
  Stack,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as PendingIcon,
  Send as SendIcon,
  Link as LinkIcon,
  ContentCopy as CopyIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';

const PaymentTrackingFixed: React.FC = () => {
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
      // Show success message if needed
      console.log('Gmail sync response:', response.data);
      // Refresh data after sync
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

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Requests
              </Typography>
              <Typography variant="body1">
                Total: {data.paymentRequests.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Venmo Emails
              </Typography>
              <Typography variant="body1">
                Total: {data.venmoEmails.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Venmo Emails as Cards */}
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
                          {email.email_type === 'payment_received' ? 'From' : 'To'}: {email.venmo_actor}
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
                        {format(new Date(email.received_date), 'MMM d, yyyy h:mm a')}
                      </Typography>

                      {/* Bill info if matched */}
                      {email.matched && email.bill_type && (
                        <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary">
                            Matched to: {email.bill_type} bill ({email.bill_month}/{email.bill_year})
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </Box>

      {/* Payment Requests as Cards */}
      <Box mt={4}>
        <Typography variant="h5" gutterBottom>
          Payment Requests
        </Typography>
        <Grid container spacing={3}>
          {data.paymentRequests.length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">No payment requests found.</Alert>
            </Grid>
          ) : (
            data.paymentRequests.map((req: any) => (
              <Grid item xs={12} md={6} key={req.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    borderLeft: 4,
                    borderColor: 
                      req.status === 'paid' ? 'success.main' : 
                      req.status === 'sent' ? 'info.main' : 
                      'warning.main'
                  }}
                >
                  <CardContent>
                    <Stack spacing={2}>
                      {/* Header with status */}
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Chip
                          icon={
                            req.status === 'paid' ? <CheckCircleIcon /> : 
                            req.status === 'sent' ? <SendIcon /> : 
                            <PendingIcon />
                          }
                          label={req.status}
                          color={
                            req.status === 'paid' ? 'success' : 
                            req.status === 'sent' ? 'info' : 
                            'warning'
                          }
                          size="small"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {req.bill_type === 'electricity' ? '⚡' : '💧'} {req.bill_type}
                        </Typography>
                      </Box>

                      {/* Amount and Roommate */}
                      <Box>
                        <Typography variant="h5" component="div" gutterBottom>
                          ${req.amount}
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          {req.roommate_name}
                        </Typography>
                      </Box>

                      {/* Bill Period */}
                      <Typography variant="body2" color="text.secondary">
                        Bill period: {req.month}/{req.year}
                      </Typography>

                      {/* Date */}
                      <Typography variant="caption" color="text.secondary">
                        Created: {format(new Date(req.request_date), 'MMM d, yyyy')}
                      </Typography>

                      {/* Venmo Link */}
                      {req.venmo_link && req.status !== 'paid' && (
                        <Box display="flex" gap={1} mt={1}>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<LinkIcon />}
                            href={req.venmo_link}
                            target="_blank"
                            fullWidth
                          >
                            Open in Venmo
                          </Button>
                          <Tooltip title="Copy link">
                            <IconButton
                              size="small"
                              onClick={() => navigator.clipboard.writeText(req.venmo_link)}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
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

export default PaymentTrackingFixed;
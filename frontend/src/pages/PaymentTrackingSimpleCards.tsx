import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Button,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import { 
  AttachMoney as MoneyIcon,
  ContentCopy as CopyIcon,
  Link as LinkIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as PendingIcon,
  Send as SendIcon
} from '@mui/icons-material';
import axios from 'axios';

const PaymentTrackingSimpleCards: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>({
    paymentRequests: [],
    venmoEmails: []
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    request: any | null;
  }>({ open: false, request: null });

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

  const syncGmail = async () => {
    try {
      await axios.post('/api/gmail/sync');
      fetchData();
    } catch (error) {
      console.error('Error syncing Gmail:', error);
    }
  };

  const handleMarkAsPaidClick = (request: any) => {
    setConfirmDialog({ open: true, request });
  };

  const confirmMarkAsPaid = async () => {
    if (!confirmDialog.request) return;
    
    try {
      await axios.post(`/api/payment-requests/${confirmDialog.request.id}/mark-paid`);
      setConfirmDialog({ open: false, request: null });
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error marking as paid:', error);
      setError('Failed to mark as paid');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Payment Tracking</Typography>
        <Button 
          onClick={syncGmail} 
          startIcon={<MoneyIcon />}
          variant="contained"
          color="primary"
        >
          Sync Gmail
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Venmo Emails - Grouped by Month */}
      <Box mt={4}>
        <Typography variant="h5" gutterBottom>
          Recent Venmo Activity ({data.venmoEmails.length})
        </Typography>
        
        {/* Group emails by month */}
        {(() => {
          // Group emails by month/year
          const groupedEmails = data.venmoEmails.reduce((groups: any, email: any) => {
            const date = new Date(email.received_date);
            const monthYear = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
            if (!groups[monthYear]) {
              groups[monthYear] = [];
            }
            groups[monthYear].push(email);
            return groups;
          }, {});

          // Sort months in reverse chronological order
          const sortedMonths = Object.keys(groupedEmails).sort((a, b) => {
            const dateA = new Date(a);
            const dateB = new Date(b);
            return dateB.getTime() - dateA.getTime();
          });

          return sortedMonths.map(monthYear => (
            <Box key={monthYear} mb={4}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {monthYear}
              </Typography>
              <Stack spacing={2}>
                {groupedEmails[monthYear].map((email: any) => (
                  <Card key={email.id} sx={{ borderLeft: 4, borderColor: email.email_type === 'payment_received' ? 'success.main' : 'info.main' }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start">
                        <Box>
                          <Typography variant="h6">
                            ${email.venmo_amount || 0}
                          </Typography>
                          <Typography color="text.secondary">
                            {email.email_type === 'payment_received' ? 'From' : 'To'}: {email.venmo_actor || 'Unknown'}
                          </Typography>
                          {email.venmo_note && (
                            <Typography variant="body2" color="text.secondary" mt={1}>
                              {email.venmo_note}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary" mt={1}>
                            {new Date(email.received_date).toLocaleDateString()} at {new Date(email.received_date).toLocaleTimeString()}
                          </Typography>
                        </Box>
                        <Stack spacing={1} alignItems="flex-end">
                          <Chip 
                            label={email.email_type === 'payment_received' ? 'Received' : 'Sent'} 
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
                        </Stack>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          ));
        })()}
      </Box>

      {/* Payment Requests - Also grouped by month */}
      <Box mt={4}>
        <Typography variant="h5" gutterBottom>
          Payment Requests ({data.paymentRequests.length})
        </Typography>
        
        {(() => {
          // Group requests by month/year based on bill period
          const groupedRequests = data.paymentRequests.reduce((groups: any, request: any) => {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const monthYear = `${monthNames[request.month - 1]} ${request.year}`;
            if (!groups[monthYear]) {
              groups[monthYear] = [];
            }
            groups[monthYear].push(request);
            return groups;
          }, {});

          // Sort months in reverse chronological order
          const sortedMonths = Object.keys(groupedRequests).sort((a, b) => {
            const dateA = new Date(a);
            const dateB = new Date(b);
            return dateB.getTime() - dateA.getTime();
          });

          return sortedMonths.map(monthYear => (
            <Box key={monthYear} mb={4}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {monthYear} Bills
              </Typography>
              <Stack spacing={2}>
                {groupedRequests[monthYear].map((request: any) => (
                  <Card key={request.id} sx={{ 
                    borderLeft: 4, 
                    borderColor: 
                      request.status === 'paid' ? 'success.main' : 
                      request.status === 'sent' ? 'info.main' : 
                      'warning.main'
                  }}>
                    <CardContent>
                      <Stack spacing={2}>
                        {/* Header with status and bill type */}
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Chip
                            icon={
                              request.status === 'paid' ? <CheckCircleIcon /> : 
                              request.status === 'sent' ? <SendIcon /> : 
                              <PendingIcon />
                            }
                            label={request.status}
                            color={
                              request.status === 'paid' ? 'success' : 
                              request.status === 'sent' ? 'info' : 
                              'warning'
                            }
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {request.bill_type === 'electricity' ? '⚡' : '💧'} {request.bill_type}
                          </Typography>
                        </Box>

                        {/* Amount and Roommate */}
                        <Box>
                          <Typography variant="h5" component="div" gutterBottom>
                            ${request.amount}
                          </Typography>
                          <Typography variant="body1" color="text.secondary">
                            {request.roommate_name}
                          </Typography>
                          {request.venmo_username && (
                            <Typography variant="body2" color="text.secondary">
                              @{request.venmo_username}
                            </Typography>
                          )}
                        </Box>

                        {/* Dates */}
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Created: {new Date(request.request_date).toLocaleDateString()}
                          </Typography>
                          {request.charge_date && (
                            <Typography variant="caption" color="success.main" display="block">
                              Paid: {new Date(request.charge_date).toLocaleDateString()}
                            </Typography>
                          )}
                        </Box>

                        {/* Action Buttons */}
                        {request.status !== 'paid' && (
                          <Stack direction="row" spacing={1}>
                            {request.venmo_link && (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<LinkIcon />}
                                  href={request.venmo_link}
                                  target="_blank"
                                  fullWidth
                                >
                                  Open in Venmo
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => copyToClipboard(request.venmo_link)}
                                  sx={{ minWidth: 'auto', px: 1 }}
                                >
                                  <CopyIcon fontSize="small" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              onClick={() => handleMarkAsPaidClick(request)}
                              startIcon={<CheckCircleIcon />}
                            >
                              Mark Paid
                            </Button>
                          </Stack>
                        )}

                        {/* Reminder count if any */}
                        {request.reminder_count > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            Reminders sent: {request.reminder_count}
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          ));
        })()}
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, request: null })}
      >
        <DialogTitle>Confirm Payment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to mark this payment as paid?
            <Box mt={2}>
              <Typography variant="body2">
                <strong>Roommate:</strong> {confirmDialog.request?.roommate_name}
              </Typography>
              <Typography variant="body2">
                <strong>Amount:</strong> ${confirmDialog.request?.amount}
              </Typography>
              <Typography variant="body2">
                <strong>Bill:</strong> {confirmDialog.request?.bill_type} ({confirmDialog.request?.month}/{confirmDialog.request?.year})
              </Typography>
            </Box>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, request: null })}>
            Cancel
          </Button>
          <Button onClick={confirmMarkAsPaid} color="success" variant="contained">
            Confirm Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PaymentTrackingSimpleCards;
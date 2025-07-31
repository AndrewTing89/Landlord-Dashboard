import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Launch as LaunchIcon,
  Refresh as RefreshIcon,
  Email as EmailIcon,
  Send as SendIcon,
  Done as DoneIcon,
  Sms as SmsIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { apiService } from '../services/api';
import { PaymentRequest } from '../types';

export default function PaymentRequests() {
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [checkingEmails, setCheckingEmails] = useState(false);
  const [sendingSmsId, setSendingSmsId] = useState<number | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [requestToMarkPaid, setRequestToMarkPaid] = useState<PaymentRequest | null>(null);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchPaymentRequests();
  }, []);

  const fetchPaymentRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getPaymentRequests();
      setPaymentRequests(response.data);
    } catch (err) {
      console.error('Error fetching payment requests:', err);
      setError('Failed to load payment requests');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVenmo = (request: PaymentRequest) => {
    if (isMobile) {
      // On mobile, directly open the Venmo app
      window.location.href = request.venmo_link;
    } else {
      // On desktop, show instructions
      setSelectedRequest(request);
      setDialogOpen(true);
    }
  };

  const handleCopyLink = async (request: PaymentRequest) => {
    try {
      await navigator.clipboard.writeText(request.venmo_link);
      setCopiedId(request.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCheckEmails = async () => {
    try {
      setCheckingEmails(true);
      const response = await apiService.checkPaymentEmails();
      if (response.data.success) {
        // Refresh payment requests to show any updates
        await fetchPaymentRequests();
      }
    } catch (err) {
      console.error('Error checking emails:', err);
      setError('Failed to check payment emails');
    } finally {
      setCheckingEmails(false);
    }
  };

  const handleMarkPaidClick = (request: PaymentRequest) => {
    setRequestToMarkPaid(request);
    setConfirmDialogOpen(true);
  };

  const handleConfirmMarkPaid = async () => {
    if (!requestToMarkPaid) return;
    
    // Save current scroll position
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    
    try {
      await apiService.markPaymentPaid(requestToMarkPaid.id);
      await fetchPaymentRequests();
      setConfirmDialogOpen(false);
      setRequestToMarkPaid(null);
      
      // Restore scroll position after state update
      setTimeout(() => {
        window.scrollTo({
          top: scrollPosition,
          behavior: 'instant'
        });
      }, 0);
    } catch (err) {
      console.error('Error marking payment as paid:', err);
      setError('Failed to mark payment as paid');
    }
  };

  const handleCancelMarkPaid = () => {
    setConfirmDialogOpen(false);
    setRequestToMarkPaid(null);
  };
  
  const handleSendSMS = async (request: PaymentRequest) => {
    try {
      setSendingSmsId(request.id);
      const response = await apiService.sendPaymentSMS(request.id);
      if (response.data.success) {
        // Show success message
        setCopiedId(request.id);
        setTimeout(() => setCopiedId(null), 3000);
        // Refresh the list to show updated status
        fetchPaymentRequests();
      }
    } catch (err) {
      console.error('Error sending SMS:', err);
      setError('Failed to send to Discord. Make sure webhook is configured.');
    } finally {
      setSendingSmsId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'default' => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'sent':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getBillTypeChip = (type: string | null) => {
    if (!type) {
      return (
        <Chip
          label="Unknown"
          color="default"
          size="small"
        />
      );
    }
    if (type === 'electricity') {
      return (
        <Chip
          label="Electricity"
          size="small"
          sx={{ 
            backgroundColor: '#D4A017',
            color: 'white',
            fontWeight: 500
          }}
        />
      );
    }
    return (
      <Chip
        label="Water"
        color="info"
        size="small"
      />
    );
  };

  // Group requests by month
  const groupedRequests = paymentRequests.reduce((acc, request) => {
    // Use the bill's month/year for grouping
    const year = request.year;
    const month = request.month;
    
    // Skip if no month/year data
    if (!year || !month) {
      console.warn('Payment request missing month/year:', request);
      return acc;
    }
    
    const key = `${year}-${month.toString().padStart(2, '0')}`; // Pad month for proper sorting
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(request);
    return acc;
  }, {} as Record<string, PaymentRequest[]>);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Payment Requests</Typography>
        <Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={checkingEmails ? <CircularProgress size={16} /> : <EmailIcon />}
            onClick={handleCheckEmails}
            disabled={checkingEmails}
            sx={{ mr: 1 }}
          >
            Check Emails
          </Button>
          <IconButton onClick={fetchPaymentRequests}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {isMobile && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Tap the payment buttons to open requests directly in Venmo!
        </Alert>
      )}

      {paymentRequests.some(r => r.status === 'pending') && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Payments are automatically checked twice daily (9 AM & 6 PM). 
            You can also use the "Check Emails" button to check manually anytime.
          </Typography>
        </Alert>
      )}

      {Object.entries(groupedRequests).length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="textSecondary" align="center">
              No payment requests found. They will appear here after utility bills are processed.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedRequests)
          .sort((a, b) => {
            // Sort by year-month in descending order
            const [yearA, monthA] = a[0].split('-').map(Number);
            const [yearB, monthB] = b[0].split('-').map(Number);
            
            if (yearB !== yearA) {
              return yearB - yearA;
            }
            return monthB - monthA;
          })
          .map(([monthKey, requests]) => {
            const [year, month] = monthKey.split('-');
            const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy');
            
            return (
              <Card key={monthKey} sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {monthName}
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {requests.map((request) => (
                      <Grid item xs={12} sm={6} md={4} key={request.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                              <Box>
                                <Typography variant="body2" color="textSecondary">
                                  {request.roommate_name}
                                </Typography>
                                <Typography variant="h5">
                                  {formatCurrency(request.amount)}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  of {formatCurrency(request.bill_total_amount || 0)} total
                                </Typography>
                              </Box>
                              <Chip
                                label={request.status}
                                color={getStatusColor(request.status)}
                                size="small"
                                icon={request.status === 'paid' ? <CheckCircleIcon /> : <ScheduleIcon />}
                              />
                            </Box>
                            
                            <Box mb={1}>
                              <Typography variant="subtitle2" gutterBottom>
                                {request.company_name || request.merchant_name || request.bill_type}
                              </Typography>
                              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mb={1}>
                                {getBillTypeChip(request.bill_type)}
                              </Box>
                              <Typography variant="body2" color="textSecondary">
                                Bill Date: <strong>{request.charge_date ? format(new Date(request.charge_date), 'MMM dd, yyyy') : 'N/A'}</strong>
                              </Typography>
                              {request.status === 'paid' && request.paid_date && (
                                <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                                  Paid on: {format(new Date(request.paid_date), 'MMM dd, yyyy')}
                                </Typography>
                              )}
                            </Box>
                            
                            {request.status === 'pending' && (
                              <Box sx={{ mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  Status: Payment requested
                                </Typography>
                                {request.due_date && (
                                  <Typography variant="body2" color="error">
                                    Due: {format(new Date(request.due_date), 'MMM dd, yyyy')}
                                  </Typography>
                                )}
                              </Box>
                            )}
                            
                            <Box display="flex" gap={1}>
                              <Button
                                variant="contained"
                                size="small"
                                fullWidth
                                startIcon={sendingSmsId === request.id ? <CircularProgress size={16} /> : <SendIcon />}
                                onClick={() => handleSendSMS(request)}
                                disabled={request.status === 'paid' || sendingSmsId === request.id}
                                sx={{ backgroundColor: '#5865F2', '&:hover': { backgroundColor: '#4752C4' } }}
                              >
                                {sendingSmsId === request.id ? 'Sending...' : 'Send to Discord'}
                              </Button>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenVenmo(request)}
                                disabled={request.status === 'paid'}
                                title="Open in Venmo"
                              >
                                <LaunchIcon />
                              </IconButton>
                              {request.status !== 'paid' && (
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => handleMarkPaidClick(request)}
                                  title="Mark as paid manually"
                                  sx={{ minWidth: 'auto', px: 1 }}
                                >
                                  Paid
                                </Button>
                              )}
                              <IconButton
                                size="small"
                                onClick={() => handleCopyLink(request)}
                                disabled={request.status === 'paid'}
                              >
                                {copiedId === request.id ? <CheckCircleIcon /> : <CopyIcon />}
                              </IconButton>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            );
          })
      )}

      {/* Desktop instruction dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Venmo Payment Request</DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            To complete this payment request on desktop:
          </Typography>
          
          <List>
            <ListItem>
              <ListItemText 
                primary="1. Open Venmo on your phone"
                secondary="Make sure you're logged in to your account"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="2. Copy the payment link"
                secondary="Click the copy button below"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="3. Send the link to yourself"
                secondary="Text or email it to your phone"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="4. Open the link on your phone"
                secondary="This will open the payment request in Venmo"
              />
            </ListItem>
          </List>
          
          {selectedRequest && (
            <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Payment Details:
              </Typography>
              <Typography variant="body1">
                {selectedRequest.roommate_name} - {formatCurrency(selectedRequest.amount)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {selectedRequest.bill_type} bill for {format(new Date(selectedRequest.year, selectedRequest.month - 1), 'MMMM yyyy')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          {selectedRequest && (
            <Button
              variant="contained"
              onClick={() => handleCopyLink(selectedRequest)}
              startIcon={<CopyIcon />}
            >
              Copy Link
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Confirmation dialog for marking as paid */}
      <Dialog 
        open={confirmDialogOpen} 
        onClose={handleCancelMarkPaid} 
        maxWidth="xs" 
        fullWidth
      >
        <DialogTitle>Confirm Payment Received</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to mark this payment as paid?
          </Typography>
          {requestToMarkPaid && (
            <Box mt={2}>
              <Typography variant="body2" color="textSecondary">
                {requestToMarkPaid.company_name || requestToMarkPaid.bill_type}
              </Typography>
              <Typography variant="h6">
                {formatCurrency(requestToMarkPaid.amount)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                From: {requestToMarkPaid.roommate_name}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelMarkPaid} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmMarkPaid} 
            variant="contained" 
            color="primary"
          >
            Confirm Paid
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
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
  Tabs,
  Tab,
  Badge,
  Drawer,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  StepIconProps,
  styled,
  stepConnectorClasses,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  Payment as PaymentIcon,
  History as HistoryIcon,
  LinkOff as LinkOffIcon,
  Timeline as TimelineIcon,
  Close as CloseIcon,
  List as ListIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { apiService } from '../services/api';
import { PaymentRequest } from '../types';
import axios from 'axios';
import config from '../config';

interface VenmoEmail {
  id: number;
  gmail_message_id: string;
  email_type: 'payment_received' | 'request_sent' | 'request_reminder' | 'request_cancelled';
  subject: string;
  venmo_actor: string;
  venmo_amount: number;
  venmo_note?: string;
  received_date: string;
  matched: boolean;
  payment_request_id?: number;
  tracking_id?: string;
}

// Custom styled components for status stepper
const StatusConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 10,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundColor: theme.palette.primary.main,
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundColor: theme.palette.primary.main,
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 2,
    border: 0,
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#eaeaf0',
    borderRadius: 1,
  },
}));

export default function PaymentRequests() {
  const [tabValue, setTabValue] = useState(0);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [allEmails, setAllEmails] = useState<VenmoEmail[]>([]);
  const [unmatchedEmails, setUnmatchedEmails] = useState<VenmoEmail[]>([]);
  const [emailsByRequest, setEmailsByRequest] = useState<Record<number, VenmoEmail[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [checkingEmails, setCheckingEmails] = useState(false);
  const [emailMatchDialogOpen, setEmailMatchDialogOpen] = useState(false);
  const [selectedEmailMatch, setSelectedEmailMatch] = useState<{request: PaymentRequest; emails: VenmoEmail[]} | null>(null);
  const [sendingSmsId, setSendingSmsId] = useState<number | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [requestToMarkPaid, setRequestToMarkPaid] = useState<PaymentRequest | null>(null);
  const [foregoneDialogOpen, setForegoneDialogOpen] = useState(false);
  const [requestToForego, setRequestToForego] = useState<PaymentRequest | null>(null);
  
  // Database view state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [timelineDrawerOpen, setTimelineDrawerOpen] = useState(false);
  const [selectedTimelineRequest, setSelectedTimelineRequest] = useState<PaymentRequest | null>(null);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchAllData();
    
    // Check if we should open the unmatched tab
    const shouldOpenUnmatched = sessionStorage.getItem('openUnmatchedTab');
    if (shouldOpenUnmatched === 'true') {
      // Set tab to index 2 (Unmatched tab)
      setTabValue(2);
      // Clear the flag
      sessionStorage.removeItem('openUnmatchedTab');
    }
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all data in parallel
      const [requestsRes, emailsRes, unmatchedRes] = await Promise.all([
        apiService.getPaymentRequests(),
        axios.get(`${config.api.baseURL}/api/venmo-emails`),
        axios.get(`${config.api.baseURL}/api/gmail/unmatched`)
      ]);

      const requests = requestsRes.data || [];
      const emails = emailsRes.data || [];
      const unmatched = unmatchedRes.data?.data || [];

      setPaymentRequests(requests);
      setAllEmails(emails);
      setUnmatchedEmails(unmatched);

      // Group emails by payment request
      const emailsMap: Record<number, VenmoEmail[]> = {};
      emails.forEach((email: VenmoEmail) => {
        if (email.payment_request_id) {
          if (!emailsMap[email.payment_request_id]) {
            emailsMap[email.payment_request_id] = [];
          }
          emailsMap[email.payment_request_id].push(email);
        }
      });
      setEmailsByRequest(emailsMap);
    } catch (err) {
      console.error('Error fetching payment requests:', err);
      setError('Failed to load payment requests');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVenmo = (request: PaymentRequest) => {
    // Simple approach - just open the link in a new tab
    // The /u/ format works on both mobile and desktop
    window.open(request.venmo_link, '_blank');
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
        await fetchAllData();
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

  const handleForegoClick = (request: PaymentRequest) => {
    setRequestToForego(request);
    setForegoneDialogOpen(true);
  };

  const handleConfirmMarkPaid = async () => {
    if (!requestToMarkPaid) return;
    
    // Save current scroll position
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    
    try {
      await apiService.markPaymentPaid(requestToMarkPaid.id);
      await fetchAllData();
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

  const handleConfirmForego = async () => {
    if (!requestToForego) return;
    
    const scrollPosition = window.pageYOffset;
    
    try {
      await apiService.foregoPayment(requestToForego.id);
      await fetchAllData();
      setForegoneDialogOpen(false);
      setRequestToForego(null);
      
      // Restore scroll position
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 100);
    } catch (error: any) {
      console.error('Error foregoing payment:', error);
      alert(`Error foregoing payment: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleCancelForego = () => {
    setForegoneDialogOpen(false);
    setRequestToForego(null);
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
        fetchAllData();
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

  const getStatusColor = (status: string): 'success' | 'warning' | 'default' | 'error' => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'sent':
        return 'warning';
      case 'foregone':
        return 'error';
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
    if (type === 'water') {
      return (
        <Chip
          label="Water"
          size="small"
          sx={{ 
            backgroundColor: '#9C27B0',
            color: 'white',
            fontWeight: 500
          }}
        />
      );
    }
    if (type === 'rent') {
      return (
        <Chip
          label="Rent"
          size="small"
          sx={{ 
            backgroundColor: '#4CAF50',
            color: 'white',
            fontWeight: 500
          }}
        />
      );
    }
    return (
      <Chip
        label={type}
        color="default"
        size="small"
      />
    );
  };

  // Get payment status steps based on emails
  const getPaymentStatus = (request: PaymentRequest) => {
    const hasRequestSent = request.status === 'sent';
    const hasPaymentReceived = request.status === 'paid';
    
    const steps = [
      { 
        label: 'Record Created',
        completed: true,
        active: request.status === 'pending'
      },
      { 
        label: hasRequestSent ? 'Request: Sent' : 'Request: Pending',
        completed: hasRequestSent || hasPaymentReceived,
        active: hasRequestSent && !hasPaymentReceived
      },
      { 
        label: hasPaymentReceived ? 'Payment: Received' : 'Payment: Pending',
        completed: hasPaymentReceived,
        active: false
      }
    ];
    
    return steps;
  };

  const openTimelineDrawer = (request: PaymentRequest) => {
    setSelectedTimelineRequest(request);
    setTimelineDrawerOpen(true);
  };

  // Group requests by month - only show pending requests in active tab
  const activeRequests = paymentRequests.filter(r => r.status === 'pending' || r.status === 'sent');
  const groupedRequests = activeRequests.reduce((acc, request) => {
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
          <IconButton onClick={fetchAllData}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab 
            label={
              <Badge badgeContent={activeRequests.length} color="primary">
                Active Requests
              </Badge>
            } 
            icon={<PaymentIcon />} 
            iconPosition="start" 
          />
          <Tab 
            label={
              <Badge badgeContent={allEmails.length} color="default">
                Email Activity
              </Badge>
            } 
            icon={<EmailIcon />} 
            iconPosition="start" 
          />
          <Tab 
            label={
              <Badge badgeContent={unmatchedEmails.length} color="error">
                Unmatched
              </Badge>
            } 
            icon={<LinkOffIcon />} 
            iconPosition="start" 
          />
          <Tab 
            label="History" 
            icon={<HistoryIcon />} 
            iconPosition="start" 
          />
          <Tab 
            label={
              <Badge badgeContent={paymentRequests.length} color="default">
                All Requests
              </Badge>
            } 
            icon={<ListIcon />} 
            iconPosition="start" 
          />
        </Tabs>
      </Box>

      {/* Tab 0: Active Requests */}
      {tabValue === 0 && (
        <>
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
                              <Box display="flex" gap={0.5} alignItems="center">
                                {/* Show email match indicator */}
                                {emailsByRequest[request.id] && emailsByRequest[request.id].length > 0 && (
                                  <Chip
                                    icon={<EmailIcon />}
                                    label="Email Match"
                                    size="small"
                                    color="info"
                                    variant="outlined"
                                    onClick={() => {
                                      setSelectedEmailMatch({ request, emails: emailsByRequest[request.id] });
                                      setEmailMatchDialogOpen(true);
                                    }}
                                    sx={{ cursor: 'pointer' }}
                                  />
                                )}
                                {(request.status === 'pending' || request.status === 'sent') && (
                                  <>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      onClick={() => handleMarkPaidClick(request)}
                                      sx={{ minWidth: 'auto', px: 1, height: 28 }}
                                    >
                                      Paid
                                    </Button>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      color="warning"
                                      onClick={() => handleForegoClick(request)}
                                      sx={{ minWidth: 'auto', px: 1, height: 28 }}
                                    >
                                      Forego
                                    </Button>
                                  </>
                                )}
                                <Chip
                                  label={request.status}
                                  color={
                                    request.status === 'sent' ? 'warning' : 
                                    getStatusColor(request.status)
                                  }
                                  size="small"
                                  icon={
                                    request.status === 'paid' ? <CheckCircleIcon /> : 
                                    request.status === 'foregone' ? <LinkOffIcon /> : 
                                    request.status === 'sent' ? <SendIcon /> :
                                    <ScheduleIcon />
                                  }
                                />
                              </Box>
                            </Box>
                            
                            <Box mb={1}>
                              <Typography variant="subtitle2" gutterBottom>
                                {request.company_name || request.merchant_name || request.bill_type}
                              </Typography>
                              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mb={1}>
                                {getBillTypeChip(request.bill_type)}
                                {request.tracking_id && (
                                  <Chip
                                    label={request.tracking_id}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                )}
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
                            
                            {/* Status Indicator */}
                            <Box sx={{ mb: 2, mt: 1 }}>
                              <Stepper 
                                activeStep={getPaymentStatus(request).findIndex(s => s.active)} 
                                alternativeLabel
                                connector={<StatusConnector />}
                                sx={{ 
                                  '& .MuiStepLabel-label': { 
                                    fontSize: '0.75rem',
                                    mt: 0.5
                                  },
                                  '& .MuiStepIcon-root': {
                                    fontSize: '1rem'
                                  }
                                }}
                              >
                                {getPaymentStatus(request).map((step, index) => (
                                  <Step key={index} completed={step.completed}>
                                    <StepLabel>{step.label}</StepLabel>
                                  </Step>
                                ))}
                              </Stepper>
                              {request.due_date && (
                                <Typography variant="caption" color="error" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                                  Due: {format(new Date(request.due_date), 'MMM dd')}
                                </Typography>
                              )}
                            </Box>
                            
                            <Box display="flex" gap={1} mt={2}>
                              <Button
                                variant="contained"
                                size="medium"
                                fullWidth
                                startIcon={sendingSmsId === request.id ? <CircularProgress size={16} /> : <SendIcon />}
                                onClick={() => handleSendSMS(request)}
                                disabled={request.status === 'paid' || sendingSmsId === request.id}
                                sx={{ backgroundColor: '#5865F2', '&:hover': { backgroundColor: '#4752C4' } }}
                              >
                                {sendingSmsId === request.id ? 'Sending...' : 'Send to Discord'}
                              </Button>
                              <Button
                                variant="contained"
                                size="medium"
                                fullWidth
                                onClick={() => handleOpenVenmo(request)}
                                disabled={request.status === 'paid' || request.status === 'foregone'}
                                sx={{ 
                                  backgroundColor: '#3D95CE', 
                                  '&:hover': { backgroundColor: '#2980b9' },
                                  fontWeight: 'bold'
                                }}
                              >
                                Open in Venmo
                              </Button>
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
        </>
      )}

      {/* Desktop instruction dialog - removed since we now use simple links */}
      <Dialog open={false} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
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
              
              <Box mt={2} display="flex" gap={1} flexDirection="column">
                <Typography variant="body2" color="textSecondary">
                  Venmo Links:
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<LaunchIcon />}
                  onClick={() => window.location.href = selectedRequest.venmo_link}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Mobile Link (Open in Venmo App)
                </Button>
                {selectedRequest.venmo_web_link && (
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<LaunchIcon />}
                    onClick={() => window.open(selectedRequest.venmo_web_link, '_blank')}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Web Link (Open in Browser)
                  </Button>
                )}
              </Box>
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

      {/* Confirmation dialog for foregoing payment */}
      <Dialog 
        open={foregoneDialogOpen} 
        onClose={handleCancelForego} 
        maxWidth="xs" 
        fullWidth
      >
        <DialogTitle>Forego Payment</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will mark the payment as waived without reducing your expenses.
          </Alert>
          <Typography variant="body1">
            Are you sure you want to forego this payment?
          </Typography>
          {requestToForego && (
            <Box mt={2}>
              <Typography variant="body2" color="textSecondary">
                {requestToForego.company_name || requestToForego.bill_type}
              </Typography>
              <Typography variant="h6">
                {formatCurrency(requestToForego.amount)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                From: {requestToForego.roommate_name}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelForego} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmForego} 
            variant="contained" 
            color="warning"
          >
            Forego Payment
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Tab 1: Email Activity */}
      {tabValue === 1 && (
        <Box>
          {allEmails.length === 0 ? (
            <Card>
              <CardContent>
                <Typography variant="body1" color="textSecondary" align="center">
                  No Venmo emails found. Connect Gmail and sync to see email activity.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  All Venmo Emails ({allEmails.length})
                </Typography>
                <List>
                  {allEmails.map((email) => (
                    <ListItem key={email.id} divider>
                      <ListItemText
                        primary={email.subject}
                        secondary={
                          <>
                            <Typography component="span" variant="body2">
                              {format(new Date(email.received_date), 'MMM d, yyyy h:mm a')}
                            </Typography>
                            {email.venmo_amount && (
                              <Typography component="span" variant="body2" sx={{ ml: 2 }}>
                                Amount: ${email.venmo_amount}
                              </Typography>
                            )}
                            {email.tracking_id && (
                              <Chip
                                label={email.tracking_id}
                                size="small"
                                sx={{ ml: 1, fontSize: '0.7rem' }}
                              />
                            )}
                          </>
                        }
                      />
                      <Chip
                        label={email.email_type.replace('_', ' ')}
                        size="small"
                        color={email.matched ? 'success' : 'default'}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Box>
      )}
      
      {/* Tab 2: Unmatched */}
      {tabValue === 2 && (
        <Box>
          {unmatchedEmails.length === 0 ? (
            <Card>
              <CardContent>
                <Typography variant="body1" color="textSecondary" align="center">
                  No unmatched payments! All Venmo emails are matched to payment requests.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Unmatched Venmo Payments ({unmatchedEmails.length})
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  These payments couldn't be automatically matched to a request. Review and match manually if needed.
                </Typography>
                <List>
                  {unmatchedEmails.map((email) => (
                    <ListItem key={email.id} divider>
                      <ListItemText
                        primary={`${email.venmo_actor} - $${email.venmo_amount}`}
                        secondary={
                          <>
                            {format(new Date(email.received_date), 'MMM d, yyyy h:mm a')}
                            {email.venmo_note && (
                              <Typography variant="caption" display="block">
                                Note: {email.venmo_note}
                              </Typography>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Box>
      )}
      
      {/* Tab 3: History */}
      {tabValue === 3 && (
        <Box>
          {paymentRequests.filter(r => r.status === 'paid').length === 0 ? (
            <Card>
              <CardContent>
                <Typography variant="body1" color="textSecondary" align="center">
                  No payment history yet.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Payment History
                </Typography>
                <List>
                  {paymentRequests
                    .filter(r => r.status === 'paid')
                    .sort((a, b) => new Date(b.paid_date || 0).getTime() - new Date(a.paid_date || 0).getTime())
                    .map((request) => (
                      <ListItem key={request.id} divider>
                        <ListItemText
                          primary={`${request.roommate_name} - ${formatCurrency(request.amount)}`}
                          secondary={
                            <>
                              {getBillTypeChip(request.bill_type)}
                              <Typography component="span" variant="body2" sx={{ ml: 1 }}>
                                {request.month}/{request.year}
                              </Typography>
                              {request.paid_date && (
                                <Typography component="span" variant="body2" sx={{ ml: 2 }}>
                                  Paid: {format(new Date(request.paid_date), 'MMM d, yyyy')}
                                </Typography>
                              )}
                            </>
                          }
                        />
                        <CheckCircleIcon color="success" />
                      </ListItem>
                    ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* Tab 4: All Payment Requests Database View */}
      {tabValue === 4 && (
        <Box>
          {/* Filters */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="sent">Sent</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="foregone">Foregone</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="electricity">Electricity</MenuItem>
                <MenuItem value="water">Water</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Roommate</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Merchant</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Month/Year</TableCell>
                  <TableCell>Tracking ID</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paymentRequests
                  .filter(request => {
                    if (statusFilter !== 'all' && request.status !== statusFilter) return false;
                    if (typeFilter !== 'all' && request.bill_type !== typeFilter) return false;
                    return true;
                  })
                  .sort((a, b) => {
                    // Sort by year, month, then date
                    if (b.year !== a.year) return (b.year || 0) - (a.year || 0);
                    if (b.month !== a.month) return (b.month || 0) - (a.month || 0);
                    return new Date(b.request_date).getTime() - new Date(a.request_date).getTime();
                  })
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {format(new Date(request.request_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>{request.roommate_name}</TableCell>
                      <TableCell>
                        <Chip 
                          label={request.bill_type || 'N/A'} 
                          size="small"
                          color={request.bill_type === 'electricity' ? 'primary' : 'secondary'}
                        />
                      </TableCell>
                      <TableCell>{request.merchant_name || request.company_name || '-'}</TableCell>
                      <TableCell align="right">{formatCurrency(request.amount)}</TableCell>
                      <TableCell align="right">{formatCurrency(request.total_amount || 0)}</TableCell>
                      <TableCell>
                        <Chip
                          label={request.status}
                          size="small"
                          color={
                            request.status === 'paid' ? 'success' :
                            request.status === 'sent' ? 'info' :
                            request.status === 'foregone' ? 'warning' :
                            'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {request.month && request.year ? `${request.month}/${request.year}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {request.tracking_id || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => openTimelineDrawer(request)}
                          title="View timeline"
                        >
                          <TimelineIcon />
                        </IconButton>
                        {request.venmo_link && (
                          <IconButton
                            size="small"
                            onClick={() => handleOpenVenmo(request)}
                            title="Open in Venmo"
                          >
                            <LaunchIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={
              paymentRequests.filter(request => {
                if (statusFilter !== 'all' && request.status !== statusFilter) return false;
                if (typeFilter !== 'all' && request.bill_type !== typeFilter) return false;
                return true;
              }).length
            }
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
          />
        </Box>
      )}
      
      {/* Timeline Drawer */}
      <Drawer
        anchor="right"
        open={timelineDrawerOpen}
        onClose={() => setTimelineDrawerOpen(false)}
        sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: 400 } } }}
      >
        <Box sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Payment Timeline</Typography>
            <IconButton onClick={() => setTimelineDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          
          {selectedTimelineRequest && (
            <>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">
                    {selectedTimelineRequest.tracking_id}
                  </Typography>
                  <Typography variant="h5">
                    ${selectedTimelineRequest.amount}
                  </Typography>
                  <Typography variant="body2">
                    {selectedTimelineRequest.roommate_name}
                  </Typography>
                  {getBillTypeChip(selectedTimelineRequest.bill_type)}
                </CardContent>
              </Card>
              
              <Box sx={{ position: 'relative' }}>
                {/* Timeline events */}
                {(() => {
                  const emails = emailsByRequest[selectedTimelineRequest.id] || [];
                  const events = [
                    {
                      type: 'created',
                      date: selectedTimelineRequest.created_at,
                      label: 'Request Created',
                      icon: <PaymentIcon />,
                      color: 'primary'
                    },
                    ...emails.map(email => ({
                      type: email.email_type,
                      date: email.received_date,
                      label: email.email_type === 'request_sent' ? 'Venmo Request Sent' :
                             email.email_type === 'payment_received' ? 'Payment Received' :
                             email.email_type.replace('_', ' '),
                      icon: email.email_type === 'payment_received' ? <CheckCircleIcon /> : <EmailIcon />,
                      color: email.email_type === 'payment_received' ? 'success' : 'info',
                      details: {
                        amount: email.venmo_amount,
                        actor: email.venmo_actor,
                        note: email.venmo_note
                      }
                    }))
                  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                  
                  return events.map((event, index) => (
                    <Box key={index} sx={{ display: 'flex', mb: 3 }}>
                      <Box sx={{ 
                        position: 'relative',
                        '&::after': index < events.length - 1 ? {
                          content: '""',
                          position: 'absolute',
                          left: '50%',
                          top: 40,
                          width: 2,
                          height: 40,
                          backgroundColor: 'divider',
                          transform: 'translateX(-50%)'
                        } : {}
                      }}>
                        <Box sx={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: '50%',
                          backgroundColor: `${event.color}.light`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: `${event.color}.main`
                        }}>
                          {event.icon}
                        </Box>
                      </Box>
                      <Box sx={{ ml: 2, flex: 1 }}>
                        <Typography variant="subtitle2">{event.label}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {format(new Date(event.date), 'MMM d, yyyy h:mm a')}
                        </Typography>
                        {event.details && (
                          <Box sx={{ mt: 1 }}>
                            {event.details.amount && (
                              <Typography variant="body2">
                                Amount: ${event.details.amount}
                              </Typography>
                            )}
                            {event.details.actor && (
                              <Typography variant="body2">
                                From: {event.details.actor}
                              </Typography>
                            )}
                            {event.details.note && (
                              <Typography variant="caption" color="textSecondary">
                                Note: {event.details.note}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  ));
                })()}
              </Box>
            </>
          )}
        </Box>
      </Drawer>

      {/* Email Match Dialog */}
      <Dialog
        open={emailMatchDialogOpen}
        onClose={() => setEmailMatchDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Venmo Email Match</Typography>
            <IconButton onClick={() => setEmailMatchDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedEmailMatch && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                We found a Venmo payment email that may match this payment request.
              </Alert>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Payment Request</Typography>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2">
                      <strong>Roommate:</strong> {selectedEmailMatch.request.roommate_name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Amount:</strong> {formatCurrency(selectedEmailMatch.request.amount)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Type:</strong> {selectedEmailMatch.request.bill_type}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Created:</strong> {format(new Date(selectedEmailMatch.request.request_date), 'MMM d, yyyy')}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Matched Email(s)</Typography>
                {selectedEmailMatch.emails.map((email) => (
                  <Card key={email.id} variant="outlined" sx={{ mb: 1 }}>
                    <CardContent>
                      <Typography variant="body2" gutterBottom>
                        <strong>{email.subject}</strong>
                      </Typography>
                      <Typography variant="body2">
                        <strong>From:</strong> {email.venmo_actor}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Amount:</strong> ${email.venmo_amount}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Date:</strong> {format(new Date(email.received_date), 'MMM d, yyyy h:mm a')}
                      </Typography>
                      {email.venmo_note && (
                        <Typography variant="body2">
                          <strong>Note:</strong> {email.venmo_note}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailMatchDialogOpen(false)}>
            Close
          </Button>
          {selectedEmailMatch && selectedEmailMatch.request.status !== 'paid' && (
            <Button 
              variant="contained" 
              color="primary"
              onClick={async () => {
                if (selectedEmailMatch) {
                  await apiService.markPaymentPaid(selectedEmailMatch.request.id);
                  await fetchAllData();
                  setEmailMatchDialogOpen(false);
                }
              }}
            >
              Mark as Paid
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
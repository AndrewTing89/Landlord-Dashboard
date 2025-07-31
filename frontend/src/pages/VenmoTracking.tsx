import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Email as EmailIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { apiService } from '../services/api';

interface VenmoRequest {
  id: number;
  recipient_name: string;
  amount: string;
  description: string;
  status: 'pending' | 'paid' | 'declined' | 'expired';
  request_date: string;
  paid_date?: string;
  declined_date?: string;
  expired_date?: string;
  reminder_count: number;
  last_reminder_date?: string;
  bill_type?: string;
}

interface UnmatchedPayment {
  id: number;
  payer_name: string;
  amount: string;
  email_subject: string;
  email_date: string;
  matched: boolean;
}

interface Summary {
  pending_count: number;
  paid_count: number;
  declined_count: number;
  expired_count: number;
  pending_amount: string;
  paid_amount: string;
}

export default function VenmoTracking() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [requests, setRequests] = useState<VenmoRequest[]>([]);
  const [unmatchedPayments, setUnmatchedPayments] = useState<UnmatchedPayment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [matchDialog, setMatchDialog] = useState<{
    open: boolean;
    payment?: UnmatchedPayment;
    request?: VenmoRequest;
  }>({ open: false });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [requestsRes, unmatchedRes, summaryRes] = await Promise.all([
        apiService.get('/api/venmo-requests'),
        apiService.get('/api/venmo-unmatched'),
        apiService.get('/api/venmo-summary'),
      ]);
      
      setRequests(requestsRes.data);
      setUnmatchedPayments(unmatchedRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkEmails = async () => {
    try {
      setSyncing(true);
      await apiService.post('/api/check-venmo-emails');
      await fetchData();
    } catch (error) {
      console.error('Error checking emails:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleMatch = async () => {
    if (!matchDialog.payment || !matchDialog.request) return;
    
    try {
      await apiService.post(`/api/venmo-match/${matchDialog.payment.id}/${matchDialog.request.id}`);
      setMatchDialog({ open: false });
      await fetchData();
    } catch (error) {
      console.error('Error matching payment:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircleIcon color="success" />;
      case 'pending':
        return <ScheduleIcon color="warning" />;
      case 'declined':
        return <CancelIcon color="error" />;
      case 'expired':
        return <WarningIcon color="disabled" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'declined':
        return 'error';
      case 'expired':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

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
        <Typography variant="h4">Venmo Payment Tracking</Typography>
        <Button
          variant="contained"
          startIcon={syncing ? <CircularProgress size={20} /> : <EmailIcon />}
          onClick={checkEmails}
          disabled={syncing}
        >
          {syncing ? 'Checking...' : 'Check Emails'}
        </Button>
      </Box>

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Pending
                </Typography>
                <Typography variant="h5">
                  {summary.pending_count}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {formatCurrency(summary.pending_amount || 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Paid
                </Typography>
                <Typography variant="h5" color="success.main">
                  {summary.paid_count}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {formatCurrency(summary.paid_amount || 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Declined
                </Typography>
                <Typography variant="h5" color="error.main">
                  {summary.declined_count}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Expired
                </Typography>
                <Typography variant="h5" color="text.disabled">
                  {summary.expired_count}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Card>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label={`Payment Requests (${requests.length})`} />
          <Tab label={`Unmatched Payments (${unmatchedPayments.length})`} />
        </Tabs>

        {/* Payment Requests Table */}
        {tabValue === 0 && (
          <CardContent>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Recipient</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reminders</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {format(new Date(request.request_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>{request.recipient_name}</TableCell>
                      <TableCell>{formatCurrency(request.amount)}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{request.description || '-'}</Typography>
                          {request.bill_type && (
                            <Chip 
                              label={request.bill_type} 
                              size="small" 
                              variant="outlined" 
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(request.status)}
                          label={request.status}
                          color={getStatusColor(request.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {request.reminder_count > 0 && (
                          <Tooltip title={`Last reminder: ${request.last_reminder_date ? format(new Date(request.last_reminder_date), 'MMM dd') : 'N/A'}`}>
                            <Chip
                              label={`${request.reminder_count} sent`}
                              size="small"
                              variant="outlined"
                            />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {request.status === 'pending' && (
                          <Button
                            size="small"
                            startIcon={<LinkIcon />}
                            href={`https://venmo.com/${request.recipient_name}?txn=charge&amount=${request.amount}`}
                            target="_blank"
                          >
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {requests.length === 0 && (
              <Box textAlign="center" py={4}>
                <Typography color="textSecondary">
                  No payment requests found
                </Typography>
              </Box>
            )}
          </CardContent>
        )}

        {/* Unmatched Payments Table */}
        {tabValue === 1 && (
          <CardContent>
            {unmatchedPayments.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                These payments were received but couldn't be automatically matched to a request.
                Click "Match" to manually link them.
              </Alert>
            )}
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Payer</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unmatchedPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(new Date(payment.email_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>{payment.payer_name}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                          {payment.email_subject}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          onClick={() => {
                            const matchingRequest = requests.find(
                              r => r.status === 'pending' && 
                              parseFloat(r.amount) === parseFloat(payment.amount)
                            );
                            setMatchDialog({
                              open: true,
                              payment,
                              request: matchingRequest
                            });
                          }}
                        >
                          Match
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {unmatchedPayments.length === 0 && (
              <Box textAlign="center" py={4}>
                <Typography color="textSecondary">
                  No unmatched payments
                </Typography>
              </Box>
            )}
          </CardContent>
        )}
      </Card>

      {/* Match Dialog */}
      <Dialog open={matchDialog.open} onClose={() => setMatchDialog({ open: false })}>
        <DialogTitle>Match Payment to Request</DialogTitle>
        <DialogContent>
          {matchDialog.payment && matchDialog.request ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Payment:
              </Typography>
              <Typography variant="body2" gutterBottom>
                {matchDialog.payment.payer_name} - {formatCurrency(matchDialog.payment.amount)}
              </Typography>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Will be matched to:
              </Typography>
              <Typography variant="body2">
                Request to {matchDialog.request.recipient_name} - {formatCurrency(matchDialog.request.amount)}
              </Typography>
            </Box>
          ) : (
            <Alert severity="warning">
              No matching request found with the same amount. 
              Please verify the payment details before matching manually.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMatchDialog({ open: false })}>Cancel</Button>
          <Button 
            onClick={handleMatch} 
            variant="contained"
            disabled={!matchDialog.request}
          >
            Confirm Match
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
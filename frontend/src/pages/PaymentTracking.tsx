import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  IconButton,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Payment as PaymentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as PendingIcon,
  Send as SendIcon,
  Link as LinkIcon,
  Email as EmailIcon,
  Warning as WarningIcon,
  AttachMoney as MoneyIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';

interface PaymentRequest {
  id: number;
  utility_bill_id: number;
  roommate_name: string;
  venmo_username: string;
  amount: string;
  request_date: string;
  charge_date?: string;
  status: 'pending' | 'sent' | 'paid';
  venmo_link: string;
  bill_type: string;
  month: number;
  year: number;
}

interface VenmoEmail {
  id: number;
  email_type: string;
  venmo_amount: number;
  venmo_actor: string;
  venmo_note?: string;
  received_date: string;
  matched: boolean;
  payment_request_id?: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const PaymentTracking: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [venmoEmails, setVenmoEmails] = useState<VenmoEmail[]>([]);
  const [unmatchedEmails, setUnmatchedEmails] = useState<VenmoEmail[]>([]);
  const [stats, setStats] = useState<any>({});
  const [matchDialog, setMatchDialog] = useState<{
    open: boolean;
    email: VenmoEmail | null;
    selectedRequest: number | null;
  }>({ open: false, email: null, selectedRequest: null });

  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching payment tracking data...');
      
      // Fetch all data in parallel
      const [requestsRes, emailsRes, unmatchedRes, statsRes] = await Promise.all([
        axios.get('/api/payment-requests'),
        axios.get('/api/venmo-requests'),
        axios.get('/api/gmail/unmatched'),
        axios.get('/api/venmo-summary')
      ]);

      console.log('Data fetched:', {
        requests: requestsRes.data?.length,
        emails: emailsRes.data?.length,
        unmatched: unmatchedRes.data?.data?.length,
        stats: statsRes.data
      });

      setPaymentRequests(requestsRes.data || []);
      setVenmoEmails(emailsRes.data || []);
      setUnmatchedEmails(unmatchedRes.data?.data || []);
      setStats(statsRes.data || {});
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message || 'Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a snackbar notification here
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'sent': return 'info';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircleIcon fontSize="small" />;
      case 'sent': return <SendIcon fontSize="small" />;
      case 'pending': return <PendingIcon fontSize="small" />;
      default: return null;
    }
  };

  const handleMatch = async () => {
    if (!matchDialog.email || !matchDialog.selectedRequest) return;

    try {
      await axios.post('/api/gmail/match', {
        emailId: matchDialog.email.id,
        paymentRequestId: matchDialog.selectedRequest
      });
      
      setMatchDialog({ open: false, email: null, selectedRequest: null });
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error matching payment:', error);
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

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          Error loading payment data: {error}
          <br />
          Check the browser console for more details.
        </Alert>
      </Container>
    );
  }

  // Group payment requests by status
  const pendingRequests = paymentRequests.filter(r => r.status === 'pending');
  const sentRequests = paymentRequests.filter(r => r.status === 'sent');
  const paidRequests = paymentRequests.filter(r => r.status === 'paid');

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">Payment Tracking</Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              onClick={syncGmail}
            >
              Sync Gmail
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchData}
            >
              Refresh
            </Button>
          </Stack>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography color="text.secondary" variant="body2">
                    Pending Requests
                  </Typography>
                  <Typography variant="h4">
                    {pendingRequests.length}
                  </Typography>
                  <Typography variant="body2" color="warning.main">
                    ${stats.pending_amount || 0} total
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography color="text.secondary" variant="body2">
                    Awaiting Payment
                  </Typography>
                  <Typography variant="h4">
                    {sentRequests.length}
                  </Typography>
                  <Typography variant="body2" color="info.main">
                    Requests sent
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography color="text.secondary" variant="body2">
                    Paid This Month
                  </Typography>
                  <Typography variant="h4">
                    {paidRequests.filter(r => {
                      const paidDate = new Date(r.charge_date || r.request_date);
                      const now = new Date();
                      return paidDate.getMonth() === now.getMonth() && 
                             paidDate.getFullYear() === now.getFullYear();
                    }).length}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    ${stats.paid_amount || 0} collected
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography color="text.secondary" variant="body2">
                    Unmatched Emails
                  </Typography>
                  <Typography variant="h4">
                    <Badge badgeContent={unmatchedEmails.length} color="warning">
                      <EmailIcon />
                    </Badge>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Need review
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label={`Active Requests (${pendingRequests.length + sentRequests.length})`} />
            <Tab label={`Completed (${paidRequests.length})`} />
            <Tab label={`Unmatched Emails (${unmatchedEmails.length})`} />
            <Tab label="All Activity" />
          </Tabs>

          {/* Active Requests Tab */}
          <TabPanel value={tabValue} index={0}>
            {pendingRequests.length + sentRequests.length === 0 ? (
              <Alert severity="info">No active payment requests</Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Bill</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Roommate</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...pendingRequests, ...sentRequests].map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <Stack>
                            <Typography variant="body2">
                              {request.bill_type === 'electricity' ? '⚡' : '💧'} {request.bill_type}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {request.month}/{request.year}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body1" fontWeight="medium">
                            ${request.amount}
                          </Typography>
                        </TableCell>
                        <TableCell>{request.roommate_name}</TableCell>
                        <TableCell>
                          <Chip
                            icon={getStatusIcon(request.status)}
                            label={request.status}
                            size="small"
                            color={getStatusColor(request.status)}
                          />
                        </TableCell>
                        <TableCell>
                          {format(new Date(request.request_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Copy Venmo link">
                              <IconButton
                                size="small"
                                onClick={() => copyToClipboard(request.venmo_link)}
                              >
                                <CopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<LinkIcon />}
                              href={request.venmo_link}
                              target="_blank"
                            >
                              Venmo
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Completed Tab */}
          <TabPanel value={tabValue} index={1}>
            {paidRequests.length === 0 ? (
              <Alert severity="info">No completed payments</Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Bill</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Roommate</TableCell>
                      <TableCell>Paid Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paidRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          {request.bill_type === 'electricity' ? '⚡' : '💧'} {request.bill_type} ({request.month}/{request.year})
                        </TableCell>
                        <TableCell>${request.amount}</TableCell>
                        <TableCell>{request.roommate_name}</TableCell>
                        <TableCell>
                          {request.charge_date ? 
                            format(new Date(request.charge_date), 'MMM d, yyyy') : 
                            '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Unmatched Emails Tab */}
          <TabPanel value={tabValue} index={2}>
            {unmatchedEmails.length === 0 ? (
              <Alert severity="success">All emails matched!</Alert>
            ) : (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  These Venmo payment emails couldn't be automatically matched to payment requests.
                </Alert>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>From</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Note</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {unmatchedEmails.map((email) => (
                        <TableRow key={email.id}>
                          <TableCell>
                            {format(new Date(email.received_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>{email.venmo_actor}</TableCell>
                          <TableCell>
                            <Typography fontWeight="medium">
                              ${email.venmo_amount.toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                              {email.venmo_note || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => setMatchDialog({
                                open: true,
                                email,
                                selectedRequest: null
                              })}
                            >
                              Match
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </TabPanel>

          {/* All Activity Tab */}
          <TabPanel value={tabValue} index={3}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Complete history of all Venmo emails and payment activity
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Details</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {venmoEmails.map((email) => (
                    <TableRow key={`email-${email.id}`}>
                      <TableCell>
                        {format(new Date(email.received_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={email.email_type.replace('_', ' ')} 
                          size="small"
                          color={email.email_type === 'payment_received' ? 'success' : 'info'}
                        />
                      </TableCell>
                      <TableCell>${email.venmo_amount?.toFixed(2) || '?'}</TableCell>
                      <TableCell>
                        <Stack>
                          <Typography variant="body2">
                            {email.venmo_actor}
                          </Typography>
                          {email.venmo_note && (
                            <Typography variant="caption" color="text.secondary">
                              {email.venmo_note}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {email.matched ? (
                          <Chip icon={<CheckCircleIcon />} label="Matched" size="small" color="success" />
                        ) : (
                          <Chip icon={<WarningIcon />} label="Unmatched" size="small" color="warning" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </Paper>

        {/* Match Dialog */}
        <Dialog
          open={matchDialog.open}
          onClose={() => setMatchDialog({ open: false, email: null, selectedRequest: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Match Payment</DialogTitle>
          <DialogContent>
            {matchDialog.email && (
              <Stack spacing={3} sx={{ mt: 2 }}>
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>${matchDialog.email.venmo_amount.toFixed(2)}</strong> from{' '}
                    <strong>{matchDialog.email.venmo_actor}</strong>
                  </Typography>
                  {matchDialog.email.venmo_note && (
                    <Typography variant="caption" display="block" mt={1}>
                      Note: {matchDialog.email.venmo_note}
                    </Typography>
                  )}
                </Alert>

                <FormControl fullWidth>
                  <InputLabel>Select Payment Request</InputLabel>
                  <Select
                    value={matchDialog.selectedRequest || ''}
                    onChange={(e) => setMatchDialog({
                      ...matchDialog,
                      selectedRequest: Number(e.target.value)
                    })}
                    label="Select Payment Request"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {paymentRequests
                      .filter(r => r.status !== 'paid')
                      .map((request) => (
                        <MenuItem key={request.id} value={request.id}>
                          {request.bill_type} - ${request.amount} - {request.roommate_name} 
                          ({request.month}/{request.year})
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMatchDialog({ open: false, email: null, selectedRequest: null })}>
              Cancel
            </Button>
            <Button
              onClick={handleMatch}
              variant="contained"
              disabled={!matchDialog.selectedRequest}
            >
              Confirm Match
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Container>
  );
};

export default PaymentTracking;
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Grid
} from '@mui/material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineOppositeContent, { timelineOppositeContentClasses } from '@mui/lab/TimelineOppositeContent';
import {
  Payment as PaymentIcon,
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Send as SendIcon,
  Schedule as PendingIcon,
  Link as LinkIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';
import config from '../config';

interface PaymentRequest {
  id: number;
  utility_bill_id: number;
  roommate_name: string;
  venmo_username: string;
  amount: string;
  request_date: string;
  charge_date?: string;
  status: 'pending' | 'requested' | 'paid';
  venmo_link: string;
  bill_type: string;
  month: number;
  year: number;
  tracking_id?: string;
}

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

interface TimelineData {
  payment_request: PaymentRequest;
  emails: VenmoEmail[];
}

const VenmoEmailTracker: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
  const [allEmails, setAllEmails] = useState<VenmoEmail[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [unmatchedEmails, setUnmatchedEmails] = useState<VenmoEmail[]>([]);
  const [matchDialog, setMatchDialog] = useState<{
    open: boolean;
    email: VenmoEmail | null;
    selectedRequest: number | null;
  }>({ open: false, email: null, selectedRequest: null });

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [requestsRes, emailsRes, unmatchedRes] = await Promise.all([
        axios.get(`${config.api.baseURL}/api/payment-requests`),
        axios.get(`${config.api.baseURL}/api/venmo-emails`),
        axios.get(`${config.api.baseURL}/api/gmail/unmatched`)
      ]);

      const requests = requestsRes.data || [];
      const emails = emailsRes.data || [];
      const unmatched = unmatchedRes.data?.data || [];

      setPaymentRequests(requests);
      setAllEmails(emails);
      setUnmatchedEmails(unmatched);

      // Build timeline data by grouping emails with their payment requests
      const timeline: TimelineData[] = requests.map((request: PaymentRequest) => ({
        payment_request: request,
        emails: emails.filter((email: VenmoEmail) => email.payment_request_id === request.id)
      }));

      setTimelineData(timeline);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMatch = async () => {
    if (!matchDialog.email || !matchDialog.selectedRequest) return;

    try {
      await axios.post(`${config.api.baseURL}/api/gmail/match`, {
        emailId: matchDialog.email.id,
        paymentRequestId: matchDialog.selectedRequest
      });
      
      setMatchDialog({ open: false, email: null, selectedRequest: null });
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error matching payment:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'requested': return 'info';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getEmailTypeLabel = (type: string) => {
    switch (type) {
      case 'payment_received': return 'Payment Received';
      case 'request_sent': return 'Request Sent';
      case 'request_reminder': return 'Reminder Sent';
      case 'request_cancelled': return 'Request Cancelled';
      default: return type;
    }
  };

  const renderTimelineCard = (data: TimelineData | null, billType: 'electricity' | 'water') => {
    if (!data) {
      // Empty placeholder for months without this bill type
      return (
        <Card sx={{ opacity: 0.3, minHeight: 400 }}>
          <CardContent>
            <Box display="flex" justifyContent="center" alignItems="center" height={350}>
              <Typography variant="body1" color="text.secondary">
                No {billType} bill this month
              </Typography>
            </Box>
          </CardContent>
        </Card>
      );
    }

    const { payment_request, emails } = data;

    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" gap={1}>
              <Chip
                label={payment_request.status}
                color={getStatusColor(payment_request.status)}
                size="small"
              />
              {payment_request.tracking_id && (
                <Chip
                  label={payment_request.tracking_id}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </Box>
          
          <Typography variant="h5" gutterBottom>
            ${payment_request.amount}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {payment_request.roommate_name}
          </Typography>

          <Timeline
            sx={{
              [`& .${timelineOppositeContentClasses.root}`]: {
                flex: 0.2,
              },
            }}
          >
            {/* Request Created (only show if we have the actual request email) */}
            {emails.some(e => e.email_type === 'request_sent') ? (
              <TimelineItem>
                <TimelineOppositeContent color="textSecondary">
                  {format(new Date(payment_request.request_date), 'MMM d')}
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color="primary">
                    <PaymentIcon />
                  </TimelineDot>
                  <TimelineConnector />
                </TimelineSeparator>
                <TimelineContent>
                  <Typography variant="body2">
                    Request created
                  </Typography>
                  {payment_request.tracking_id && (
                    <Typography variant="caption" color="text.secondary">
                      ID: {payment_request.tracking_id}
                    </Typography>
                  )}
                </TimelineContent>
              </TimelineItem>
            ) : (
              <TimelineItem>
                <TimelineOppositeContent color="textSecondary">
                  {format(new Date(payment_request.request_date), 'MMM d')}
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot sx={{ bgcolor: 'grey.400' }}>
                    <PaymentIcon />
                  </TimelineDot>
                  <TimelineConnector />
                </TimelineSeparator>
                <TimelineContent>
                  <Typography variant="body2" color="text.secondary">
                    Request pending
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Waiting for Venmo email confirmation
                  </Typography>
                </TimelineContent>
              </TimelineItem>
            )}

            {/* Request Sent Email */}
            {emails.filter(e => e.email_type === 'request_sent').map((email, idx) => (
              <TimelineItem key={email.id}>
                <TimelineOppositeContent color="textSecondary">
                  {format(new Date(email.received_date), 'MMM d')}
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color="info">
                    <SendIcon />
                  </TimelineDot>
                  <TimelineConnector />
                </TimelineSeparator>
                <TimelineContent>
                  <Typography variant="body2">
                    Venmo sent
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ${email.venmo_amount}
                  </Typography>
                  {email.tracking_id && (
                    <Typography variant="caption" display="block" color="primary">
                      ID: {email.tracking_id}
                    </Typography>
                  )}
                </TimelineContent>
              </TimelineItem>
            ))}

            {/* Payment Received */}
            {emails.filter(e => e.email_type === 'payment_received').map((email, idx) => (
              <TimelineItem key={email.id}>
                <TimelineOppositeContent color="textSecondary">
                  {format(new Date(email.received_date), 'MMM d')}
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color="success">
                    <CheckCircleIcon />
                  </TimelineDot>
                  {idx < emails.filter(e => e.email_type === 'payment_received').length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent>
                  <Typography variant="body2">
                    Paid
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ${email.venmo_amount}
                  </Typography>
                  {email.tracking_id && (
                    <Typography variant="caption" display="block" color="primary">
                      ID: {email.tracking_id}
                    </Typography>
                  )}
                  {email.venmo_note && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {email.venmo_note}
                    </Typography>
                  )}
                </TimelineContent>
              </TimelineItem>
            ))}

            {/* No activity yet */}
            {emails.length === 0 && payment_request.status === 'pending' && (
              <TimelineItem>
                <TimelineOppositeContent color="textSecondary">
                  -
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color="grey">
                    <PendingIcon />
                  </TimelineDot>
                </TimelineSeparator>
                <TimelineContent>
                  <Typography variant="body2" color="text.secondary">
                    Awaiting Venmo
                  </Typography>
                </TimelineContent>
              </TimelineItem>
            )}
          </Timeline>

          {payment_request.venmo_link && payment_request.status !== 'paid' && (
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LinkIcon />}
              href={payment_request.venmo_link}
              target="_blank"
              sx={{ mt: 2 }}
            >
              Open in Venmo
            </Button>
          )}
        </CardContent>
      </Card>
    );
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

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Venmo Email Tracker</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchData}
        >
          Refresh
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Timeline View" />
          <Tab label="All Emails" />
          <Tab label="Payment Requests" />
          <Tab label={`Unmatched (${unmatchedEmails.length})`} />
        </Tabs>
      </Paper>

      {/* Timeline View */}
      {tabValue === 0 && (
        <>
          {timelineData.length === 0 ? (
            <Alert severity="info">No payment requests found</Alert>
          ) : (
            <>
              {/* Column Headers */}
              <Grid container spacing={3} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="h5" align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    ⚡ Electricity
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h5" align="center" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    💧 Water
                  </Typography>
                </Grid>
              </Grid>

              {/* Group by month/year and display side by side */}
              {(() => {
                // Group payment requests by month/year
                const groupedByMonth = timelineData.reduce((acc: any, item) => {
                  const { payment_request, emails } = item;
                  const key = `${payment_request.year}-${String(payment_request.month).padStart(2, '0')}`;
                  if (!acc[key]) {
                    acc[key] = { electricity: null, water: null };
                  }
                  if (payment_request.bill_type === 'electricity') {
                    acc[key].electricity = { payment_request, emails };
                  } else {
                    acc[key].water = { payment_request, emails };
                  }
                  return acc;
                }, {});

                // Sort by date (newest first)
                const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

                return sortedMonths.map(monthKey => {
                  const [year, month] = monthKey.split('-');
                  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                  const { electricity, water } = groupedByMonth[monthKey];

                  return (
                    <Box key={monthKey} mb={4}>
                      {/* Month Header */}
                      <Typography variant="h6" align="center" sx={{ mb: 2, color: 'text.secondary' }}>
                        {monthName}
                      </Typography>
                      
                      <Grid container spacing={3}>
                        {/* Electricity Column */}
                        <Grid item xs={6}>
                          {renderTimelineCard(electricity, 'electricity')}
                        </Grid>

                        {/* Water Column */}
                        <Grid item xs={6}>
                          {renderTimelineCard(water, 'water')}
                        </Grid>
                      </Grid>
                    </Box>
                  );
                });
              })()}
            </>
          )}
        </>
      )}

      {/* All Emails Tab */}
      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Actor</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Note</TableCell>
                <TableCell>Matched</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allEmails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell>
                    {format(new Date(email.received_date), 'MMM d, yyyy h:mm a')}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getEmailTypeLabel(email.email_type)}
                      size="small"
                      color={email.email_type === 'payment_received' ? 'success' : 'info'}
                    />
                  </TableCell>
                  <TableCell>{email.subject}</TableCell>
                  <TableCell>{email.venmo_actor}</TableCell>
                  <TableCell align="right">${email.venmo_amount}</TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {email.venmo_note || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {email.matched ? (
                      <Chip icon={<CheckCircleIcon />} label="Yes" size="small" color="success" />
                    ) : (
                      <Chip icon={<WarningIcon />} label="No" size="small" color="warning" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Payment Requests Tab */}
      {tabValue === 2 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Created</TableCell>
                <TableCell>Bill</TableCell>
                <TableCell>Roommate</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Linked Emails</TableCell>
                <TableCell>Paid Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paymentRequests.map((request) => {
                const linkedEmails = allEmails.filter(e => e.payment_request_id === request.id);
                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      {format(new Date(request.request_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {request.bill_type === 'electricity' ? '⚡' : '💧'} {request.month}/{request.year}
                    </TableCell>
                    <TableCell>{request.roommate_name}</TableCell>
                    <TableCell align="right">${request.amount}</TableCell>
                    <TableCell>
                      <Chip
                        label={request.status}
                        color={getStatusColor(request.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {linkedEmails.length > 0 ? (
                        <Stack direction="row" spacing={0.5}>
                          {linkedEmails.map(email => (
                            <Chip
                              key={email.id}
                              label={email.email_type === 'payment_received' ? 'Paid' : 'Sent'}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Stack>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {request.charge_date ? format(new Date(request.charge_date), 'MMM d, yyyy') : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Unmatched Emails Tab */}
      {tabValue === 3 && (
        <>
          {unmatchedEmails.length === 0 ? (
            <Alert severity="success">All emails are matched!</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Note</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unmatchedEmails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell>
                        {format(new Date(email.received_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getEmailTypeLabel(email.email_type)}
                          size="small"
                          color={email.email_type === 'payment_received' ? 'success' : 'info'}
                        />
                      </TableCell>
                      <TableCell>{email.venmo_actor}</TableCell>
                      <TableCell align="right">${email.venmo_amount}</TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {email.venmo_note || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
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
          )}
        </>
      )}

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
                  <strong>${matchDialog.email.venmo_amount}</strong> from{' '}
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
    </Container>
  );
};

export default VenmoEmailTracker;
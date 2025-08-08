import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Link as LinkIcon,
  Visibility as VisibilityIcon,
  AttachMoney as MoneyIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';

interface UnmatchedEmail {
  id: number;
  gmail_message_id: string;
  email_type: string;
  venmo_amount: number;
  venmo_actor: string;
  venmo_note?: string;
  received_date: string;
  subject: string;
  potential_matches?: any[];
  manual_review_needed: boolean;
  review_reason?: string;
}

interface PaymentRequest {
  id: number;
  roommate_name: string;
  amount: number;
  bill_type: string;
  month: number;
  year: number;
  status: string;
  created_at: string;
}

const EmailReview: React.FC = () => {
  const [emails, setEmails] = useState<UnmatchedEmail[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchDialog, setMatchDialog] = useState<{
    open: boolean;
    email: UnmatchedEmail | null;
    selectedRequest: number | null;
  }>({ open: false, email: null, selectedRequest: null });
  const [matching, setMatching] = useState(false);
  const [ignoringEmail, setIgnoringEmail] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch unmatched emails
      const emailsResponse = await axios.get('/api/gmail/unmatched');
      setEmails(emailsResponse.data.data || []);

      // Fetch pending payment requests
      const requestsResponse = await axios.get('/api/payment-requests', {
        params: { status: 'pending' }
      });
      setPaymentRequests(requestsResponse.data || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleIgnore = async (emailId: number) => {
    if (!window.confirm('Are you sure you want to ignore this email? It will no longer appear in the unmatched list.')) {
      return;
    }
    
    try {
      setIgnoringEmail(emailId);
      const response = await axios.post(`/api/gmail/ignore/${emailId}`);
      
      if (response.data.success) {
        // Show success message briefly, then refresh
        alert('Email ignored successfully');
        fetchData(); // Refresh data
      }
    } catch (err: any) {
      alert(`Error ignoring email: ${err.response?.data?.error || err.message}`);
    } finally {
      setIgnoringEmail(null);
    }
  };

  const handleMatch = async () => {
    if (!matchDialog.email || !matchDialog.selectedRequest) return;

    try {
      setMatching(true);
      const response = await axios.post('/api/gmail/match', {
        emailId: matchDialog.email.id,
        paymentRequestId: matchDialog.selectedRequest
      });

      if (response.data.success) {
        alert('Payment matched successfully!');
        setMatchDialog({ open: false, email: null, selectedRequest: null });
        fetchData(); // Refresh data
      }
    } catch (err: any) {
      alert(`Error matching payment: ${err.response?.data?.error || err.message}`);
    } finally {
      setMatching(false);
    }
  };

  const getEmailTypeColor = (type: string) => {
    switch (type) {
      case 'payment_received':
        return 'success';
      case 'request_sent':
        return 'info';
      case 'request_reminder':
        return 'warning';
      case 'request_cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.7) return 'warning';
    return 'error';
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
      <Stack spacing={3}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">Email Review</Typography>
          <Button
            variant="outlined"
            onClick={fetchData}
            startIcon={<CheckCircleIcon />}
          >
            Refresh
          </Button>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {emails.length === 0 ? (
          <Card>
            <CardContent>
              <Box textAlign="center" py={4}>
                <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  All emails matched!
                </Typography>
                <Typography color="text.secondary">
                  No emails require manual review at this time.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <>
            <Alert severity="info">
              {emails.length} email{emails.length !== 1 ? 's' : ''} require manual review. 
              These are Venmo payment emails that couldn't be automatically matched to payment requests.
            </Alert>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>From/To</TableCell>
                    <TableCell>Note</TableCell>
                    <TableCell>Confidence</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {emails.map((email) => {
                    const potentialMatches = email.potential_matches ? 
                      JSON.parse(email.potential_matches as any) : [];
                    const bestMatch = potentialMatches[0];
                    
                    return (
                      <TableRow key={email.id}>
                        <TableCell>
                          {format(new Date(email.received_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={email.email_type.replace('_', ' ')}
                            size="small"
                            color={getEmailTypeColor(email.email_type)}
                          />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <MoneyIcon fontSize="small" />
                            ${email.venmo_amount.toFixed(2)}
                          </Box>
                        </TableCell>
                        <TableCell>{email.venmo_actor}</TableCell>
                        <TableCell>
                          <Tooltip title={email.venmo_note || 'No note'}>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {email.venmo_note || '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {bestMatch && (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <LinearProgress
                                variant="determinate"
                                value={bestMatch.confidence * 100}
                                sx={{ width: 60, height: 6 }}
                                color={getConfidenceColor(bestMatch.confidence)}
                              />
                              <Typography variant="caption">
                                {(bestMatch.confidence * 100).toFixed(0)}%
                              </Typography>
                            </Stack>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="View details">
                              <IconButton size="small">
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={ignoringEmail === email.id ? <CircularProgress size={16} /> : <BlockIcon />}
                              onClick={() => handleIgnore(email.id)}
                              disabled={ignoringEmail === email.id}
                            >
                              Ignore
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<LinkIcon />}
                              onClick={() => setMatchDialog({
                                open: true,
                                email,
                                selectedRequest: bestMatch?.request_id || null
                              })}
                            >
                              Match
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Match Dialog */}
        <Dialog
          open={matchDialog.open}
          onClose={() => setMatchDialog({ open: false, email: null, selectedRequest: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Match Payment Email</DialogTitle>
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
                    {paymentRequests.map((request) => (
                      <MenuItem key={request.id} value={request.id}>
                        {request.bill_type} - ${request.amount} - {request.roommate_name} 
                        ({request.month}/{request.year})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {matchDialog.email.potential_matches && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Suggested matches:
                    </Typography>
                    {JSON.parse(matchDialog.email.potential_matches as any).map((match: any, idx: number) => (
                      <Typography key={idx} variant="caption" display="block">
                        • Request #{match.request_id}: {(match.confidence * 100).toFixed(0)}% confidence
                      </Typography>
                    ))}
                  </Box>
                )}
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
              disabled={!matchDialog.selectedRequest || matching}
              startIcon={matching ? <CircularProgress size={16} /> : <LinkIcon />}
            >
              {matching ? 'Matching...' : 'Confirm Match'}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Container>
  );
};

export default EmailReview;
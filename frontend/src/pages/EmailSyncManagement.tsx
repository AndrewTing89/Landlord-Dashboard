import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';
import config from '../config';

interface EmailStats {
  total_emails: string;
  matched_emails: string;
  unmatched_emails: string;
  last_sync: string | null;
  gmail_connected: boolean;
}

export default function EmailSyncManagement() {
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmSyncType, setConfirmSyncType] = useState<'recent' | 'full' | null>(null);

  useEffect(() => {
    fetchData();
    
    // Check URL params for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const gmailStatus = urlParams.get('gmail');
    
    if (gmailStatus === 'connected') {
      setSuccessMessage('Gmail connected successfully!');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Refresh data after a short delay to ensure backend is ready
      setTimeout(() => {
        fetchData();
      }, 1000);
    } else if (gmailStatus === 'error') {
      const reason = urlParams.get('reason');
      const details = urlParams.get('details');
      setError(`Failed to connect Gmail: ${reason || details || 'Unknown error'}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const statsRes = await axios.get(`${config.api.baseURL}/api/gmail/stats`);
      setEmailStats(statsRes.data.data); // Access the nested data
    } catch (err) {
      console.error('Error fetching email sync data:', err);
      setError('Failed to load email sync data');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncClick = (type: 'recent' | 'full') => {
    setConfirmSyncType(type);
    setConfirmDialogOpen(true);
  };

  const executeSync = async () => {
    setConfirmDialogOpen(false);
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const endpoint = confirmSyncType === 'full' ? '/api/gmail/sync-all' : '/api/gmail/sync';
      const response = await axios.post(`${config.api.baseURL}${endpoint}`);
      
      if (response.data) {
        const { emails_found, new_emails, processed } = response.data;
        setSuccessMessage(
          `Sync completed! Found ${emails_found || 0} emails, ${new_emails || 0} new. ` +
          `Processed ${processed || 0} emails.`
        );
        fetchData();
      }
    } catch (err: any) {
      console.error('Error syncing emails:', err);
      setError(err.response?.data?.error || 'Failed to sync emails');
    } finally {
      setSyncing(false);
    }
  };

  const connectGmail = () => {
    window.location.href = `${config.api.baseURL}/api/gmail/auth`;
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
      <Typography variant="h4" gutterBottom>
        Email Sync Management
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}

      {/* Gmail Connection Status */}
      {emailStats && !emailStats.gmail_connected && (
        <Alert 
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={connectGmail}>
              Connect Gmail
            </Button>
          }
        >
          Gmail is not connected. Connect your Gmail account to sync Venmo emails.
        </Alert>
      )}

      {/* Stats Overview */}
      {emailStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Emails
                </Typography>
                <Typography variant="h4">
                  {emailStats.total_emails || '0'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Matched Emails
                </Typography>
                <Typography variant="h4" color="success.main">
                  {emailStats.matched_emails || '0'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Unmatched Emails
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {emailStats.unmatched_emails || '0'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Gmail Status
                </Typography>
                <Chip
                  label={emailStats.gmail_connected ? 'Connected' : 'Not Connected'}
                  color={emailStats.gmail_connected ? 'success' : 'error'}
                  icon={emailStats.gmail_connected ? <CheckCircleIcon /> : <ErrorIcon />}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Sync Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Sync Actions</Typography>
            <IconButton onClick={fetchData} disabled={syncing}>
              <RefreshIcon />
            </IconButton>
          </Box>
          
          {syncing && (
            <Box mb={2}>
              <LinearProgress />
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Syncing emails... This may take a few moments.
              </Typography>
            </Box>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Email Sync
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Fetches Venmo emails from the last 7 days and matches them to payment requests.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<EmailIcon />}
                    onClick={() => handleSyncClick('recent')}
                    disabled={syncing || !emailStats?.gmail_connected}
                    fullWidth
                  >
                    Sync Recent Emails
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Full Email Sync
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Fetches Venmo emails from the last 30 days. Use this for initial setup or catching up.
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<EmailIcon />}
                    onClick={() => handleSyncClick('full')}
                    disabled={syncing || !emailStats?.gmail_connected}
                    fullWidth
                  >
                    Full Email Sync
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {emailStats?.gmail_connected && (
            <Box mt={2} display="flex" justifyContent="center">
              <Button
                variant="text"
                startIcon={<LinkIcon />}
                onClick={connectGmail}
                size="small"
              >
                Manage Gmail Connection
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Sync History
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Emails Found</TableCell>
                  <TableCell>New Emails</TableCell>
                  <TableCell>Matched</TableCell>
                  <TableCell>Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* For now, show last sync info if available */}
                {emailStats?.last_sync ? (
                  <TableRow>
                    <TableCell>
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="completed"
                        size="small"
                        color="success"
                      />
                    </TableCell>
                    <TableCell>
                      {format(new Date(emailStats.last_sync), 'MMM dd, h:mm a')}
                    </TableCell>
                    <TableCell>recent</TableCell>
                    <TableCell>{emailStats.total_emails || 0}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>{emailStats.matched_emails || 0}</TableCell>
                    <TableCell>-</TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="textSecondary">
                        No sync history available
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Confirm {confirmSyncType === 'recent' ? 'Recent' : 'Full'} Email Sync
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              This will:
            </Typography>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Connect to your Gmail account</li>
              <li>Search for Venmo emails from the last {confirmSyncType === 'recent' ? '7' : '30'} days</li>
              <li>Parse payment amounts and details</li>
              <li>Match emails to existing payment requests</li>
              <li>Mark unmatched emails for review</li>
            </ul>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={executeSync} variant="contained" color="primary">
            Start Sync
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
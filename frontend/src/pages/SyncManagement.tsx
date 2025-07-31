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
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Sync as SyncIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';
import config from '../config';

interface SyncHistory {
  id: number;
  sync_type: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  transactions_imported: number;
  bills_processed: number;
  payment_requests_created: number;
  pending_review: number;
  errors: string[] | null;
  details: any;
}

interface SyncStats {
  successful_syncs: string;
  failed_syncs: string;
  running_syncs: string;
  last_successful_sync: string | null;
  total_transactions: string;
  total_payment_requests: string;
  current_pending_review: string;
}

export default function SyncManagement() {
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncType, setSyncType] = useState<'daily' | 'catch-up' | null>(null);
  const [catchUpDays, setCatchUpDays] = useState(90);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmSyncType, setConfirmSyncType] = useState<'daily' | 'catch-up' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // Poll for updates every 10 seconds when a sync is running
    const interval = setInterval(() => {
      if (syncing) {
        fetchData();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [syncing]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [historyRes, statsRes] = await Promise.all([
        axios.get(`${config.api.baseURL}/api/sync/history`),
        axios.get(`${config.api.baseURL}/api/sync/stats`)
      ]);
      setSyncHistory(historyRes.data);
      setSyncStats(statsRes.data);
      
      // Check if any sync is currently running
      const hasRunning = historyRes.data.some((h: SyncHistory) => h.status === 'running');
      if (hasRunning && !syncing) {
        setSyncing(true);
      } else if (!hasRunning && syncing) {
        setSyncing(false);
      }
    } catch (err) {
      console.error('Error fetching sync data:', err);
      setError('Failed to load sync data');
    } finally {
      setLoading(false);
    }
  };

  const handleDailySync = () => {
    setConfirmSyncType('daily');
    setConfirmDialogOpen(true);
  };

  const confirmDailySync = async () => {
    try {
      setConfirmDialogOpen(false);
      setSyncing(true);
      setError(null);
      setSuccessMessage(null);
      
      const response = await axios.post(`${config.api.baseURL}/api/sync/daily`);
      if (response.data.success) {
        setSuccessMessage('Daily sync started successfully');
        // Start polling for updates
        setTimeout(fetchData, 1000);
      }
    } catch (err) {
      console.error('Error starting daily sync:', err);
      setError('Failed to start daily sync');
      setSyncing(false);
    }
  };

  const handleCatchUpSync = () => {
    setDialogOpen(true);
  };

  const confirmCatchUpSync = async () => {
    try {
      setDialogOpen(false);
      setConfirmSyncType('catch-up');
      setConfirmDialogOpen(true);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const executeConfirmedSync = async () => {
    setConfirmDialogOpen(false);
    
    if (confirmSyncType === 'daily') {
      await confirmDailySync();
    } else if (confirmSyncType === 'catch-up') {
      try {
        setSyncing(true);
        setError(null);
        setSuccessMessage(null);
        
        const response = await axios.post(`${config.api.baseURL}/api/sync/catch-up`, {
          days: catchUpDays
        });
        if (response.data.success) {
          setSuccessMessage(`Catch-up sync started (${catchUpDays} days)`);
          setTimeout(fetchData, 1000);
        }
      } catch (err) {
        console.error('Error starting catch-up sync:', err);
        setError('Failed to start catch-up sync');
        setSyncing(false);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'running':
        return <CircularProgress size={20} />;
      default:
        return <ScheduleIcon />;
    }
  };

  const getStatusColor = (status: string): 'success' | 'error' | 'warning' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'Running...';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (loading && !syncHistory.length) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Sync Management
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

      {/* Stats Overview */}
      {syncStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Last Successful Sync
                </Typography>
                <Typography variant="h6">
                  {syncStats.last_successful_sync
                    ? format(new Date(syncStats.last_successful_sync), 'MMM dd, h:mm a')
                    : 'Never'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Pending Review
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {syncStats.current_pending_review}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Transactions
                </Typography>
                <Typography variant="h4">
                  {syncStats.total_transactions || '0'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Success Rate (30d)
                </Typography>
                <Typography variant="h4" color="success.main">
                  {syncStats.successful_syncs && syncStats.failed_syncs
                    ? Math.round(
                        (parseInt(syncStats.successful_syncs) /
                          (parseInt(syncStats.successful_syncs) + parseInt(syncStats.failed_syncs))) *
                          100
                      )
                    : 100}%
                </Typography>
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
                Sync in progress... This may take a few minutes.
              </Typography>
            </Box>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Daily Sync
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Fetches bank transactions from the last 7 days and creates payment requests for new utility bills.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<SyncIcon />}
                    onClick={handleDailySync}
                    disabled={syncing}
                    fullWidth
                  >
                    Run Daily Sync
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Catch-up Sync
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Fetches bank transactions for a custom time period. Useful for initial setup or catching up after time away.
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<HistoryIcon />}
                    onClick={handleCatchUpSync}
                    disabled={syncing}
                    fullWidth
                  >
                    Run Catch-up Sync
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
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
                  <TableCell>Type</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Transactions</TableCell>
                  <TableCell>Bills</TableCell>
                  <TableCell>Requests</TableCell>
                  <TableCell>Pending</TableCell>
                  <TableCell>Errors</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {syncHistory.map((sync) => (
                  <TableRow key={sync.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getStatusIcon(sync.status)}
                        <Chip
                          label={sync.status}
                          size="small"
                          color={getStatusColor(sync.status)}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>{sync.sync_type}</TableCell>
                    <TableCell>
                      {format(new Date(sync.started_at), 'MMM dd, h:mm a')}
                    </TableCell>
                    <TableCell>
                      {formatDuration(sync.started_at, sync.completed_at)}
                    </TableCell>
                    <TableCell>{sync.transactions_imported || 0}</TableCell>
                    <TableCell>{sync.bills_processed || 0}</TableCell>
                    <TableCell>{sync.payment_requests_created || 0}</TableCell>
                    <TableCell>{sync.pending_review || 0}</TableCell>
                    <TableCell>
                      {sync.errors && sync.errors.length > 0 ? (
                        <Tooltip title={sync.errors.join(', ')}>
                          <Chip
                            label={sync.errors.length}
                            size="small"
                            color="error"
                            icon={<ErrorIcon />}
                          />
                        </Tooltip>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Catch-up Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Configure Catch-up Sync</DialogTitle>
        <DialogContent>
          <Box py={2}>
            <Typography variant="body2" paragraph>
              How many days back should we look for unbilled utility transactions?
            </Typography>
            <TextField
              label="Days to look back"
              type="number"
              value={catchUpDays}
              onChange={(e) => setCatchUpDays(parseInt(e.target.value) || 90)}
              fullWidth
              helperText="Default is 90 days. Use more for initial setup."
              InputProps={{
                inputProps: { min: 1, max: 365 }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmCatchUpSync} variant="contained" color="primary">
            Next
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Confirm {confirmSyncType === 'daily' ? 'Daily' : 'Catch-up'} Sync
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 2 }}>
            {confirmSyncType === 'daily' ? (
              <>
                <Typography variant="body2">
                  This will:
                </Typography>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Connect to your bank via SimpleFIN</li>
                  <li>Fetch transactions from the last 7 days</li>
                  <li>Categorize transactions using ETL rules</li>
                  <li>Create payment requests for new utility bills</li>
                  <li>Send Discord notifications</li>
                </ul>
              </>
            ) : (
              <>
                <Typography variant="body2">
                  This will:
                </Typography>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Connect to your bank via SimpleFIN</li>
                  <li>Fetch transactions from the last {catchUpDays} days</li>
                  <li>Categorize all transactions using ETL rules</li>
                  <li>Create payment requests for utility bills found</li>
                  <li>This may take longer than a daily sync</li>
                </ul>
              </>
            )}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={executeConfirmedSync} variant="contained" color="primary">
            Start Sync
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
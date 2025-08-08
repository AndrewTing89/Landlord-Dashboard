import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  LinearProgress,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Paper,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  PlayArrow as ProcessIcon,
  Storage as DatabaseIcon,
  Email as EmailIcon,
  AttachMoney as MoneyIcon,
  Build as FixIcon,
  Build as BuildIcon,
  Backup as BackupIcon,
  Restore as RestoreIcon,
} from '@mui/icons-material';
import { apiService } from '../services/api';
import { format } from 'date-fns';

interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  lastSync: {
    date: string | null;
    status: string;
    transactionsImported: number;
    billsProcessed: number;
  };
  pendingItems: {
    rawTransactions: number;
    unmatchedEmails: number;
    pendingPayments: number;
    reviewRequired: number;
  };
  dataIntegrity: {
    orphanedIncome: number;
    invalidStatuses: number;
    missingAmounts: number;
    duplicateTransactions: number;
  };
  systemHealth: {
    databaseConnected: boolean;
    emailServiceActive: boolean;
    bankConnectionValid: boolean;
    lastBackup: string | null;
  };
}

export default function HealthCheck() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [processingPending, setProcessingPending] = useState(false);
  const [fixingIssues, setFixingIssues] = useState(false);
  const [backupDialog, setBackupDialog] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHealthStatus();
  }, []);

  const fetchHealthStatus = async () => {
    try {
      setLoading(true);
      const response = await apiService.getHealthStatus();
      setHealth(response.data);
    } catch (error) {
      console.error('Error fetching health status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHealthStatus();
    setRefreshing(false);
  };

  const handleProcessPending = async () => {
    try {
      setProcessingPending(true);
      const response = await apiService.processPendingTransactions();
      if (response.data.success) {
        await fetchHealthStatus();
      }
    } catch (error) {
      console.error('Error processing pending transactions:', error);
    } finally {
      setProcessingPending(false);
    }
  };

  const handleFixIntegrity = async () => {
    try {
      setFixingIssues(true);
      const response = await apiService.fixDataIntegrity();
      if (response.data.success) {
        await fetchHealthStatus();
      }
    } catch (error) {
      console.error('Error fixing data integrity:', error);
    } finally {
      setFixingIssues(false);
    }
  };

  const handleBackup = async () => {
    try {
      const response = await apiService.createBackup();
      if (response.data.success) {
        setBackupDialog(false);
        await fetchHealthStatus();
      }
    } catch (error) {
      console.error('Error creating backup:', error);
    }
  };

  const handleRestore = async (backupId: string) => {
    try {
      const response = await apiService.restoreBackup(backupId);
      if (response.data.success) {
        setRestoreDialog(false);
        await fetchHealthStatus();
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'critical':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!health) {
    return <Alert severity="error">Failed to load health status</Alert>;
  }

  const totalPending = health.pendingItems.rawTransactions + 
                       health.pendingItems.unmatchedEmails + 
                       health.pendingItems.reviewRequired;

  const totalIntegrityIssues = health.dataIntegrity.orphanedIncome +
                               health.dataIntegrity.invalidStatuses +
                               health.dataIntegrity.missingAmounts +
                               health.dataIntegrity.duplicateTransactions;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">System Health Check</Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<BackupIcon />}
            onClick={() => setBackupDialog(true)}
          >
            Backup
          </Button>
          <Button
            variant="outlined"
            startIcon={<RestoreIcon />}
            onClick={() => setRestoreDialog(true)}
          >
            Restore
          </Button>
          <Button
            variant="contained"
            startIcon={refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Overall Status */}
      <Card sx={{ mb: 3, borderLeft: `4px solid`, borderColor: `${getHealthColor(health.overall)}.main` }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            {getHealthIcon(health.overall)}
            <Box flex={1}>
              <Typography variant="h6">
                System Status: {health.overall.toUpperCase()}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Last checked: {format(new Date(), 'PPp')}
              </Typography>
            </Box>
            <Chip
              label={health.overall}
              color={getHealthColor(health.overall) as any}
              size="medium"
            />
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Last Sync Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <DatabaseIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Last Sync
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Date"
                    secondary={health.lastSync.date ? format(new Date(health.lastSync.date), 'PPp') : 'Never'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Status"
                    secondary={
                      <Chip
                        label={health.lastSync.status}
                        size="small"
                        color={health.lastSync.status === 'completed' ? 'success' : 'error'}
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Transactions Imported"
                    secondary={health.lastSync.transactionsImported}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Bills Processed"
                    secondary={health.lastSync.billsProcessed}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Pending Items */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Pending Items ({totalPending})
                </Typography>
                {health.pendingItems.rawTransactions > 0 && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={processingPending ? <CircularProgress size={16} /> : <ProcessIcon />}
                    onClick={handleProcessPending}
                    disabled={processingPending}
                  >
                    Process All
                  </Button>
                )}
              </Box>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    {health.pendingItems.rawTransactions > 0 ? <WarningIcon color="warning" /> : <CheckIcon color="success" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Unprocessed Transactions"
                    secondary={`${health.pendingItems.rawTransactions} transactions waiting`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {health.pendingItems.unmatchedEmails > 0 ? <WarningIcon color="warning" /> : <CheckIcon color="success" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Unmatched Emails"
                    secondary={`${health.pendingItems.unmatchedEmails} emails need review`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {health.pendingItems.pendingPayments > 0 ? <InfoIcon color="info" /> : <CheckIcon color="success" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Pending Payments"
                    secondary={`${health.pendingItems.pendingPayments} awaiting payment`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {health.pendingItems.reviewRequired > 0 ? <WarningIcon color="warning" /> : <CheckIcon color="success" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Review Required"
                    secondary={`${health.pendingItems.reviewRequired} items need manual review`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Data Integrity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  <BuildIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Data Integrity ({totalIntegrityIssues} issues)
                </Typography>
                {totalIntegrityIssues > 0 && (
                  <Button
                    size="small"
                    variant="contained"
                    color="warning"
                    startIcon={fixingIssues ? <CircularProgress size={16} /> : <FixIcon />}
                    onClick={handleFixIntegrity}
                    disabled={fixingIssues}
                  >
                    Fix Issues
                  </Button>
                )}
              </Box>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    {health.dataIntegrity.orphanedIncome > 0 ? <ErrorIcon color="error" /> : <CheckIcon color="success" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Orphaned Income Records"
                    secondary={`${health.dataIntegrity.orphanedIncome} income without payment requests`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {health.dataIntegrity.invalidStatuses > 0 ? <ErrorIcon color="error" /> : <CheckIcon color="success" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Invalid Status Transitions"
                    secondary={`${health.dataIntegrity.invalidStatuses} impossible status combinations`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {health.dataIntegrity.missingAmounts > 0 ? <ErrorIcon color="error" /> : <CheckIcon color="success" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Missing Total Amounts"
                    secondary={`${health.dataIntegrity.missingAmounts} payment requests without totals`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {health.dataIntegrity.duplicateTransactions > 0 ? <WarningIcon color="warning" /> : <CheckIcon color="success" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Duplicate Transactions"
                    secondary={`${health.dataIntegrity.duplicateTransactions} potential duplicates`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* System Health */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                System Components
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    {health.systemHealth.databaseConnected ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Database Connection"
                    secondary={health.systemHealth.databaseConnected ? 'Connected' : 'Disconnected'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {health.systemHealth.emailServiceActive ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Email Service"
                    secondary={health.systemHealth.emailServiceActive ? 'Active' : 'Inactive'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {health.systemHealth.bankConnectionValid ? <CheckIcon color="success" /> : <ErrorIcon color="error" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Bank Connection"
                    secondary={health.systemHealth.bankConnectionValid ? 'Valid' : 'Invalid'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {health.systemHealth.lastBackup ? <CheckIcon color="success" /> : <WarningIcon color="warning" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Last Backup"
                    secondary={health.systemHealth.lastBackup ? format(new Date(health.systemHealth.lastBackup), 'PPp') : 'Never'}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Backup Dialog */}
      <Dialog open={backupDialog} onClose={() => setBackupDialog(false)}>
        <DialogTitle>Create Backup</DialogTitle>
        <DialogContent>
          <Typography>
            This will create a complete backup of your database including all transactions,
            payment requests, and system configuration.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupDialog(false)}>Cancel</Button>
          <Button onClick={handleBackup} variant="contained">Create Backup</Button>
        </DialogActions>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={restoreDialog} onClose={() => setRestoreDialog(false)}>
        <DialogTitle>Restore from Backup</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Warning: This will replace all current data with the backup data.
          </Alert>
          <Typography>
            Select a backup to restore from:
          </Typography>
          {/* List of backups would go here */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
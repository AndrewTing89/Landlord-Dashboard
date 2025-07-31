import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Google as GoogleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon
} from '@mui/icons-material';
import axios from 'axios';

interface GmailStatus {
  connected: boolean;
  lastSync?: string;
  emailCount?: number;
}

const GmailSettings: React.FC = () => {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/gmail/status');
      setStatus(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Error checking Gmail status:', err);
      setError('Failed to check Gmail connection status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    
    // Check URL params for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const gmailStatus = urlParams.get('gmail');
    
    if (gmailStatus === 'connected') {
      setError(null);
      checkStatus();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (gmailStatus === 'error') {
      setError('Failed to connect Gmail account. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleConnect = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/gmail/auth`;
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const response = await axios.post('/api/gmail/sync');
      
      if (response.data.success) {
        alert(`Gmail sync completed!\n\nProcessed: ${response.data.data.processed} emails\nMatched: ${response.data.data.matched} payments`);
        checkStatus();
      }
    } catch (err: any) {
      console.error('Error syncing Gmail:', err);
      setError(err.response?.data?.error || 'Failed to sync Gmail');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          {/* Header */}
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <GoogleIcon sx={{ fontSize: 32, color: '#4285F4' }} />
              <Typography variant="h5">Gmail Integration</Typography>
            </Box>
            <Tooltip title="Refresh status">
              <IconButton onClick={checkStatus} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Divider />

          {/* Connection Status */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Connection Status
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              {status?.connected ? (
                <>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="Connected"
                    color="success"
                    variant="outlined"
                  />
                  <Chip
                    icon={<LinkIcon />}
                    label="Venmo emails syncing"
                    size="small"
                  />
                </>
              ) : (
                <>
                  <Chip
                    icon={<LinkOffIcon />}
                    label="Not Connected"
                    color="default"
                    variant="outlined"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Connect your Gmail to automatically track Venmo payments
                  </Typography>
                </>
              )}
            </Box>
          </Box>

          {/* Features */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Features
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                ✓ Automatically detect when you send Venmo requests
              </Typography>
              <Typography variant="body2">
                ✓ Track when roommates pay their utility share
              </Typography>
              <Typography variant="body2">
                ✓ Create recuperation transactions automatically
              </Typography>
              <Typography variant="body2">
                ✓ Send Discord notifications on payment receipt
              </Typography>
            </Stack>
          </Box>

          {/* Actions */}
          <Box display="flex" gap={2}>
            {status?.connected ? (
              <>
                <Button
                  variant="outlined"
                  startIcon={syncing ? <CircularProgress size={16} /> : <RefreshIcon />}
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
                <Button
                  variant="text"
                  color="error"
                  size="small"
                  onClick={() => {
                    if (confirm('Are you sure you want to disconnect Gmail?')) {
                      // TODO: Implement disconnect
                      alert('Disconnect functionality coming soon');
                    }
                  }}
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                startIcon={<GoogleIcon />}
                onClick={handleConnect}
                sx={{
                  backgroundColor: '#4285F4',
                  '&:hover': {
                    backgroundColor: '#357ae8'
                  }
                }}
              >
                Connect Gmail Account
              </Button>
            )}
          </Box>

          {/* Privacy Note */}
          <Alert severity="info" icon={false}>
            <Typography variant="caption">
              <strong>Privacy Note:</strong> This app only reads Venmo notification emails. 
              It cannot access your personal emails or send emails on your behalf. 
              Processed emails can be safely deleted from Gmail.
            </Typography>
          </Alert>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default GmailSettings;
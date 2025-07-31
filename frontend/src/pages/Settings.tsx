import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  Grid,
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  Check as CheckIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import axios from 'axios';
import config from '../config';

export default function Settings() {
  const [hasSimpleFin, setHasSimpleFin] = useState(false);
  const [hasGmail, setHasGmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnections();
  }, []);

  const checkConnections = async () => {
    try {
      // Check SimpleFIN status
      const simpleFinResponse = await fetch(`${config.api.baseURL}/api/simplefin/test`);
      const simpleFinData = await simpleFinResponse.json();
      setHasSimpleFin(simpleFinData.configured && !simpleFinData.error);

      // Check Gmail status
      const gmailResponse = await axios.get(`${config.api.baseURL}/api/gmail/status`);
      setHasGmail(gmailResponse.data.data?.connected || false);
    } catch (error) {
      console.error('Failed to check connections:', error);
      setError('Failed to check connection status');
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Connection Status Overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Connection Status
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <AccountBalanceIcon />
                    <Typography>Bank Connection (SimpleFIN)</Typography>
                  </Box>
                }
                secondary="Syncs transactions from your bank accounts"
              />
              <Chip
                icon={hasSimpleFin ? <CheckIcon /> : undefined}
                label={hasSimpleFin ? 'Connected' : 'Not Connected'}
                color={hasSimpleFin ? 'success' : 'default'}
                variant="outlined"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <EmailIcon />
                    <Typography>Gmail Connection</Typography>
                  </Box>
                }
                secondary="Tracks Venmo payment emails automatically"
              />
              <Chip
                icon={hasGmail ? <CheckIcon /> : undefined}
                label={hasGmail ? 'Connected' : 'Not Connected'}
                color={hasGmail ? 'success' : 'default'}
                variant="outlined"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Information Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Bank Sync
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Bank transactions are synced via SimpleFIN to automatically detect utility bills
                and create payment requests.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                To manage bank sync, go to the <strong>Bank Sync</strong> page.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Email Sync
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Gmail integration tracks when roommates pay their share via Venmo and
                automatically matches payments to requests.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                To manage email sync, go to the <strong>Email Sync</strong> page.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* About Section */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            About
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Landlord Dashboard helps you track utility bills, split costs with roommates,
            and monitor payments automatically.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
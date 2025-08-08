import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  FormHelperText,
} from '@mui/material';
import {
  Add as AddIcon,
  Build as BuildIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { tenantApi } from '../services/api';
import { format } from 'date-fns';

interface MaintenanceRequest {
  id: number;
  category: string;
  priority: string;
  title: string;
  description: string;
  status: string;
  submitted_at: string;
  acknowledged_at: string;
  started_at: string;
  resolved_at: string;
  resolution_notes: string;
  satisfaction_rating: number;
}

const maintenanceCategories = [
  { value: 'plumbing', label: 'Plumbing', examples: 'Leaks, clogs, water pressure' },
  { value: 'electrical', label: 'Electrical', examples: 'Outlets, switches, lighting' },
  { value: 'appliance', label: 'Appliance', examples: 'Refrigerator, dishwasher, washer/dryer' },
  { value: 'hvac', label: 'HVAC', examples: 'Heating, cooling, ventilation' },
  { value: 'structural', label: 'Structural', examples: 'Doors, windows, walls, floors' },
  { value: 'other', label: 'Other', examples: 'Everything else' },
];

export default function Maintenance() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitDialog, setSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('normal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchMaintenanceRequests();
  }, []);

  const fetchMaintenanceRequests = async () => {
    try {
      setLoading(true);
      const response = await tenantApi.getMaintenanceRequests();
      setRequests(response.data.data.requests);
    } catch (err: any) {
      setError('Failed to load maintenance requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!category || !title || !description) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      await tenantApi.submitMaintenanceRequest({
        category,
        priority,
        title,
        description,
      });

      // Reset form
      setCategory('');
      setPriority('normal');
      setTitle('');
      setDescription('');
      setSubmitDialog(false);

      // Refresh list
      fetchMaintenanceRequests();
    } catch (err: any) {
      setError('Failed to submit maintenance request');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStep = (status: string) => {
    const steps = ['submitted', 'acknowledged', 'in_progress', 'resolved'];
    return steps.indexOf(status);
  };

  const getPriorityColor = (priority: string) => {
    const colors: { [key: string]: any } = {
      emergency: 'error',
      high: 'warning',
      normal: 'info',
      low: 'default',
    };
    return colors[priority] || 'default';
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: any } = {
      submitted: 'default',
      acknowledged: 'info',
      in_progress: 'warning',
      pending_parts: 'warning',
      resolved: 'success',
      cancelled: 'error',
    };
    return colors[status] || 'default';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Maintenance Requests
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setSubmitDialog(true)}
        >
          Submit Request
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Active Requests */}
      {requests.filter(r => r.status !== 'resolved' && r.status !== 'cancelled').length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>
            Active Requests
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {requests
              .filter(r => r.status !== 'resolved' && r.status !== 'cancelled')
              .map((request) => (
                <Grid item xs={12} key={request.id}>
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {request.title}
                          </Typography>
                          <Box display="flex" gap={1}>
                            <Chip
                              label={request.category}
                              size="small"
                              icon={<BuildIcon />}
                            />
                            <Chip
                              label={request.priority}
                              size="small"
                              color={getPriorityColor(request.priority)}
                            />
                            <Chip
                              label={request.status.replace('_', ' ')}
                              size="small"
                              color={getStatusColor(request.status)}
                            />
                          </Box>
                        </Box>
                        <Typography variant="caption" color="textSecondary">
                          {format(new Date(request.submitted_at), 'MMM dd, yyyy')}
                        </Typography>
                      </Box>

                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {request.description}
                      </Typography>

                      {/* Status Stepper */}
                      <Stepper activeStep={getStatusStep(request.status)} alternativeLabel>
                        <Step>
                          <StepLabel>Submitted</StepLabel>
                        </Step>
                        <Step>
                          <StepLabel>Acknowledged</StepLabel>
                        </Step>
                        <Step>
                          <StepLabel>In Progress</StepLabel>
                        </Step>
                        <Step>
                          <StepLabel>Resolved</StepLabel>
                        </Step>
                      </Stepper>

                      {request.resolution_notes && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                          <Typography variant="body2">
                            <strong>Update:</strong> {request.resolution_notes}
                          </Typography>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </>
      )}

      {/* Resolved Requests */}
      {requests.filter(r => r.status === 'resolved').length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>
            Resolved Requests
          </Typography>
          <Grid container spacing={2}>
            {requests
              .filter(r => r.status === 'resolved')
              .map((request) => (
                <Grid item xs={12} key={request.id}>
                  <Card sx={{ opacity: 0.8 }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="subtitle1">
                            {request.title}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Resolved on {format(new Date(request.resolved_at), 'MMM dd, yyyy')}
                          </Typography>
                        </Box>
                        <CheckIcon color="success" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </>
      )}

      {/* No Requests */}
      {requests.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <BuildIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Maintenance Requests
            </Typography>
            <Typography color="textSecondary">
              Submit a request if you need something fixed or checked out.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Submit Request Dialog */}
      <Dialog open={submitDialog} onClose={() => setSubmitDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Maintenance Request</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  label="Category"
                >
                  {maintenanceCategories.map((cat) => (
                    <MenuItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {maintenanceCategories.find(c => c.value === category)?.examples}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  label="Priority"
                >
                  <MenuItem value="emergency">Emergency (24 hours)</MenuItem>
                  <MenuItem value="high">High (2-3 days)</MenuItem>
                  <MenuItem value="normal">Normal (3-5 days)</MenuItem>
                  <MenuItem value="low">Low (When convenient)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Brief Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Kitchen faucet leaking"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                multiline
                rows={4}
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe the issue in detail..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting || !category || !title || !description}
          >
            {submitting ? <CircularProgress size={20} /> : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
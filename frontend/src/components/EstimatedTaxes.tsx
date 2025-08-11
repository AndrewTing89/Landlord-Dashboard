import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountBalance as TaxIcon,
} from '@mui/icons-material';
import config from '../config';

interface EstimatedTax {
  id: number;
  tax_year: number;
  estimated_amount: number;
  description: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export default function EstimatedTaxes() {
  const [estimatedTaxes, setEstimatedTaxes] = useState<EstimatedTax[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<EstimatedTax | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    tax_year: new Date().getFullYear(),
    estimated_amount: '',
    description: '',
    notes: ''
  });

  useEffect(() => {
    fetchEstimatedTaxes();
  }, []);

  const fetchEstimatedTaxes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.api.baseURL}/api/estimated-taxes`);
      if (!response.ok) throw new Error('Failed to fetch estimated taxes');
      
      const data = await response.json();
      setEstimatedTaxes(data);
    } catch (err) {
      console.error('Error fetching estimated taxes:', err);
      setError('Failed to load estimated taxes');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tax?: EstimatedTax) => {
    if (tax) {
      setEditingTax(tax);
      setFormData({
        tax_year: tax.tax_year,
        estimated_amount: tax.estimated_amount.toString(),
        description: tax.description,
        notes: tax.notes || ''
      });
    } else {
      setEditingTax(null);
      setFormData({
        tax_year: new Date().getFullYear(),
        estimated_amount: '',
        description: '',
        notes: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTax(null);
    setFormData({
      tax_year: new Date().getFullYear(),
      estimated_amount: '',
      description: '',
      notes: ''
    });
  };

  const handleSubmit = async () => {
    try {
      if (!formData.tax_year || !formData.estimated_amount) {
        setError('Tax year and estimated amount are required');
        return;
      }

      const response = await fetch(`${config.api.baseURL}/api/estimated-taxes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tax_year: formData.tax_year,
          estimated_amount: parseFloat(formData.estimated_amount),
          description: formData.description,
          notes: formData.notes
        })
      });

      if (!response.ok) throw new Error('Failed to save estimated tax');

      const result = await response.json();
      setSuccess(result.message);
      handleCloseDialog();
      fetchEstimatedTaxes();
    } catch (err) {
      console.error('Error saving estimated tax:', err);
      setError('Failed to save estimated tax');
    }
  };

  const handleDelete = async (year: number) => {
    if (!window.confirm(`Are you sure you want to delete the estimated tax for ${year}?`)) {
      return;
    }

    try {
      const response = await fetch(`${config.api.baseURL}/api/estimated-taxes/${year}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete estimated tax');

      setSuccess('Estimated tax deleted successfully');
      fetchEstimatedTaxes();
    } catch (err) {
      console.error('Error deleting estimated tax:', err);
      setError('Failed to delete estimated tax');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Toast Notifications */}
      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setError(null)} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={!!success}
        autoHideDuration={2000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>

      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <TaxIcon />
              <Typography variant="h6">Estimated Property Taxes</Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Tax Estimate
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" paragraph>
            Input your estimated property tax amounts for each year. This helps with budgeting and tax planning.
            Actual property tax payments are automatically excluded from expense tracking to avoid double-counting.
          </Typography>

          {estimatedTaxes.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No estimated taxes configured. Add your first tax estimate to get started.
            </Alert>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Tax Year</TableCell>
                    <TableCell>Estimated Amount</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {estimatedTaxes.map((tax) => (
                    <TableRow key={tax.id}>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {tax.tax_year}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" color="primary" fontWeight="medium">
                          {formatCurrency(tax.estimated_amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {tax.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {tax.notes || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(tax)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(tax.tax_year)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTax ? `Edit ${editingTax.tax_year} Tax Estimate` : 'Add Tax Estimate'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Tax Year"
              type="number"
              value={formData.tax_year}
              onChange={(e) => setFormData({ ...formData, tax_year: parseInt(e.target.value) })}
              inputProps={{ min: 2000, max: 2050 }}
              fullWidth
            />
            <TextField
              label="Estimated Amount"
              type="number"
              value={formData.estimated_amount}
              onChange={(e) => setFormData({ ...formData, estimated_amount: e.target.value })}
              inputProps={{ min: 0, step: 0.01 }}
              fullWidth
              InputProps={{
                startAdornment: '$',
              }}
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              placeholder="e.g., Estimated property taxes for rental property"
            />
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder="Optional notes about the estimate..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingTax ? 'Update' : 'Add'} Tax Estimate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
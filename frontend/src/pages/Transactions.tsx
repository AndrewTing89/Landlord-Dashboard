import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  TextField,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  Snackbar,
  Checkbox,
  ListItemText,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material';
// Date pickers removed due to dependency issues
import {
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { apiService } from '../services/api';
import { Transaction, ExpenseType } from '../types';

// Color scheme matching Dashboard and PaymentRequests
const getExpenseTypeChip = (type: string | null) => {
  const colorMap: Record<string, string> = {
    electricity: '#D4A017', // Gold/Yellow
    water: '#9C27B0', // Purple
    maintenance: '#FF5722', // Deep Orange
    landscape: '#E91E63', // Pink-Red
    internet: '#F44336', // Red
    property_tax: '#D32F2F', // Dark Red
    rent: '#4CAF50', // Green
    insurance: '#FF6F00', // Amber-Orange
    other: '#8884D8',
    utility_reimbursement: '#4CAF50', // Green (income)
  };

  const label = type ? type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ') : 'Unknown';

  return {
    label,
    backgroundColor: colorMap[type || ''] || '#757575',
    color: 'white'
  };
};

interface EditDialogState {
  open: boolean;
  transaction: Transaction | null;
  newExpenseType: string;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Filters
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedExpenseTypes, setSelectedExpenseTypes] = useState<string[]>([]);
  const [excludedExpenseTypes, setExcludedExpenseTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    transaction: null,
    newExpenseType: '',
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchTransactions();
  }, [startDate, endDate, selectedExpenseTypes, excludedExpenseTypes, debouncedSearchQuery]);

  const fetchTransactions = async () => {
    try {
      // Only set loading on first load
      if (transactions.length === 0) {
        setLoading(true);
      }
      setError(null);
      
      const params: any = {};
      if (startDate) params.start_date = format(startDate, 'yyyy-MM-dd');
      if (endDate) params.end_date = format(endDate, 'yyyy-MM-dd');
      if (selectedExpenseTypes.length > 0) params.expense_types = selectedExpenseTypes.join(',');
      if (excludedExpenseTypes.length > 0) params.exclude_types = excludedExpenseTypes.join(',');
      if (debouncedSearchQuery) params.search = debouncedSearchQuery;
      
      const response = await apiService.getTransactions(params);
      setTransactions(response.data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchTransactions();
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };


  const handleEditClick = (transaction: Transaction) => {
    setEditDialog({
      open: true,
      transaction: transaction,
      newExpenseType: transaction.expense_type || 'other',
    });
  };

  const handleEditClose = () => {
    setEditDialog({
      open: false,
      transaction: null,
      newExpenseType: '',
    });
  };

  const handleEditSave = async () => {
    if (!editDialog.transaction || !editDialog.newExpenseType) return;
    
    setEditing(true);
    try {
      const response = await apiService.updateTransactionCategory(
        editDialog.transaction.id,
        editDialog.newExpenseType
      );
      
      const result = response.data;
      
      // Update the transaction in the local state
      setTransactions(transactions.map(tx => 
        tx.id === editDialog.transaction!.id 
          ? { ...tx, expense_type: editDialog.newExpenseType as ExpenseType }
          : tx
      ));
      
      setSuccessMessage('Transaction category updated successfully');
      
      // Show suggestion if provided
      if (result.suggestion) {
        console.log('ETL Rule Suggestion:', result.suggestion);
      }
      
      handleEditClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
      setError('Failed to update transaction category');
    } finally {
      setEditing(false);
    }
  };

  // Show full loading only on initial load
  if (loading && transactions.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Transactions</Typography>
        <Box>
          <Tooltip title="Export to Excel">
            <IconButton>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <FilterListIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Filters</Typography>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                type="date"
                fullWidth
                label="Start Date"
                value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                type="date"
                fullWidth
                label="End Date"
                value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Expense Types</InputLabel>
                <Select
                  multiple
                  value={selectedExpenseTypes}
                  onChange={(event: SelectChangeEvent<string[]>) => {
                    const value = event.target.value;
                    setSelectedExpenseTypes(typeof value === 'string' ? value.split(',') : value);
                  }}
                  input={<OutlinedInput label="Expense Types" />}
                  renderValue={(selected) => {
                    if (selected.length === 0) {
                      return <em>All Types</em>;
                    }
                    return `${selected.length} selected`;
                  }}
                >
                  <MenuItem value="rent">
                    <Checkbox checked={selectedExpenseTypes.indexOf('rent') > -1} />
                    <ListItemText primary="Rent Income" />
                  </MenuItem>
                  <MenuItem value="electricity">
                    <Checkbox checked={selectedExpenseTypes.indexOf('electricity') > -1} />
                    <ListItemText primary="Electricity" />
                  </MenuItem>
                  <MenuItem value="water">
                    <Checkbox checked={selectedExpenseTypes.indexOf('water') > -1} />
                    <ListItemText primary="Water" />
                  </MenuItem>
                  <MenuItem value="internet">
                    <Checkbox checked={selectedExpenseTypes.indexOf('internet') > -1} />
                    <ListItemText primary="Internet" />
                  </MenuItem>
                  <MenuItem value="maintenance">
                    <Checkbox checked={selectedExpenseTypes.indexOf('maintenance') > -1} />
                    <ListItemText primary="Maintenance" />
                  </MenuItem>
                  <MenuItem value="landscape">
                    <Checkbox checked={selectedExpenseTypes.indexOf('landscape') > -1} />
                    <ListItemText primary="Landscape" />
                  </MenuItem>
                  <MenuItem value="property_tax">
                    <Checkbox checked={selectedExpenseTypes.indexOf('property_tax') > -1} />
                    <ListItemText primary="Property Tax" />
                  </MenuItem>
                  <MenuItem value="insurance">
                    <Checkbox checked={selectedExpenseTypes.indexOf('insurance') > -1} />
                    <ListItemText primary="Insurance" />
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {selectedExpenseTypes.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="text"
                  onClick={() => setSelectedExpenseTypes([])}
                  sx={{ mt: 2 }}
                >
                  Clear Include ({selectedExpenseTypes.length})
                </Button>
              </Grid>
            )}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Exclude Types</InputLabel>
                <Select
                  multiple
                  value={excludedExpenseTypes}
                  onChange={(event: SelectChangeEvent<string[]>) => {
                    const value = event.target.value;
                    setExcludedExpenseTypes(typeof value === 'string' ? value.split(',') : value);
                  }}
                  input={<OutlinedInput label="Exclude Types" />}
                  renderValue={(selected) => {
                    if (selected.length === 0) {
                      return <em>None excluded</em>;
                    }
                    return `Excluding ${selected.length}`;
                  }}
                >
                  <MenuItem value="rent">
                    <Checkbox checked={excludedExpenseTypes.indexOf('rent') > -1} />
                    <ListItemText primary="Rent" />
                  </MenuItem>
                  <MenuItem value="electricity">
                    <Checkbox checked={excludedExpenseTypes.indexOf('electricity') > -1} />
                    <ListItemText primary="Electricity" />
                  </MenuItem>
                  <MenuItem value="water">
                    <Checkbox checked={excludedExpenseTypes.indexOf('water') > -1} />
                    <ListItemText primary="Water" />
                  </MenuItem>
                  <MenuItem value="internet">
                    <Checkbox checked={excludedExpenseTypes.indexOf('internet') > -1} />
                    <ListItemText primary="Internet" />
                  </MenuItem>
                  <MenuItem value="maintenance">
                    <Checkbox checked={excludedExpenseTypes.indexOf('maintenance') > -1} />
                    <ListItemText primary="Maintenance" />
                  </MenuItem>
                  <MenuItem value="landscape">
                    <Checkbox checked={excludedExpenseTypes.indexOf('landscape') > -1} />
                    <ListItemText primary="Landscape" />
                  </MenuItem>
                  <MenuItem value="property_tax">
                    <Checkbox checked={excludedExpenseTypes.indexOf('property_tax') > -1} />
                    <ListItemText primary="Property Tax" />
                  </MenuItem>
                  <MenuItem value="insurance">
                    <Checkbox checked={excludedExpenseTypes.indexOf('insurance') > -1} />
                    <ListItemText primary="Insurance" />
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {excludedExpenseTypes.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="text"
                  onClick={() => setExcludedExpenseTypes([])}
                  sx={{ mt: 2 }}
                >
                  Clear Exclude ({excludedExpenseTypes.length})
                </Button>
              </Grid>
            )}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Search"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <FilterListIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
                key="search-input"
                autoComplete="off"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Merchant</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((transaction) => (
                <TableRow key={transaction.id} hover>
                  <TableCell>
                    {format(new Date(transaction.date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>{transaction.name}</TableCell>
                  <TableCell>{transaction.merchant_name || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={getExpenseTypeChip(transaction.expense_type).label}
                      size="small"
                      sx={{
                        backgroundColor: getExpenseTypeChip(transaction.expense_type).backgroundColor,
                        color: getExpenseTypeChip(transaction.expense_type).color,
                        fontWeight: 500
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={transaction.expense_type === 'rent' ? 'success.main' : 'text.primary'}
                    >
                      {formatCurrency(transaction.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit Category">
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(transaction)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={transactions.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* Summary */}
      {transactions.length > 0 && (
        <Box mt={3} display="flex" justifyContent="flex-end">
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary">
                Total ({transactions.length} transactions)
              </Typography>
              <Typography variant="h6">
                {formatCurrency(
                  transactions.reduce((sum, t) => sum + t.amount, 0)
                )}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onClose={handleEditClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Transaction Category
        </DialogTitle>
        <DialogContent>
          {editDialog.transaction && (
            <Box>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Transaction: {editDialog.transaction.name}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Date: {format(new Date(editDialog.transaction.date), 'MMM dd, yyyy')}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Amount: {formatCurrency(editDialog.transaction.amount)}
              </Typography>
              
              <FormControl fullWidth sx={{ mt: 3 }}>
                <InputLabel>Expense Type</InputLabel>
                <Select
                  value={editDialog.newExpenseType}
                  onChange={(e) => setEditDialog({ ...editDialog, newExpenseType: e.target.value })}
                  label="Expense Type"
                >
                  <MenuItem value="rent">Rent Income</MenuItem>
                  <MenuItem value="electricity">Electricity</MenuItem>
                  <MenuItem value="water">Water</MenuItem>
                  <MenuItem value="internet">Internet</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                  <MenuItem value="property_tax">Property Tax</MenuItem>
                  <MenuItem value="insurance">Insurance</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose} disabled={editing}>
            Cancel
          </Button>
          <Button 
            onClick={handleEditSave} 
            variant="contained" 
            disabled={editing || !editDialog.newExpenseType}
          >
            {editing ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage}
      />
    </Box>
  );
}
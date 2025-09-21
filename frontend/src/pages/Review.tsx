import { useState, useEffect } from 'react';
import config from '../config';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  Select,
  MenuItem,
  FormControl,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  ButtonGroup,
  Badge,
  Snackbar,
  Slide,
} from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  RateReview as ReviewIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

interface PendingTransaction {
  id: number;
  simplefin_id: string;
  amount: number;
  posted_date: string;
  description: string;
  payee: string;
  suggested_expense_type: string | null;
  suggested_merchant: string | null;
  confidence_score: number | null;
}

interface ExpenseType {
  value: string;
  label: string;
}

export default function Review() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<{ [key: number]: string }>({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processing, setProcessing] = useState<{ [key: number]: boolean }>({});
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingTransactions();
    fetchExpenseTypes();
    fetchGlobalSummary(); // Always fetch global summary regardless of displayed transactions
  }, [page, rowsPerPage, filterCategory]); // Re-fetch when filter changes

  const fetchPendingTransactions = async () => {
    try {
      setLoading(true);
      
      let url = `${config.api.baseURL}/api/review/pending?limit=${rowsPerPage}&offset=${page * rowsPerPage}`;
      if (filterCategory && filterCategory !== 'uncategorized') {
        url += `&type=${filterCategory}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      setTransactions(data.transactions);
      setTotal(data.total);
      
      // Pre-populate selected types with suggestions
      const types: { [key: number]: string } = {};
      data.transactions.forEach((tx: PendingTransaction) => {
        types[tx.id] = tx.suggested_expense_type || 'other';
      });
      setSelectedTypes(types);
    } catch (err) {
      console.error('Error fetching pending transactions:', err);
      setError('Failed to load pending transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenseTypes = async () => {
    try {
      const response = await fetch(`${config.api.baseURL}/api/review/expense-types`);
      const types = await response.json();
      setExpenseTypes(types);
    } catch (err) {
      console.error('Error fetching expense types:', err);
    }
  };

  const handleApprove = async (transaction: PendingTransaction) => {
    const expenseType = selectedTypes[transaction.id];
    if (!expenseType) {
      setError('Please select an expense type');
      return;
    }

    setProcessing({ ...processing, [transaction.id]: true });
    
    try {
      const response = await fetch(`${config.api.baseURL}/api/review/approve/${transaction.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_type: expenseType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error && errorData.error.includes('already exists')) {
          // Transaction already exists, just mark it as processed
          setSuccess('Transaction already exists - marked as processed');
          // Remove from list since it's already in main table
          setTransactions(transactions.filter(t => t.id !== transaction.id));
          setTotal(total - 1);
          return;
        }
        throw new Error(errorData.error || 'Failed to approve transaction');
      }
      
      await response.json();
      setSuccess(`Transaction approved as ${expenseType}`);
      
      // Remove from list
      setTransactions(transactions.filter(t => t.id !== transaction.id));
      setTotal(total - 1);
    } catch (err) {
      console.error('Error approving transaction:', err);
      setError('Failed to approve transaction');
    } finally {
      setProcessing({ ...processing, [transaction.id]: false });
    }
  };

  const handleExclude = async (transaction: PendingTransaction) => {
    setProcessing({ ...processing, [transaction.id]: true });
    
    try {
      const response = await fetch(`${config.api.baseURL}/api/review/exclude/${transaction.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Personal expense' }),
      });

      if (!response.ok) throw new Error('Failed to exclude transaction');
      
      setSuccess('Transaction excluded');
      
      // Remove from list
      setTransactions(transactions.filter(t => t.id !== transaction.id));
      setTotal(total - 1);
    } catch (err) {
      console.error('Error excluding transaction:', err);
      setError('Failed to exclude transaction');
    } finally {
      setProcessing({ ...processing, [transaction.id]: false });
    }
  };

  const handleBulkApprove = async (type: string) => {
    const totalTransactionsOfType = globalSummary[type] || 0;
    
    if (totalTransactionsOfType === 0) {
      setError('No pending transactions found for this type');
      return;
    }
    
    const confirmMessage = `Approve all ${totalTransactionsOfType} ${type} transactions across the entire database?`;
    if (!window.confirm(confirmMessage)) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`${config.api.baseURL}/api/review/bulk-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulk_type: type,  // Use bulk_type to process ALL transactions of this type
          expense_type: type
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to bulk approve');
      }

      const result = await response.json();
      setSuccess(result.message);
      
      // Refresh both the transaction list and global summary
      await fetchPendingTransactions();
      await fetchGlobalSummary();
      
      // Clear filter if we just approved all transactions of this type
      if (filterCategory === type) {
        setFilterCategory(null);
      }
    } catch (err) {
      console.error('Error bulk approving:', err);
      setError('Failed to bulk approve transactions');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionsByType = () => {
    const byType: { [key: string]: number } = {};
    transactions.forEach(tx => {
      const type = tx.suggested_expense_type || 'uncategorized';
      byType[type] = (byType[type] || 0) + 1;
    });
    return byType;
  };

  const [globalSummary, setGlobalSummary] = useState<{ [key: string]: number }>({});

  const fetchGlobalSummary = async () => {
    try {
      console.log('Fetching global summary...');
      const response = await fetch(`${config.api.baseURL}/api/review/pending-summary`);
      if (response.ok) {
        const data = await response.json();
        console.log('Global summary data:', data);
        setGlobalSummary(data);
      } else {
        console.error('Failed to fetch global summary, status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching global summary:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const formatDescription = (description: string) => {
    // Clean up common bank description patterns
    return description
      .replace(/\s+/g, ' ')
      .replace(/DES:|ID:|INDN:|CO ID:/g, '')
      .trim();
  };

  if (loading && transactions.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  const typesSummary = getTransactionsByType(); // Displayed transactions
  
  // No need to filter here - backend handles the filtering
  const filteredTransactions = transactions;

  // Calculate total pending from global summary
  const totalGlobalPending = Object.values(globalSummary).reduce((sum, count) => sum + count, 0);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Review Transactions</Typography>
        <Badge badgeContent={totalGlobalPending || total} color="primary" max={999}>
          <ReviewIcon fontSize="large" />
        </Badge>
      </Box>

      {/* Toast Notifications */}
      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        TransitionComponent={Slide}
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
        TransitionComponent={Slide}
      >
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>

      {/* Summary Cards */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        {filterCategory && (
          <Button
            variant="text"
            onClick={() => {
              setFilterCategory(null);
              setPage(0); // Reset to first page
            }}
            sx={{ mb: 1 }}
          >
            Clear Filter ({filterCategory})
          </Button>
        )}
      </Box>
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        {/* Use global summary if available, otherwise fall back to displayed transactions */}
        {Object.keys(globalSummary).length > 0 ? (
          // Show cards based on global database counts
          Object.entries(globalSummary).map(([type, globalCount]) => {
            const displayedCount = typesSummary[type] || 0;
            
            return (
              <Card 
                key={type} 
                sx={{ 
                  minWidth: 150,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: filterCategory === type ? 2 : 0,
                  borderColor: 'primary.main',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => {
                  const newFilter = filterCategory === type ? null : type;
                  setFilterCategory(newFilter);
                  setPage(0); // Reset to first page when changing filter
                }}
              >
                <CardContent>
                  <Typography variant="h6">
                    {globalCount}
                    {displayedCount > 0 && displayedCount !== globalCount && (
                      <Typography component="span" variant="body2" color="text.secondary">
                        {' '}({displayedCount} shown)
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {type || 'uncategorized'}
                  </Typography>
                  {globalCount > 0 && type !== 'uncategorized' && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBulkApprove(type);
                      }}
                      startIcon={<CheckCircleIcon />}
                    >
                      Approve All ({globalCount})
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          // Fallback: Show cards based on displayed transactions (old behavior)
          Object.entries(typesSummary).map(([type, displayedCount]) => (
            <Card 
              key={type} 
              sx={{ 
                minWidth: 150,
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: filterCategory === type ? 2 : 0,
                borderColor: 'primary.main',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3
                }
              }}
              onClick={() => setFilterCategory(filterCategory === type ? null : type)}
            >
              <CardContent>
                <Typography variant="h6">{displayedCount}</Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {type || 'uncategorized'}
                </Typography>
                {displayedCount > 0 && type !== 'uncategorized' && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBulkApprove(type);
                    }}
                    startIcon={<CheckCircleIcon />}
                  >
                    Approve All
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </Box>

      {/* Transactions Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Suggested Type</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTransactions.map((transaction) => {
              const isIncome = transaction.amount > 0;
              const isProcessing = processing[transaction.id];
              
              return (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {format(new Date(transaction.posted_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 400 }}>
                      {formatDescription(transaction.description)}
                    </Typography>
                    {transaction.payee && (
                      <Typography variant="caption" color="textSecondary">
                        {transaction.payee}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={isIncome ? 'success.main' : 'text.primary'}
                      fontWeight="medium"
                    >
                      {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {transaction.suggested_expense_type && (
                      <Chip
                        label={transaction.suggested_expense_type}
                        size="small"
                        color={transaction.confidence_score && transaction.confidence_score > 0.8 ? 'success' : 'default'}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <Select
                        value={selectedTypes[transaction.id] || ''}
                        onChange={(e) => setSelectedTypes({
                          ...selectedTypes,
                          [transaction.id]: e.target.value
                        })}
                        disabled={isProcessing}
                      >
                        {expenseTypes.map((type) => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell align="center">
                    <ButtonGroup size="small" disabled={isProcessing}>
                      <Tooltip title="Approve">
                        <IconButton
                          color="success"
                          onClick={() => handleApprove(transaction)}
                        >
                          <CheckIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Exclude (Personal)">
                        <IconButton
                          color="error"
                          onClick={() => handleExclude(transaction)}
                        >
                          <CloseIcon />
                        </IconButton>
                      </Tooltip>
                    </ButtonGroup>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>

      {filteredTransactions.length === 0 && !loading && (
        <Box textAlign="center" py={5}>
          <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {filterCategory ? `No ${filterCategory} transactions` : 'All caught up!'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {filterCategory ? 'Try selecting a different category' : 'No transactions need review.'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
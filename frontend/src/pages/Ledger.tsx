import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Chip,
  TablePagination,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { apiService } from '../services/api';
import { CATEGORY_COLORS as COLORS } from '../constants/categoryColors';

interface LedgerEntry {
  entry_type: 'income' | 'expense';
  id: number;
  date: string;
  accrual_date: string;
  cash_date: string;
  amount: string;
  description: string;
  category: string;
  party: string;
  notes: string;
  tracking_id?: string;
  payment_status?: string;
  running_balance: string;
}

interface LedgerTotals {
  total_income: string;
  total_expenses: string;
  net_income: string;
}

export default function Ledger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [totals, setTotals] = useState<LedgerTotals>({
    total_income: '0',
    total_expenses: '0',
    net_income: '0',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters - default to showing all of 2025
  const [startDate, setStartDate] = useState<Date | null>(startOfYear(new Date(2025, 0, 1)));
  const [endDate, setEndDate] = useState<Date | null>(endOfYear(new Date()));
  const [entryType, setEntryType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'list' | 'summary'>('list');
  const [basisType, setBasisType] = useState<'accrual' | 'cash'>('accrual');
  
  // Pagination - default to 50 rows to show more data
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  useEffect(() => {
    fetchLedgerData();
  }, [startDate, endDate, entryType, searchTerm, basisType, page, rowsPerPage]);

  const fetchLedgerData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      };
      
      if (startDate) params.start_date = format(startDate, 'yyyy-MM-dd');
      if (endDate) params.end_date = format(endDate, 'yyyy-MM-dd');
      if (entryType !== 'all') params.type = entryType;
      if (searchTerm) params.search = searchTerm;
      params.basis = basisType;
      
      const response = await apiService.getLedger(params);
      setEntries(response.data.entries);
      setTotals(response.data.totals);
    } catch (err: any) {
      console.error('Error fetching ledger data:', err);
      setError(err.message || 'Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getCategoryChip = (category: string, entryType: 'income' | 'expense') => {
    const color = COLORS[category as keyof typeof COLORS] || COLORS.other;
    const label = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    return (
      <Chip
        label={label}
        size="small"
        sx={{
          backgroundColor: color,
          color: 'white',
          fontWeight: 'bold',
        }}
      />
    );
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(num));
  };

  const getEntryColor = (entryType: 'income' | 'expense') => {
    return entryType === 'income' ? '#4CAF50' : '#f44336';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Typography variant="h4" gutterBottom>
          General Ledger
        </Typography>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Income
                </Typography>
                <Typography variant="h5" sx={{ color: '#4CAF50' }}>
                  {formatCurrency(totals.total_income)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Expenses
                </Typography>
                <Typography variant="h5" sx={{ color: '#f44336' }}>
                  {formatCurrency(totals.total_expenses)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Net Income
                </Typography>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    color: parseFloat(totals.net_income) >= 0 ? '#4CAF50' : '#f44336' 
                  }}
                >
                  {formatCurrency(totals.net_income)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={2}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Accounting Basis"
                value={basisType}
                onChange={(e) => setBasisType(e.target.value as any)}
              >
                <MenuItem value="accrual">Accrual Basis</MenuItem>
                <MenuItem value="cash">Cash Basis</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Type"
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as any)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="income">Income Only</MenuItem>
                <MenuItem value="expense">Expenses Only</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search description or party..."
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <ToggleButtonGroup
                value={view}
                exclusive
                onChange={(e, newView) => newView && setView(newView)}
                size="small"
                fullWidth
              >
                <ToggleButton value="list">List View</ToggleButton>
                <ToggleButton value="summary" disabled>
                  Summary View
                </ToggleButton>
              </ToggleButtonGroup>
            </Grid>
          </Grid>
        </Paper>

        {/* Data Table */}
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Sort Date</TableCell>
                  <TableCell>Accrual Date</TableCell>
                  <TableCell>Cash Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Party</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Running Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={`${entry.entry_type}-${entry.id}`}>
                    <TableCell>
                      {format(new Date(entry.date), 'MM/dd/yyyy')}
                    </TableCell>
                    <TableCell>
                      {entry.entry_type === 'income' && entry.accrual_date ? (
                        <span style={{ color: basisType === 'accrual' ? '#1976d2' : '#666' }}>
                          {format(new Date(entry.accrual_date), 'MM/dd/yyyy')}
                        </span>
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.entry_type === 'income' && entry.cash_date ? (
                        <span style={{ color: basisType === 'cash' ? '#1976d2' : '#666' }}>
                          {format(new Date(entry.cash_date), 'MM/dd/yyyy')}
                        </span>
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={entry.entry_type === 'income' ? 'Income' : 'Expense'}
                        size="small"
                        sx={{
                          backgroundColor: getEntryColor(entry.entry_type),
                          color: 'white',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {entry.description}
                      {entry.tracking_id && (
                        <Typography variant="caption" display="block" color="textSecondary">
                          {entry.tracking_id}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {getCategoryChip(entry.category, entry.entry_type)}
                    </TableCell>
                    <TableCell>{entry.party || '-'}</TableCell>
                    <TableCell 
                      align="right"
                      sx={{ 
                        color: getEntryColor(entry.entry_type),
                        fontWeight: 'bold'
                      }}
                    >
                      {entry.entry_type === 'income' ? '+' : '-'}
                      {formatCurrency(entry.amount)}
                    </TableCell>
                    <TableCell 
                      align="right"
                      sx={{ 
                        fontWeight: 'bold',
                        color: parseFloat(entry.running_balance) >= 0 ? '#4CAF50' : '#f44336'
                      }}
                    >
                      {formatCurrency(entry.running_balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={-1} // We don't have total count from API yet
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </TableContainer>
        )}
      </Box>
    </LocalizationProvider>
  );
}
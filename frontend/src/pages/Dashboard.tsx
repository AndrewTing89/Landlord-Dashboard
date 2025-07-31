import { useEffect, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  Chip,
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
  Tabs,
  Tab,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as ReceiptIcon,
  AttachMoney as AttachMoneyIcon,
  Sync as SyncIcon,
  Payment as PaymentIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { apiService } from '../services/api';
import { ExpenseSummary, Transaction, PaymentRequest } from '../types';
import { format } from 'date-fns';

const COLORS = {
  electricity: '#0088FE',
  water: '#00C49F',
  maintenance: '#FFBB28',
  landscape: '#82ca9d',
  internet: '#8dd1e1',
  property_tax: '#d084d0',
  rent: '#FF8042',
  other: '#8884D8',
  insurance: '#ffa500',
  // Map formatted names to colors
  'Electricity': '#0088FE',
  'Water': '#00C49F',
  'Maintenance': '#FFBB28',
  'Landscape': '#82ca9d',
  'Internet': '#8dd1e1',
  'Property Tax': '#d084d0',
  'Rent': '#FF8042',
  'Other': '#8884D8',
  'Insurance': '#ffa500',
};

interface MonthDetailDialogState {
  open: boolean;
  month: string;
  year: number;
  data: any;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ExpenseSummary[]>([]);
  const [ytdTotals, setYtdTotals] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentRequest[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [monthDialog, setMonthDialog] = useState<MonthDetailDialogState>({
    open: false,
    month: '',
    year: new Date().getFullYear(),
    data: null,
  });
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchMonthTransactions = async (month: string, year: number) => {
    try {
      const monthNumber = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month) + 1;
      const startDate = new Date(year, monthNumber - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, monthNumber, 0).toISOString().split('T')[0];
      
      const response = await apiService.getTransactions({
        start_date: startDate,
        end_date: endDate
      });
      
      // Filter out 'other' transactions
      const propertyTransactions = response.data.filter(
        (tx: Transaction) => tx.expense_type !== 'other'
      );
      
      setMonthTransactions(propertyTransactions);
    } catch (error) {
      console.error('Error fetching month transactions:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      // Fetch all data in parallel
      const [summaryRes, transactionsRes, paymentsRes, monthlyRes] = await Promise.all([
        apiService.getSummary(currentYear), // Year only for YTD summary
        apiService.getTransactions({ 
          start_date: new Date(currentYear, 0, 1).toISOString().split('T')[0], // Start of year
          end_date: new Date().toISOString().split('T')[0], // Today
        }),
        apiService.getPaymentRequests({ status: 'pending' }),
        apiService.getMonthlyComparison(currentYear),
      ]);

      // Handle the new API response structure
      if (summaryRes.data.summary) {
        setSummary(summaryRes.data.summary);
        setYtdTotals(summaryRes.data.ytdTotals);
      } else {
        // Backward compatibility
        setSummary(summaryRes.data);
      }
      
      // Show only property expense transactions (exclude 'other', 'rent', and 'utility_reimbursement')
      const expenseTransactions = transactionsRes.data.filter(
        (tx: Transaction) => tx.expense_type !== 'other' && tx.expense_type !== 'rent' && tx.expense_type !== 'utility_reimbursement'
      );
      setRecentTransactions(expenseTransactions);
      setPendingPayments(paymentsRes.data);
      setMonthlyData(monthlyRes.data);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await apiService.syncTransactions();
      
      // Show success message
      if (response.data.success) {
        console.log('Sync completed:', response.data.message);
        // Refresh the dashboard data
        await fetchDashboardData();
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      // Show a more user-friendly error
      if (err.response?.data?.error) {
        setError(`Sync failed: ${err.response.data.error}`);
      } else {
        setError('Failed to sync transactions. Please connect your bank account first.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const calculateTotals = () => {
    const totalRevenue = parseFloat(summary.find(s => s.expense_type === 'rent')?.total_amount || '0');
    const totalExpenses = summary
      .filter(s => s.expense_type !== 'rent' && s.expense_type !== 'utility_reimbursement')
      .reduce((sum, s) => sum + parseFloat(s.total_amount), 0);
    const netIncome = totalRevenue - totalExpenses;

    return { totalRevenue, totalExpenses, netIncome };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getRevenueExpenseData = () => {
    return monthlyData || [];
  };

  const handleMonthClick = async (data: any, index: number) => {
    if (!data) return;
    
    const month = data.activeLabel || data.month;
    const year = new Date().getFullYear();
    
    // Find the data for the clicked month
    const monthData = monthlyData.find(m => m.month === month);
    
    if (monthData) {
      setMonthDialog({
        open: true,
        month: month,
        year: year,
        data: monthData
      });
      
      // Fetch transactions for this month
      await fetchMonthTransactions(month, year);
    }
  };

  const handleCloseDialog = () => {
    setMonthDialog({
      open: false,
      month: '',
      year: new Date().getFullYear(),
      data: null
    });
    setMonthTransactions([]);
    setTabValue(0);
  };

  const getExpenseBreakdown = () => {
    const breakdown: { [key: string]: number } = {};
    
    monthTransactions.forEach(tx => {
      if (tx.expense_type !== 'rent' && tx.expense_type !== 'utility_reimbursement') {
        breakdown[tx.expense_type] = (breakdown[tx.expense_type] || 0) + tx.amount;
      }
    });
    
    return Object.entries(breakdown)
      .map(([type, amount]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
        value: amount
      }))
      .sort((a, b) => b.value - a.value);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const { totalRevenue, totalExpenses, netIncome } = calculateTotals();
  const chartData = summary
    .filter(s => s.expense_type && s.expense_type !== 'rent' && s.expense_type !== 'other' && s.expense_type !== 'utility_reimbursement' && parseFloat(s.total_amount) > 0)
    .map(s => ({
      name: s.expense_type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      value: parseFloat(s.total_amount),
    }));

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">YTD Dashboard</Typography>
        <Button
          variant="contained"
          startIcon={<SyncIcon />}
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Revenue (YTD)
                  </Typography>
                  <Typography variant="h5">
                    {formatCurrency(totalRevenue)}
                  </Typography>
                </Box>
                <AttachMoneyIcon color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Expenses (YTD)
                  </Typography>
                  <Typography variant="h5">
                    {formatCurrency(totalExpenses)}
                  </Typography>
                </Box>
                <ReceiptIcon color="error" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Net Income (YTD)
                  </Typography>
                  <Typography variant="h5" color={netIncome >= 0 ? 'success.main' : 'error.main'}>
                    {formatCurrency(netIncome)}
                  </Typography>
                </Box>
                {netIncome >= 0 ? (
                  <TrendingUpIcon color="success" fontSize="large" />
                ) : (
                  <TrendingDownIcon color="error" fontSize="large" />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Pending Payments
                  </Typography>
                  <Typography variant="h5">
                    {pendingPayments.length}
                  </Typography>
                </Box>
                <PaymentIcon color="warning" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* YTD Totals Section - Only show for 2025 */}
      {ytdTotals && new Date().getFullYear() === 2025 && (
        <Card sx={{ mb: 3, backgroundColor: '#f5f5f5' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              2025 Year-to-Date Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Expected Rent Income
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(ytdTotals.expectedRentIncome)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    ${1685}/month × {Math.floor(ytdTotals.expectedRentIncome / 1685)} months
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Total Expenses
                  </Typography>
                  <Typography variant="h6" color="error">
                    {formatCurrency(ytdTotals.totalExpenses)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Utility Reimbursements
                  </Typography>
                  <Typography variant="h6" color="success">
                    {formatCurrency(ytdTotals.utilityReimbursements)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Net Income YTD
                  </Typography>
                  <Typography 
                    variant="h6" 
                    color={ytdTotals.netIncome >= 0 ? 'success' : 'error'}
                    fontWeight="bold"
                  >
                    {formatCurrency(ytdTotals.netIncome)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Charts and Recent Activity */}
      <Grid container spacing={3}>
        {/* Expense Breakdown Chart */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Expense Breakdown
              </Typography>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || COLORS.other} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="textSecondary" align="center">
                  No expense data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Transactions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Expenses YTD
              </Typography>
              {recentTransactions.length > 0 ? (
                <Box sx={{ height: 300, overflowY: 'auto' }}>
                  {recentTransactions.map((transaction) => (
                    <Box
                      key={transaction.id}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      py={1}
                      px={1}
                      borderBottom="1px solid #eee"
                      sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                    >
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" noWrap>{transaction.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {format(new Date(transaction.date), 'MMM dd, yyyy')}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1} flexShrink={0}>
                        <Chip
                          label={transaction.expense_type ? transaction.expense_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Unknown'}
                          size="small"
                          color="default"
                          sx={{ minWidth: 80 }}
                        />
                        <Typography
                          variant="body2"
                          color="text.primary"
                          sx={{ minWidth: 80, textAlign: 'right' }}
                        >
                          {formatCurrency(transaction.amount)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                  <Box py={1} px={1} sx={{ position: 'sticky', bottom: 0, backgroundColor: 'background.paper', borderTop: '2px solid #eee' }}>
                    <Typography variant="caption" color="textSecondary">
                      {recentTransactions.length} expenses total
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No recent transactions
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Pending Payment Requests */}
        {pendingPayments.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Pending Payment Requests
                </Typography>
                <Grid container spacing={2}>
                  {pendingPayments.map((payment) => (
                    <Grid item xs={12} sm={6} md={4} key={payment.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="body2" gutterBottom>
                            {payment.roommate_name}
                          </Typography>
                          <Typography variant="h6" color="primary">
                            {formatCurrency(payment.amount)}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {payment.bill_type} - {format(new Date(payment.request_date), 'MMM yyyy')}
                          </Typography>
                          <Box mt={1}>
                            <Button
                              variant="contained"
                              size="small"
                              fullWidth
                              href={payment.venmo_link}
                              target="_blank"
                            >
                              Open in Venmo
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Revenue vs Expenses Chart */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Revenue vs Expenses Comparison
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={getRevenueExpenseData()}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  onClick={handleMonthClick}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar 
                    dataKey="revenue" 
                    fill="#4caf50"
                    name="Revenue"
                  />
                  <Bar 
                    dataKey="expenses" 
                    fill="#f44336"
                    name="Expenses"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Monthly Breakdown Dialog */}
      <Dialog 
        open={monthDialog.open} 
        onClose={handleCloseDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {monthDialog.month} {monthDialog.year} - Financial Breakdown
            </Typography>
            <IconButton onClick={handleCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {monthDialog.data && (
            <Box>
              {/* Summary Cards */}
              <Grid container spacing={2} mb={3}>
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Revenue
                      </Typography>
                      <Typography variant="h5" color="success.main">
                        {formatCurrency(monthDialog.data.revenue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Expenses
                      </Typography>
                      <Typography variant="h5" color="error.main">
                        {formatCurrency(monthDialog.data.expenses)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Net Income
                      </Typography>
                      <Typography 
                        variant="h5" 
                        color={monthDialog.data.netIncome >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(monthDialog.data.netIncome)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Tabs */}
              <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
                <Tab label="Expense Breakdown" />
                <Tab label="Transaction List" />
              </Tabs>

              {/* Tab Content */}
              {tabValue === 0 && (
                <Box mt={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    Expense Categories
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getExpenseBreakdown()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}

              {tabValue === 1 && (
                <Box mt={3}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {monthTransactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell>
                              {format(new Date(tx.date), 'MMM dd')}
                            </TableCell>
                            <TableCell>{tx.name}</TableCell>
                            <TableCell>
                              <Chip 
                                label={tx.expense_type} 
                                size="small"
                                color={tx.expense_type === 'rent' ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                variant="body2"
                                color={tx.expense_type === 'rent' ? 'success.main' : 'text.primary'}
                              >
                                {tx.expense_type === 'rent' ? '+' : '-'}{formatCurrency(tx.amount)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
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
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  styled,
  stepConnectorClasses,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as ReceiptIcon,
  AttachMoney as AttachMoneyIcon,
  Sync as SyncIcon,
  Close as CloseIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import {
  AccountBalance as BankIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { apiService } from '../services/api';
import { ExpenseSummary, Transaction, PaymentRequest } from '../types';
import { format } from 'date-fns';
import { CATEGORY_COLORS, getCategoryChip } from '../constants/categoryColors';

// Map formatted names to colors for backward compatibility
const COLORS = {
  ...CATEGORY_COLORS,
  'Electricity': CATEGORY_COLORS.electricity,
  'Water': CATEGORY_COLORS.water,
  'Supplies': CATEGORY_COLORS.supplies,
  'Maintenance': CATEGORY_COLORS.maintenance,
  'Cleaning/Maintenance': CATEGORY_COLORS.cleaning_maintenance,
  'Landscape': CATEGORY_COLORS.landscape,
  'Internet': CATEGORY_COLORS.internet,
  'Property Tax': CATEGORY_COLORS.property_tax,
  'Rent': CATEGORY_COLORS.rent,
  'Other': CATEGORY_COLORS.other,
  'Insurance': CATEGORY_COLORS.insurance,
};

// Custom styled connector for the status stepper
const StatusConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 10,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundColor: theme.palette.primary.main,
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundColor: theme.palette.primary.main,
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 2,
    border: 0,
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#eaeaf0',
    borderRadius: 1,
  },
}));

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
  const [recentIncome, setRecentIncome] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentRequest[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [syncingBank, setSyncingBank] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
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
      const [summaryRes, transactionsRes, incomeRes, paymentsRes, monthlyRes] = await Promise.all([
        apiService.getSummary(currentYear), // Year only for YTD summary
        apiService.getTransactions({ 
          start_date: new Date(currentYear, 0, 1).toISOString().split('T')[0], // Start of year
          end_date: new Date().toISOString().split('T')[0], // Today
        }),
        apiService.getLedger({ 
          start_date: new Date(currentYear, 0, 1).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          type: 'income' 
        }),
        apiService.getPaymentRequests({ status: 'pending,sent' }),
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
      setRecentIncome(incomeRes.data.entries || []);
      setPendingPayments(paymentsRes.data);
      setMonthlyData(monthlyRes.data);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBankSync = async () => {
    try {
      setSyncingBank(true);
      setError(null);
      const response = await apiService.post('/api/dashboard-sync/bank');
      
      if (response.data.success) {
        console.log('Bank sync completed:', response.data);
        alert(`Bank sync completed! Imported ${response.data.imported} transactions, ${response.data.billsProcessed} bills processed.`);
        await fetchDashboardData();
      }
    } catch (err: any) {
      console.error('Bank sync error:', err);
      if (err.response?.data?.error) {
        setError(`Bank sync failed: ${err.response.data.error}`);
      } else {
        setError('Failed to sync bank transactions. Please check your connection.');
      }
    } finally {
      setSyncingBank(false);
    }
  };

  const handleGmailSync = async () => {
    try {
      setSyncingGmail(true);
      setError(null);
      const response = await apiService.post('/api/dashboard-sync/gmail');
      
      if (response.data.success) {
        console.log('Gmail sync completed:', response.data);
        alert(`Gmail sync completed! Found ${response.data.emailsFound} emails, matched ${response.data.matched} to payments.`);
        await fetchDashboardData();
      }
    } catch (err: any) {
      console.error('Gmail sync error:', err);
      if (err.response?.data?.error) {
        setError(`Gmail sync failed: ${err.response.data.error}`);
      } else {
        setError('Failed to sync Gmail. Please check your Gmail connection.');
      }
    } finally {
      setSyncingGmail(false);
    }
  };

  const calculateTotals = () => {
    // Use ytdTotals if available (for 2025 data), otherwise fall back to summary calculation
    if (ytdTotals) {
      return {
        totalRevenue: ytdTotals.actualRentIncome + ytdTotals.utilityReimbursements,
        totalExpenses: ytdTotals.totalExpenses,
        netIncome: ytdTotals.netIncome
      };
    }
    
    // Fallback for non-2025 data
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

  const getBillTypeChip = (type: string | null) => {
    const chipConfig = getCategoryChip(type);
    return (
      <Chip
        label={chipConfig.label}
        size="small"
        sx={{ 
          backgroundColor: chipConfig.backgroundColor,
          color: chipConfig.color,
          fontWeight: 500
        }}
      />
    );
  };

  const getPaymentStatus = (request: PaymentRequest) => {
    const hasRequestSent = request.status === 'sent';
    const hasPaymentReceived = request.status === 'paid';
    
    const steps = [
      { 
        label: 'Record Created',
        completed: true,
        active: request.status === 'pending'
      },
      { 
        label: hasRequestSent ? 'Request: Sent' : 'Request: Pending',
        completed: hasRequestSent || hasPaymentReceived,
        active: hasRequestSent && !hasPaymentReceived
      },
      { 
        label: hasPaymentReceived ? 'Payment: Received' : 'Payment: Pending',
        completed: hasPaymentReceived,
        active: false
      }
    ];
    return steps;
  };

  const handleSendToDiscord = async (request: PaymentRequest) => {
    try {
      const response = await apiService.sendPaymentSMS(request.id);
      if (response.data.success) {
        // Refresh the list
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Error sending to Discord:', err);
    }
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
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={syncingBank ? <CircularProgress size={18} /> : <BankIcon />}
            onClick={handleBankSync}
            disabled={syncingBank || syncingGmail}
            size="small"
          >
            {syncingBank ? 'Syncing...' : 'Sync Bank (2 weeks)'}
          </Button>
          <Button
            variant="outlined"
            startIcon={syncingGmail ? <CircularProgress size={18} /> : <EmailIcon />}
            onClick={handleGmailSync}
            disabled={syncingBank || syncingGmail}
            size="small"
          >
            {syncingGmail ? 'Syncing...' : 'Sync Gmail (2 weeks)'}
          </Button>
        </Box>
      </Box>

      {/* Summary Cards - Now with 6 cards */}
      <Grid container spacing={3} mb={3}>
        {/* Row 1 */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Rent Collected
                  </Typography>
                  <Typography variant="h6">
                    {ytdTotals ? formatCurrency(ytdTotals.actualRentIncome) : '$0'}
                  </Typography>
                </Box>
                <AttachMoneyIcon color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Utility Reimb.
                  </Typography>
                  <Typography variant="h6">
                    {ytdTotals ? formatCurrency(ytdTotals.utilityReimbursements) : '$0'}
                  </Typography>
                </Box>
                <AttachMoneyIcon color="info" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Revenue
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {formatCurrency(totalRevenue)}
                  </Typography>
                </Box>
                <AttachMoneyIcon color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Expenses
                  </Typography>
                  <Typography variant="h6" color="error.main">
                    {formatCurrency(totalExpenses)}
                  </Typography>
                </Box>
                <ReceiptIcon color="error" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Net Income
                  </Typography>
                  <Typography variant="h6" color={netIncome >= 0 ? 'success.main' : 'error.main'}>
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

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Net (After Tax)
                  </Typography>
                  <Typography variant="h6" color={ytdTotals?.netIncomeAfterTax >= 0 ? 'success.main' : 'error.main'}>
                    {ytdTotals ? formatCurrency(ytdTotals.netIncomeAfterTax) : '$0'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Tax: {ytdTotals ? formatCurrency(ytdTotals.propertyTax) : '$11,000'}
                  </Typography>
                </Box>
                {ytdTotals?.netIncomeAfterTax >= 0 ? (
                  <TrendingUpIcon color="success" fontSize="large" />
                ) : (
                  <TrendingDownIcon color="error" fontSize="large" />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>


      {/* Revenue vs Expenses Chart - Moved to top after cards */}
      <Grid container spacing={3} mb={3}>
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
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#f5f5f5' }}
                  />
                  <Legend />
                  
                  {/* Revenue Bars - stacked */}
                  <Bar 
                    dataKey="rent" 
                    stackId="revenue"
                    fill="#4CAF50"
                    name="Rent"
                  />
                  <Bar 
                    dataKey="reimbursements" 
                    stackId="revenue"
                    fill="#81C784"
                    name="Reimbursements"
                  />
                  
                  {/* Expense Bars - stacked */}
                  <Bar 
                    dataKey="electricity" 
                    stackId="expenses"
                    fill={COLORS.electricity}
                    name="Electricity"
                  />
                  <Bar 
                    dataKey="water" 
                    stackId="expenses"
                    fill={COLORS.water}
                    name="Water"
                  />
                  <Bar 
                    dataKey="internet" 
                    stackId="expenses"
                    fill={COLORS.internet}
                    name="Internet"
                  />
                  <Bar 
                    dataKey="maintenance" 
                    stackId="expenses"
                    fill={COLORS.maintenance}
                    name="Maintenance"
                  />
                  <Bar 
                    dataKey="landscape" 
                    stackId="expenses"
                    fill={COLORS.landscape}
                    name="Landscape"
                  />
                  <Bar 
                    dataKey="property_tax" 
                    stackId="expenses"
                    fill={COLORS.property_tax}
                    name="Property Tax"
                  />
                  <Bar 
                    dataKey="insurance" 
                    stackId="expenses"
                    fill={COLORS.insurance}
                    name="Insurance"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Expense Pie Chart and YTD Table Side by Side */}
      <Grid container spacing={3}>
        {/* Expense Breakdown Pie Chart */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Expense Breakdown
              </Typography>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
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

        {/* Expenses YTD Scrolling Table */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Expenses YTD
              </Typography>
              {recentTransactions.length > 0 ? (
                <Box sx={{ height: 350, overflowY: 'auto' }}>
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
                          -{formatCurrency(transaction.amount)}
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
                  {pendingPayments.map((request) => (
                    <Grid item xs={12} sm={6} md={4} key={request.id}>
                      <Card variant="outlined">
                        <CardContent>
                          {/* Header with name and amount */}
                          <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                            <Box>
                              <Typography variant="body2" color="textSecondary">
                                {request.roommate_name}
                              </Typography>
                              <Typography variant="h5">
                                {formatCurrency(request.amount)}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                of {formatCurrency(request.total_amount || request.amount)} total
                              </Typography>
                            </Box>
                            <Chip
                              label="pending"
                              color="default"
                              size="small"
                              icon={<ScheduleIcon />}
                            />
                          </Box>
                          
                          {/* Bill details */}
                          <Box mb={1}>
                            <Typography variant="subtitle2" gutterBottom>
                              {request.company_name || request.merchant_name || 
                               (request.bill_type === 'electricity' ? 'PG&E' : 
                                request.bill_type === 'water' ? 'Great Oaks Water' : 
                                request.bill_type === 'rent' ? 'Monthly Rent' : request.bill_type)}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mb={1}>
                              {getBillTypeChip(request.bill_type)}
                              {request.tracking_id && (
                                <Chip
                                  label={request.tracking_id}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              )}
                            </Box>
                            <Typography variant="body2" color="textSecondary">
                              Bill Date: <strong>{request.charge_date ? format(new Date(request.charge_date), 'MMM dd, yyyy') : 'N/A'}</strong>
                            </Typography>
                          </Box>
                          
                          {/* Status Stepper */}
                          <Box sx={{ mb: 2, mt: 1 }}>
                            <Stepper 
                              activeStep={getPaymentStatus(request).findIndex(s => s.active)} 
                              alternativeLabel
                              connector={<StatusConnector />}
                              sx={{ 
                                '& .MuiStepLabel-label': { 
                                  fontSize: '0.75rem',
                                  mt: 0.5
                                },
                                '& .MuiStepIcon-root': {
                                  fontSize: '1rem'
                                }
                              }}
                            >
                              {getPaymentStatus(request).map((step, index) => (
                                <Step key={index} completed={step.completed}>
                                  <StepLabel>{step.label}</StepLabel>
                                </Step>
                              ))}
                            </Stepper>
                          </Box>
                          
                          {/* Action buttons */}
                          <Box display="flex" gap={1} mt={2}>
                            <Button
                              variant="contained"
                              size="medium"
                              fullWidth
                              startIcon={<SendIcon />}
                              onClick={() => handleSendToDiscord(request)}
                              sx={{ backgroundColor: '#5865F2', '&:hover': { backgroundColor: '#4752C4' } }}
                            >
                              Send to Discord
                            </Button>
                            <Button
                              variant="contained"
                              size="medium"
                              fullWidth
                              onClick={() => window.open(request.venmo_link, '_blank')}
                              sx={{ 
                                backgroundColor: '#3D95CE', 
                                '&:hover': { backgroundColor: '#2980b9' },
                                fontWeight: 'bold'
                              }}
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
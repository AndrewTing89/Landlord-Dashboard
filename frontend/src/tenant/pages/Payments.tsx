import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { tenantApi } from '../services/api';
import { format } from 'date-fns';

interface Payment {
  id: number;
  amount: string;
  total_amount: string;
  bill_type: string;
  status: string;
  charge_date: string;
  paid_date: string;
  month: number;
  year: number;
  tracking_id: string;
  venmo_link: string;
  is_overdue: boolean;
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchPayments();
  }, [tabValue]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const status = tabValue === 0 ? 'pending,sent' : 'paid';
      const response = await tenantApi.getPayments({ status, year: currentYear });
      setPayments(response.data.data.payments);
    } catch (err: any) {
      setError('Failed to load payments');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVenmoPayment = (payment: Payment) => {
    const amount = parseFloat(payment.amount).toFixed(2);
    const note = `${payment.tracking_id || `${getMonthName(payment.month)} ${payment.bill_type}`}`;
    const venmoUrl = `https://venmo.com/andrewhting?txn=charge&amount=${amount}&note=${encodeURIComponent(note)}`;
    
    window.open(venmoUrl, '_blank');
  };

  const getMonthName = (month: number) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
  };

  const getBillTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      electricity: '#D4A017',
      water: '#9C27B0',
      internet: '#F44336',
      rent: '#4CAF50',
    };
    return colors[type] || '#757575';
  };

  const getStatusChip = (status: string) => {
    const statusConfig: { [key: string]: { label: string; color: any } } = {
      pending: { label: 'Pending', color: 'warning' },
      sent: { label: 'Request Sent', color: 'info' },
      paid: { label: 'Paid', color: 'success' },
      foregone: { label: 'Waived', color: 'default' },
    };
    const config = statusConfig[status] || { label: status, color: 'default' };
    return <Chip label={config.label} size="small" color={config.color} />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  // Calculate totals
  const totalUnpaid = payments
    .filter(p => p.status !== 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  const totalPaid = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Payment History
      </Typography>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ flex: 1, minWidth: 150 }}>
          <CardContent>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Unpaid Balance
            </Typography>
            <Typography variant="h5" color="warning.main">
              ${totalUnpaid.toFixed(2)}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 150 }}>
          <CardContent>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Paid This Year
            </Typography>
            <Typography variant="h5" color="success.main">
              ${totalPaid.toFixed(2)}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Tabs */}
      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
        <Tab label="Unpaid" />
        <Tab label="Paid" />
      </Tabs>

      {/* Payments Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Bill</TableCell>
              <TableCell>Period</TableCell>
              <TableCell>Total Bill</TableCell>
              <TableCell>Your Portion</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">
                    {tabValue === 0 ? 'No unpaid bills' : 'No payment history'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip
                        label={payment.bill_type}
                        size="small"
                        sx={{
                          bgcolor: getBillTypeColor(payment.bill_type),
                          color: 'white',
                          fontWeight: 500,
                        }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    {getMonthName(payment.month)} {payment.year}
                  </TableCell>
                  <TableCell>
                    ${parseFloat(payment.total_amount || payment.amount).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight="bold" color="primary">
                      ${parseFloat(payment.amount).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getStatusChip(payment.status)}
                  </TableCell>
                  <TableCell>
                    {payment.status !== 'paid' ? (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<PaymentIcon />}
                        onClick={() => handleVenmoPayment(payment)}
                        sx={{
                          bgcolor: '#3D95CE',
                          '&:hover': { bgcolor: '#2980b9' },
                        }}
                      >
                        Pay
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ReceiptIcon />}
                        onClick={() => {
                          // TODO: Implement receipt download
                          console.log('Download receipt for payment', payment.id);
                        }}
                      >
                        Receipt
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Payment Details Info */}
      <Card sx={{ mt: 3, bgcolor: 'info.light' }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            How payments work:
          </Typography>
          <Typography variant="body2">
            • All utility bills are split 3 ways (33.33% each)
            <br />
            • Click "Pay" to open Venmo with the exact amount pre-filled
            <br />
            • The tracking ID will be included in the payment note
            <br />
            • Payments are tracked automatically when you complete them on Venmo
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
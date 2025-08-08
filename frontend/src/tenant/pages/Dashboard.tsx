import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  Payment as PaymentIcon,
  CheckCircle as CheckIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import { tenantApi } from '../services/api';
import { format } from 'date-fns';

interface DashboardData {
  balance: {
    totalDue: number;
    pendingPayments: number;
    paidThisMonth: number;
  };
  recentPayments: any[];
  upcomingPayment: any;
  maintenanceRequests: any[];
  leaseInfo: any;
}

interface PendingPayment {
  id: number;
  amount: string;
  total_amount: string;
  bill_type: string;
  status: string;
  due_date: string;
  month: number;
  year: number;
  tracking_id: string;
  venmo_link: string;
  company_name: string;
  is_overdue: boolean;
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, pendingRes] = await Promise.all([
        tenantApi.getDashboard(),
        tenantApi.getPendingPayments(),
      ]);

      setDashboardData(dashboardRes.data.data);
      setPendingPayments(pendingRes.data.data.payments);
    } catch (err: any) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVenmoPayment = (payment: PendingPayment) => {
    // Create Venmo deep link with pre-filled information
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

  const totalDue = dashboardData?.balance.totalDue || 0;

  return (
    <Box>
      {/* Balance Card */}
      <Card sx={{ mb: 3, bgcolor: totalDue > 0 ? 'warning.light' : 'success.light' }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" gutterBottom>
                Current Balance
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                ${totalDue.toFixed(2)}
              </Typography>
              {totalDue > 0 && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {dashboardData?.balance.pendingPayments} payment{dashboardData?.balance.pendingPayments !== 1 ? 's' : ''} pending
                </Typography>
              )}
            </Box>
            <MoneyIcon sx={{ fontSize: 48, opacity: 0.3 }} />
          </Box>
        </CardContent>
      </Card>

      {/* Pending Bills */}
      {pendingPayments.length > 0 && (
        <>
          <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
            Bills to Pay
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {pendingPayments.map((payment) => (
              <Grid item xs={12} key={payment.id}>
                <Card>
                  <CardContent>
                    {/* Bill Header */}
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          {payment.bill_type.charAt(0).toUpperCase() + payment.bill_type.slice(1)}
                        </Typography>
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
                      {payment.is_overdue && (
                        <Chip label="Overdue" color="error" size="small" />
                      )}
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Bill Details */}
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Total Bill Paid
                        </Typography>
                        <Typography variant="h6">
                          ${parseFloat(payment.total_amount || payment.amount).toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Your Portion (33%)
                        </Typography>
                        <Typography variant="h6" color="primary">
                          ${parseFloat(payment.amount).toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Bill Date
                        </Typography>
                        <Typography>
                          {format(new Date(payment.due_date), 'MMM dd, yyyy')}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Period
                        </Typography>
                        <Typography>
                          {getMonthName(payment.month)} {payment.year}
                        </Typography>
                      </Grid>
                    </Grid>

                    {/* Payment Button */}
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={<PaymentIcon />}
                      onClick={() => handleVenmoPayment(payment)}
                      sx={{
                        mt: 3,
                        bgcolor: '#3D95CE',
                        '&:hover': { bgcolor: '#2980b9' },
                        fontWeight: 'bold',
                      }}
                    >
                      Pay ${parseFloat(payment.amount).toFixed(2)} on Venmo
                    </Button>

                    {/* Tracking ID */}
                    {payment.tracking_id && (
                      <Typography variant="caption" color="textSecondary" align="center" display="block" sx={{ mt: 1 }}>
                        Reference: {payment.tracking_id}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* No Pending Payments */}
      {pendingPayments.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              All Caught Up!
            </Typography>
            <Typography color="textSecondary">
              You have no pending payments at this time.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Recent Payments Summary */}
      {dashboardData?.recentPayments && dashboardData.recentPayments.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Payments
            </Typography>
            {dashboardData.recentPayments.slice(0, 3).map((payment: any) => (
              <Box
                key={payment.id}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                py={1}
                borderBottom="1px solid #eee"
              >
                <Box>
                  <Typography variant="body2">
                    {payment.bill_type.charAt(0).toUpperCase() + payment.bill_type.slice(1)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {getMonthName(payment.month)} {payment.year}
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="body2" fontWeight="bold">
                    ${parseFloat(payment.amount).toFixed(2)}
                  </Typography>
                  <Chip label="Paid" size="small" color="success" />
                </Box>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active Maintenance Requests */}
      {dashboardData?.maintenanceRequests && dashboardData.maintenanceRequests.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Active Maintenance Requests
            </Typography>
            {dashboardData.maintenanceRequests.map((request: any) => (
              <Box
                key={request.id}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                py={1}
                borderBottom="1px solid #eee"
              >
                <Box>
                  <Typography variant="body2">
                    {request.title}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {format(new Date(request.submitted_at), 'MMM dd, yyyy')}
                  </Typography>
                </Box>
                <Chip
                  label={request.status.replace('_', ' ')}
                  size="small"
                  color={request.status === 'in_progress' ? 'primary' : 'default'}
                />
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
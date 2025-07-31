import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Assessment as AssessmentIcon,
  CalendarMonth as CalendarMonthIcon,
} from '@mui/icons-material';
import { apiService } from '../services/api';

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Annual report state
  const [annualYear, setAnnualYear] = useState(new Date().getFullYear());
  
  // Monthly report state
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth() + 1);

  const handleGenerateAnnualReport = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await apiService.generateReport('annual', annualYear);
      
      if (response.data.success) {
        setSuccess('Annual tax report generated successfully!');
        
        // If download URL is provided, open it
        if (response.data.downloadUrl) {
          window.open(response.data.downloadUrl, '_blank');
        }
      }
    } catch (err: any) {
      console.error('Error generating report:', err);
      setError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMonthlyReport = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await apiService.generateReport('monthly', monthlyYear, monthlyMonth);
      
      if (response.data.success) {
        setSuccess('Monthly report generated successfully!');
        
        // If download URL is provided, open it
        if (response.data.downloadUrl) {
          window.open(response.data.downloadUrl, '_blank');
        }
      }
    } catch (err: any) {
      console.error('Error generating report:', err);
      setError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Annual Tax Report */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AssessmentIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Annual Tax Report</Typography>
              </Box>
              
              <Typography variant="body2" color="textSecondary" paragraph>
                Generate a comprehensive tax report for your accountant. Includes all transactions,
                expense categorization, and monthly breakdowns.
              </Typography>

              <Box mb={3}>
                <TextField
                  select
                  fullWidth
                  label="Year"
                  value={annualYear}
                  onChange={(e) => setAnnualYear(parseInt(e.target.value))}
                >
                  {years.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>

              <Button
                variant="contained"
                fullWidth
                startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={handleGenerateAnnualReport}
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate Annual Report'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Report */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <CalendarMonthIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Monthly Report</Typography>
              </Box>
              
              <Typography variant="body2" color="textSecondary" paragraph>
                Generate a monthly summary of income and expenses. Perfect for tracking
                monthly cash flow and budget planning.
              </Typography>

              <Grid container spacing={2} mb={3}>
                <Grid item xs={6}>
                  <TextField
                    select
                    fullWidth
                    label="Month"
                    value={monthlyMonth}
                    onChange={(e) => setMonthlyMonth(parseInt(e.target.value))}
                  >
                    {months.map((month) => (
                      <MenuItem key={month.value} value={month.value}>
                        {month.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    select
                    fullWidth
                    label="Year"
                    value={monthlyYear}
                    onChange={(e) => setMonthlyYear(parseInt(e.target.value))}
                  >
                    {years.map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Button
                variant="contained"
                fullWidth
                startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={handleGenerateMonthlyReport}
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate Monthly Report'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Report Features
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>
                Tax Deductible Expenses
              </Typography>
              <Typography variant="body2" color="textSecondary">
                All expenses are categorized for easy tax filing, including utilities,
                maintenance, and other property-related costs.
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>
                Income Tracking
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Rental income is automatically identified and separated from expenses
                for accurate net income calculation.
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>
                Excel Format
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Reports are generated in Excel format with multiple sheets for easy
                review and sharing with your accountant.
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Typography variant="caption" color="textSecondary">
            Note: Reports are generated from synced transaction data. Make sure to sync
            your bank account regularly for accurate reports.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
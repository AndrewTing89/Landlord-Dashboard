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
} from '@mui/icons-material';

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Annual report state
  const [annualYear, setAnnualYear] = useState(new Date().getFullYear());

  const handleGenerateAnnualReport = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // Create a form to submit for download
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/generate-tax-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ year: annualYear }),
      });
      
      if (response.ok) {
        // Get the blob from the response
        const blob = await response.blob();
        
        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Tax_Report_${annualYear}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        setSuccess(`Tax report for ${annualYear} generated and downloaded successfully!`);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }
    } catch (err: any) {
      console.error('Error generating report:', err);
      setError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

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

      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <AssessmentIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h5">Annual Tax Report</Typography>
          </Box>
          
          <Typography variant="body2" color="textSecondary" paragraph>
            Generate a comprehensive tax report following IRS Schedule E format. The report includes:
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom color="primary">
                📊 Summary Sheet
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Complete income/expense overview with net rental income calculation
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom color="primary">
                📝 Detailed Transactions
              </Typography>
              <Typography variant="body2" color="textSecondary">
                All income and expenses with dates, descriptions, and amounts
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom color="primary">
                📅 Monthly Breakdown
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Month-by-month cash flow analysis and trends
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom color="primary">
                📋 Schedule E Format
              </Typography>
              <Typography variant="body2" color="textSecondary">
                IRS-compliant format ready for tax filing
              </Typography>
            </Grid>
          </Grid>

          <Box sx={{ maxWidth: 300, mx: 'auto', mb: 3 }}>
            <TextField
              select
              fullWidth
              label="Select Tax Year"
              value={annualYear}
              onChange={(e) => setAnnualYear(parseInt(e.target.value))}
              size="medium"
            >
              {years.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ maxWidth: 300, mx: 'auto' }}>
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              onClick={handleGenerateAnnualReport}
              disabled={loading}
            >
              {loading ? 'Generating Report...' : 'Generate Tax Report'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Tax Categories Included
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom color="success.main">
                ✅ Income Sources
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • Rental income<br/>
                • Utility reimbursements<br/>
                • Other property income
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom color="error.main">
                📉 Deductible Expenses
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • Utilities (Electric, Water, Internet)<br/>
                • Repairs & Maintenance<br/>
                • Property Tax & Insurance
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom color="info.main">
                📊 Professional Format
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • IRS Schedule E compliant<br/>
                • Excel format with 5 sheets<br/>
                • Ready for CPA review
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Pro Tip:</strong> Generate your tax report after syncing all bank transactions for the year. 
              The report automatically categorizes expenses according to IRS guidelines and calculates your net rental income.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
}
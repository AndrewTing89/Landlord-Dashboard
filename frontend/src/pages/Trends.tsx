import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  SelectChangeEvent,
  OutlinedInput,
} from '@mui/material';
import {
  ShowChart as ShowChartIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subMonths } from 'date-fns';
import { apiService } from '../services/api';

interface MonthlyData {
  month: string;
  electricity: number;
  water: number;
  maintenance: number;
  yard_maintenance: number;
  internet: number;
  property_tax: number;
  insurance: number;
  rent: number;
  other: number;
  total: number;
  netIncome: number;
}

interface TrendData {
  monthly: MonthlyData[];
  yearOverYear: any[];
  categoryTotals: any[];
}

const COLORS = {
  electricity: '#2196f3',
  water: '#00bcd4',
  maintenance: '#ff9800',
  yard_maintenance: '#82ca9d',
  internet: '#8dd1e1',
  property_tax: '#d084d0',
  insurance: '#ffa500',
  rent: '#4caf50',
  other: '#9c27b0',
  total: '#f44336',
  netIncome: '#4caf50',
};

export default function Trends() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<TrendData>({
    monthly: [],
    yearOverYear: [],
    categoryTotals: [],
  });
  const [timeRange, setTimeRange] = useState<'6m' | '1y' | '2y' | 'all'>('1y');
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'electricity', 'water', 'maintenance', 'yard_maintenance', 'internet', 'property_tax'
  ]);
  
  const theme = useTheme();
  useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchTrendData();
  }, [timeRange]);

  const handleCategoryChange = (event: SelectChangeEvent<typeof selectedCategories>) => {
    const value = event.target.value;
    setSelectedCategories(typeof value === 'string' ? value.split(',') : value);
  };

  const fetchTrendData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      let startDate;
      const endDate = new Date();
      
      switch (timeRange) {
        case '6m':
          startDate = subMonths(endDate, 6);
          break;
        case '1y':
          startDate = subMonths(endDate, 12);
          break;
        case '2y':
          startDate = subMonths(endDate, 24);
          break;
        default:
          startDate = subMonths(endDate, 36); // 3 years
      }

      // Fetch transactions for the period
      const response = await apiService.getTransactions({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
      });
      
      // Filter out 'other' transactions for property-related analysis
      const propertyTransactions = response.data.filter((tx: any) => tx.expense_type !== 'other');

      // Process data into monthly buckets
      const monthlyData = processMonthlyData(propertyTransactions);
      
      setTrendData({
        monthly: monthlyData,
        yearOverYear: calculateYearOverYear(monthlyData),
        categoryTotals: calculateCategoryTotals(monthlyData),
      });
    } catch (err) {
      console.error('Error fetching trend data:', err);
      setError('Failed to load trend data');
    } finally {
      setLoading(false);
    }
  };

  const processMonthlyData = (transactions: any[]): MonthlyData[] => {
    const monthlyMap = new Map<string, MonthlyData>();

    // Initialize months
    transactions.forEach(transaction => {
      const monthKey = format(new Date(transaction.date), 'yyyy-MM');
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthKey,
          electricity: 0,
          water: 0,
          maintenance: 0,
          yard_maintenance: 0,
          internet: 0,
          property_tax: 0,
          insurance: 0,
          rent: 0,
          other: 0,
          total: 0,
          netIncome: 0,
        });
      }

      const monthData = monthlyMap.get(monthKey)!;
      const amount = typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : transaction.amount;

      // Add to appropriate category
      switch (transaction.expense_type) {
        case 'electricity':
          monthData.electricity += amount;
          monthData.total += amount;
          break;
        case 'water':
          monthData.water += amount;
          monthData.total += amount;
          break;
        case 'maintenance':
          monthData.maintenance += amount;
          monthData.total += amount;
          break;
        case 'yard_maintenance':
          monthData.yard_maintenance += amount;
          monthData.total += amount;
          break;
        case 'internet':
          monthData.internet += amount;
          monthData.total += amount;
          break;
        case 'property_tax':
          monthData.property_tax += amount;
          monthData.total += amount;
          break;
        case 'insurance':
          monthData.insurance += amount;
          monthData.total += amount;
          break;
        case 'rent':
          monthData.rent += amount;
          break;
        case 'other':
        default:
          monthData.other += amount;
          monthData.total += amount;
          break;
      }
    });

    // Calculate net income
    monthlyMap.forEach((data) => {
      data.netIncome = data.rent - data.total;
      // Ensure all values are numbers, not NaN
      Object.keys(data).forEach(key => {
        if (typeof data[key as keyof MonthlyData] === 'number' && isNaN(data[key as keyof MonthlyData] as number)) {
          (data as any)[key] = 0;
        }
      });
    });

    // Convert to array and sort by month
    return Array.from(monthlyMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(data => ({
        ...data,
        month: format(new Date(data.month + '-01'), 'MMM yy'),
      }));
  };

  const calculateYearOverYear = (monthlyData: MonthlyData[]) => {
    // Group by month across years for YoY comparison
    const yoyMap = new Map<string, any>();
    
    monthlyData.forEach(data => {
      const month = data.month.split(' ')[0]; // Get just the month part
      if (!yoyMap.has(month)) {
        yoyMap.set(month, { month, years: {} });
      }
      const year = '20' + data.month.split(' ')[1];
      yoyMap.get(month)!.years[year] = data.total;
    });

    return Array.from(yoyMap.values());
  };

  const calculateCategoryTotals = (monthlyData: MonthlyData[]) => {
    const totals = {
      electricity: 0,
      water: 0,
      maintenance: 0,
      yard_maintenance: 0,
      internet: 0,
      property_tax: 0,
      insurance: 0,
    };

    monthlyData.forEach(data => {
      totals.electricity += data.electricity || 0;
      totals.water += data.water || 0;
      totals.maintenance += data.maintenance || 0;
      totals.yard_maintenance += data.yard_maintenance || 0;
      totals.internet += data.internet || 0;
      totals.property_tax += data.property_tax || 0;
      totals.insurance += data.insurance || 0;
    });

    return Object.entries(totals)
      .map(([name, value]) => ({ 
        name: name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
        value,
        key: name 
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const renderMainChart = () => {
    const data = trendData.monthly.map(month => {
      const formattedMonth = {
        ...month,
        month: format(new Date(month.month + '-01'), 'MMM yy')
      };
      return formattedMonth;
    });

    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `$${value}`} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            {selectedCategories.includes('electricity') && <Area type="monotone" dataKey="electricity" stackId="1" stroke={COLORS.electricity} fill={COLORS.electricity} name="Electricity" />}
            {selectedCategories.includes('water') && <Area type="monotone" dataKey="water" stackId="1" stroke={COLORS.water} fill={COLORS.water} name="Water" />}
            {selectedCategories.includes('maintenance') && <Area type="monotone" dataKey="maintenance" stackId="1" stroke={COLORS.maintenance} fill={COLORS.maintenance} name="Maintenance" />}
            {selectedCategories.includes('yard_maintenance') && <Area type="monotone" dataKey="yard_maintenance" stackId="1" stroke={COLORS.yard_maintenance} fill={COLORS.yard_maintenance} name="Yard Maintenance" />}
            {selectedCategories.includes('internet') && <Area type="monotone" dataKey="internet" stackId="1" stroke={COLORS.internet} fill={COLORS.internet} name="Internet" />}
            {selectedCategories.includes('property_tax') && <Area type="monotone" dataKey="property_tax" stackId="1" stroke={COLORS.property_tax} fill={COLORS.property_tax} name="Property Tax" />}
            {selectedCategories.includes('insurance') && <Area type="monotone" dataKey="insurance" stackId="1" stroke={COLORS.insurance} fill={COLORS.insurance} name="Insurance" />}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `$${value}`} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            {selectedCategories.includes('electricity') && <Bar dataKey="electricity" fill={COLORS.electricity} name="Electricity" />}
            {selectedCategories.includes('water') && <Bar dataKey="water" fill={COLORS.water} name="Water" />}
            {selectedCategories.includes('maintenance') && <Bar dataKey="maintenance" fill={COLORS.maintenance} name="Maintenance" />}
            {selectedCategories.includes('yard_maintenance') && <Bar dataKey="yard_maintenance" fill={COLORS.yard_maintenance} name="Yard Maintenance" />}
            {selectedCategories.includes('internet') && <Bar dataKey="internet" fill={COLORS.internet} name="Internet" />}
            {selectedCategories.includes('property_tax') && <Bar dataKey="property_tax" fill={COLORS.property_tax} name="Property Tax" />}
            {selectedCategories.includes('insurance') && <Bar dataKey="insurance" fill={COLORS.insurance} name="Insurance" />}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // Default line chart
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value) => `$${value}`} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
          {selectedCategories.includes('electricity') && <Line type="monotone" dataKey="electricity" stroke={COLORS.electricity} strokeWidth={2} name="Electricity" dot={false} />}
          {selectedCategories.includes('water') && <Line type="monotone" dataKey="water" stroke={COLORS.water} strokeWidth={2} name="Water" dot={false} />}
          {selectedCategories.includes('maintenance') && <Line type="monotone" dataKey="maintenance" stroke={COLORS.maintenance} strokeWidth={2} name="Maintenance" dot={false} />}
          {selectedCategories.includes('yard_maintenance') && <Line type="monotone" dataKey="yard_maintenance" stroke={COLORS.yard_maintenance} strokeWidth={2} name="Yard Maintenance" dot={false} />}
          {selectedCategories.includes('internet') && <Line type="monotone" dataKey="internet" stroke={COLORS.internet} strokeWidth={2} name="Internet" dot={false} />}
          {selectedCategories.includes('property_tax') && <Line type="monotone" dataKey="property_tax" stroke={COLORS.property_tax} strokeWidth={2} name="Property Tax" dot={false} />}
          {selectedCategories.includes('insurance') && <Line type="monotone" dataKey="insurance" stroke={COLORS.insurance} strokeWidth={2} name="Insurance" dot={false} />}
          {selectedCategories.includes('total') && <Line type="monotone" dataKey="total" stroke={COLORS.total} strokeWidth={3} strokeDasharray="5 5" name="Total Expenses" dot={false} />}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Expense Trends</Typography>
        <ShowChartIcon fontSize="large" color="primary" />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Controls */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Expense Categories</InputLabel>
            <Select
              multiple
              value={selectedCategories}
              onChange={handleCategoryChange}
              input={<OutlinedInput label="Expense Categories" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip 
                      key={value} 
                      label={value.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} 
                      size="small" 
                    />
                  ))}
                </Box>
              )}
            >
              <MenuItem value="electricity">Electricity</MenuItem>
              <MenuItem value="water">Water</MenuItem>
              <MenuItem value="maintenance">Maintenance</MenuItem>
              <MenuItem value="yard_maintenance">Yard Maintenance</MenuItem>
              <MenuItem value="internet">Internet</MenuItem>
              <MenuItem value="property_tax">Property Tax</MenuItem>
              <MenuItem value="insurance">Insurance</MenuItem>
              <MenuItem value="total">Total Expenses</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={(_e, value) => value && setTimeRange(value)}
            size="small"
            fullWidth
          >
            <ToggleButton value="6m">6 Months</ToggleButton>
            <ToggleButton value="1y">1 Year</ToggleButton>
            <ToggleButton value="2y">2 Years</ToggleButton>
            <ToggleButton value="all">All Time</ToggleButton>
          </ToggleButtonGroup>
        </Grid>

        <Grid item xs={12} md={4}>
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(_e, value) => value && setChartType(value)}
            size="small"
            fullWidth
          >
            <ToggleButton value="line">Line</ToggleButton>
            <ToggleButton value="area">Area</ToggleButton>
            <ToggleButton value="bar">Bar</ToggleButton>
          </ToggleButtonGroup>
        </Grid>
      </Grid>

      {/* Main Chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Monthly Expense Trends
          </Typography>
          {renderMainChart()}
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Net Income Trend */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Net Income Trend
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData.monthly.map(m => ({ ...m, month: format(new Date(m.month + '-01'), 'MMM yy') }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `$${value}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line 
                    type="monotone" 
                    dataKey="netIncome" 
                    stroke={COLORS.netIncome} 
                    strokeWidth={3}
                    dot={{ fill: COLORS.netIncome, r: 4 }}
                    name="Net Income"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rent" 
                    stroke="#81c784" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Rent Income"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Category Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Expense Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={trendData.categoryTotals}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {trendData.categoryTotals.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.key as keyof typeof COLORS] || COLORS.other} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Key Metrics */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Key Insights
              </Typography>
              <Grid container spacing={2}>
                {trendData.monthly.length > 0 && (
                  <>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box textAlign="center">
                        <Typography variant="body2" color="textSecondary">
                          Average Monthly Expenses
                        </Typography>
                        <Typography variant="h5">
                          {formatCurrency(
                            trendData.monthly.length > 0 ? trendData.monthly.reduce((sum, m) => sum + (m.total || 0), 0) / trendData.monthly.length : 0
                          )}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box textAlign="center">
                        <Typography variant="body2" color="textSecondary">
                          Highest Month
                        </Typography>
                        <Typography variant="h5">
                          {formatCurrency(
                            Math.max(...trendData.monthly.map(m => m.total))
                          )}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {trendData.monthly.find(m => m.total === Math.max(...trendData.monthly.map(m => m.total)))?.month}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box textAlign="center">
                        <Typography variant="body2" color="textSecondary">
                          Lowest Month
                        </Typography>
                        <Typography variant="h5">
                          {formatCurrency(
                            Math.min(...trendData.monthly.map(m => m.total))
                          )}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {trendData.monthly.find(m => m.total === Math.min(...trendData.monthly.map(m => m.total)))?.month}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box textAlign="center">
                        <Typography variant="body2" color="textSecondary">
                          Trend
                        </Typography>
                        <Typography variant="h5" color={trendData.monthly.length > 1 && trendData.monthly[trendData.monthly.length - 1].total > trendData.monthly[trendData.monthly.length - 2].total ? 'error.main' : 'success.main'}>
                          {trendData.monthly.length > 1 ? 
                            (trendData.monthly[trendData.monthly.length - 1].total > trendData.monthly[trendData.monthly.length - 2].total ? '↑' : '↓') + ' ' +
                            formatCurrency(Math.abs(trendData.monthly[trendData.monthly.length - 1].total - trendData.monthly[trendData.monthly.length - 2].total))
                            : 'N/A'
                          }
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          vs Previous Month
                        </Typography>
                      </Box>
                    </Grid>
                  </>
                )}
              </Grid>
              
              {/* Additional Insights */}
              <Box mt={3} pt={2} borderTop="1px solid #eee">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" gutterBottom>
                      Largest Expense Categories
                    </Typography>
                    {trendData.categoryTotals.slice(0, 3).map((cat, index) => (
                      <Box key={index} display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" color="textSecondary">
                          {index + 1}. {cat.name}
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(cat.value)}
                        </Typography>
                      </Box>
                    ))}
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" gutterBottom>
                      Monthly Averages
                    </Typography>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2" color="textSecondary">
                        Revenue
                      </Typography>
                      <Typography variant="body2">
                        {formatCurrency(
                          trendData.monthly.length > 0 ? trendData.monthly.reduce((sum, m) => sum + (m.rent || 0), 0) / trendData.monthly.length : 0
                        )}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2" color="textSecondary">
                        Net Income
                      </Typography>
                      <Typography variant="body2">
                        {formatCurrency(
                          trendData.monthly.length > 0 ? trendData.monthly.reduce((sum, m) => sum + (m.netIncome || 0), 0) / trendData.monthly.length : 0
                        )}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" gutterBottom>
                      Year to Date
                    </Typography>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2" color="textSecondary">
                        Total Revenue
                      </Typography>
                      <Typography variant="body2">
                        {formatCurrency(
                          trendData.monthly.reduce((sum, m) => sum + (m.rent || 0), 0)
                        )}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2" color="textSecondary">
                        Total Expenses
                      </Typography>
                      <Typography variant="body2">
                        {formatCurrency(
                          trendData.monthly.reduce((sum, m) => sum + (m.total || 0), 0)
                        )}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
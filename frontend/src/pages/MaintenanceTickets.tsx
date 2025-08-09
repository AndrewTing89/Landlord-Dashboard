import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  Message as MessageIcon,
  Add as AddIcon,
} from '@mui/icons-material';

interface MaintenanceTicket {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tenant_name: string;
  unit: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  notes?: string;
  estimated_cost?: number;
  actual_cost?: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function MaintenanceTickets() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'open',
    priority: 'medium',
    tenant_name: '',
    unit: '',
    notes: '',
    estimated_cost: '',
    actual_cost: '',
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3002/api/maintenance-tickets');
      if (!response.ok) throw new Error('Failed to fetch tickets');
      const data = await response.json();
      setTickets(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (ticket: MaintenanceTicket) => {
    setSelectedTicket(ticket);
    setFormData({
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      tenant_name: ticket.tenant_name,
      unit: ticket.unit,
      notes: ticket.notes || '',
      estimated_cost: ticket.estimated_cost?.toString() || '',
      actual_cost: ticket.actual_cost?.toString() || '',
    });
    setEditDialog(true);
  };

  const handleCreateNew = () => {
    setSelectedTicket(null);
    setFormData({
      title: '',
      description: '',
      status: 'open',
      priority: 'medium',
      tenant_name: '',
      unit: '',
      notes: '',
      estimated_cost: '',
      actual_cost: '',
    });
    setEditDialog(true);
  };

  const handleSave = async () => {
    try {
      const url = selectedTicket
        ? `http://localhost:3002/api/maintenance-tickets/${selectedTicket.id}`
        : 'http://localhost:3002/api/maintenance-tickets';
      
      const method = selectedTicket ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
          actual_cost: formData.actual_cost ? parseFloat(formData.actual_cost) : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save ticket');
      
      await fetchTickets();
      setEditDialog(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'error';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <WarningIcon />;
      case 'in_progress': return <ScheduleIcon />;
      case 'completed': return <CheckCircleIcon />;
      default: return <BuildIcon />;
    }
  };

  const openTickets = tickets.filter(t => t.status === 'open');
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress');
  const completedTickets = tickets.filter(t => t.status === 'completed' || t.status === 'cancelled');

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Maintenance Tickets</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateNew}
        >
          New Ticket
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Open
                  </Typography>
                  <Typography variant="h4" color="error">
                    {openTickets.length}
                  </Typography>
                </Box>
                <WarningIcon color="error" sx={{ fontSize: 40 }} />
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
                    In Progress
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {inProgressTickets.length}
                  </Typography>
                </Box>
                <ScheduleIcon color="warning" sx={{ fontSize: 40 }} />
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
                    Completed
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {completedTickets.length}
                  </Typography>
                </Box>
                <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
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
                    Total Cost
                  </Typography>
                  <Typography variant="h5">
                    {formatCurrency(tickets.reduce((sum, t) => sum + (t.actual_cost || 0), 0))}
                  </Typography>
                </Box>
                <BuildIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for different views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab 
            label={
              <Badge badgeContent={openTickets.length} color="error">
                Open
              </Badge>
            } 
          />
          <Tab 
            label={
              <Badge badgeContent={inProgressTickets.length} color="warning">
                In Progress
              </Badge>
            }
          />
          <Tab label="Completed" />
          <Tab label="All Tickets" />
        </Tabs>
      </Box>

      {/* Open Tickets */}
      <TabPanel value={tabValue} index={0}>
        <TicketTable 
          tickets={openTickets}
          onEdit={handleEditClick}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          getStatusColor={getStatusColor}
          getPriorityColor={getPriorityColor}
        />
      </TabPanel>

      {/* In Progress Tickets */}
      <TabPanel value={tabValue} index={1}>
        <TicketTable 
          tickets={inProgressTickets}
          onEdit={handleEditClick}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          getStatusColor={getStatusColor}
          getPriorityColor={getPriorityColor}
        />
      </TabPanel>

      {/* Completed Tickets */}
      <TabPanel value={tabValue} index={2}>
        <TicketTable 
          tickets={completedTickets}
          onEdit={handleEditClick}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          getStatusColor={getStatusColor}
          getPriorityColor={getPriorityColor}
        />
      </TabPanel>

      {/* All Tickets */}
      <TabPanel value={tabValue} index={3}>
        <TicketTable 
          tickets={tickets}
          onEdit={handleEditClick}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          getStatusColor={getStatusColor}
          getPriorityColor={getPriorityColor}
        />
      </TabPanel>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedTicket ? 'Edit Ticket' : 'Create New Ticket'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="Priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Tenant Name"
                value={formData.tenant_name}
                onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Estimated Cost"
                type="number"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                InputProps={{ startAdornment: '$' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Actual Cost"
                type="number"
                value={formData.actual_cost}
                onChange={(e) => setFormData({ ...formData, actual_cost: e.target.value })}
                InputProps={{ startAdornment: '$' }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {selectedTicket ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Ticket Table Component
interface TicketTableProps {
  tickets: MaintenanceTicket[];
  onEdit: (ticket: MaintenanceTicket) => void;
  formatCurrency: (amount: number | undefined) => string;
  formatDate: (date: string) => string;
  getStatusColor: (status: string) => any;
  getPriorityColor: (priority: string) => any;
}

function TicketTable({ tickets, onEdit, formatCurrency, formatDate, getStatusColor, getPriorityColor }: TicketTableProps) {
  if (tickets.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography color="textSecondary">No tickets found</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Title</TableCell>
            <TableCell>Tenant/Unit</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Created</TableCell>
            <TableCell align="right">Est. Cost</TableCell>
            <TableCell align="right">Actual Cost</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow key={ticket.id}>
              <TableCell>
                <Typography variant="subtitle2">{ticket.title}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {ticket.description.substring(0, 50)}...
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{ticket.tenant_name}</Typography>
                <Typography variant="caption" color="textSecondary">
                  Unit {ticket.unit}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={ticket.priority}
                  size="small"
                  color={getPriorityColor(ticket.priority)}
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={ticket.status.replace('_', ' ')}
                  size="small"
                  color={getStatusColor(ticket.status)}
                />
              </TableCell>
              <TableCell>{formatDate(ticket.created_at)}</TableCell>
              <TableCell align="right">{formatCurrency(ticket.estimated_cost)}</TableCell>
              <TableCell align="right">{formatCurrency(ticket.actual_cost)}</TableCell>
              <TableCell>
                <IconButton size="small" onClick={() => onEdit(ticket)}>
                  <EditIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
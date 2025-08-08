import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon,
  ShowChart as ShowChartIcon,
  RateReview as ReviewIcon,
  AccountBalance as AccountBalanceIcon,
  Email as EmailIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Ledger', icon: <AccountBalanceIcon />, path: '/ledger' },
  { text: 'Transactions', icon: <ReceiptIcon />, path: '/transactions' },
  { text: 'Review', icon: <ReviewIcon />, path: '/review' },
  { text: 'Payment Requests', icon: <PaymentIcon />, path: '/payments' },
  { text: 'Reports', icon: <AssessmentIcon />, path: '/reports' },
  { text: 'Trends', icon: <ShowChartIcon />, path: '/trends' },
  { text: 'Bank Sync', icon: <SyncIcon />, path: '/sync' },
  { text: 'Email Sync', icon: <EmailIcon />, path: '/email-sync' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

export default function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [unmatchedEmailCount, setUnmatchedEmailCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Fetch pending count
    const fetchPendingCount = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/review/pending?limit=1');
        const data = await response.json();
        setPendingCount(data.total);
      } catch (error) {
        console.error('Error fetching pending count:', error);
      }
    };

    // Fetch unmatched email count
    const fetchUnmatchedCount = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/gmail/unmatched');
        const data = await response.json();
        setUnmatchedEmailCount(data.data?.length || 0);
      } catch (error) {
        console.error('Error fetching unmatched email count:', error);
      }
    };

    fetchPendingCount();
    fetchUnmatchedCount();
    
    // Refresh counts every 30 seconds
    const interval = setInterval(() => {
      fetchPendingCount();
      fetchUnmatchedCount();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Landlord Dashboard
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigate(item.path)}
              sx={item.indent ? { pl: 4 } : {}}
            >
              <ListItemIcon>
                {item.text === 'Review' && pendingCount > 0 ? (
                  <Badge badgeContent={pendingCount} color="error">
                    {item.icon}
                  </Badge>
                ) : item.text === 'Payment Tracking' && unmatchedEmailCount > 0 ? (
                  <Badge badgeContent={unmatchedEmailCount} color="warning">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'Landlord Dashboard'}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        <Outlet />
      </Box>
    </>
  );
}
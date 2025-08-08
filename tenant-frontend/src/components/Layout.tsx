import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Container,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Build as BuildIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { tenant, logout } = useAuth();

  const currentPath = location.pathname.split('/')[1] || 'dashboard';

  const handleNavigation = (path: string) => {
    navigate(`/${path}`);
  };

  return (
    <Box sx={{ pb: isMobile ? 7 : 0, minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, color: 'text.primary', fontWeight: 600 }}>
            Tenant Portal
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mr: 2 }}>
            {tenant?.firstName} - Unit {tenant?.unitNumber}
          </Typography>
          <IconButton onClick={logout} size="small">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ mt: 8 }}>
        <Container maxWidth="md" sx={{ py: isMobile ? 2 : 3 }}>
          <Outlet />
        </Container>
      </Box>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Paper
          sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}
          elevation={3}
        >
          <BottomNavigation
            value={currentPath}
            onChange={(_, newValue) => handleNavigation(newValue)}
            showLabels
          >
            <BottomNavigationAction
              label="Dashboard"
              value="dashboard"
              icon={<DashboardIcon />}
            />
            <BottomNavigationAction
              label="Maintenance"
              value="maintenance"
              icon={<BuildIcon />}
            />
          </BottomNavigation>
        </Paper>
      )}

      {/* Desktop Side Navigation */}
      {!isMobile && (
        <Paper
          sx={{
            position: 'fixed',
            left: 0,
            top: 64,
            width: 200,
            height: 'calc(100vh - 64px)',
            borderRight: '1px solid #e0e0e0',
            borderRadius: 0,
          }}
          elevation={0}
        >
          <Box sx={{ p: 2 }}>
            {[
              { label: 'Dashboard', value: 'dashboard', icon: <DashboardIcon /> },
              { label: 'Maintenance', value: 'maintenance', icon: <BuildIcon /> },
            ].map((item) => (
              <Box
                key={item.value}
                onClick={() => handleNavigation(item.value)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 1.5,
                  mb: 1,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: currentPath === item.value ? 'primary.main' : 'transparent',
                  color: currentPath === item.value ? 'white' : 'text.primary',
                  '&:hover': {
                    bgcolor: currentPath === item.value ? 'primary.main' : 'action.hover',
                  },
                }}
              >
                {item.icon}
                <Typography>{item.label}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
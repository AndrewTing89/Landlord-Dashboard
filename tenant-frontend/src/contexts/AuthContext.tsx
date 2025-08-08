import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';

interface Tenant {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  unitNumber: string;
}

interface AuthContextType {
  tenant: Tenant | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load saved auth state on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('tenantAccessToken');
    const savedRefreshToken = localStorage.getItem('tenantRefreshToken');
    const savedTenant = localStorage.getItem('tenantData');

    if (savedToken && savedTenant) {
      setAccessToken(savedToken);
      setTenant(JSON.parse(savedTenant));
      api.setAuthToken(savedToken);
    }

    setLoading(false);
  }, []);

  // Set up token refresh interval after component mounts
  useEffect(() => {
    const savedRefreshToken = localStorage.getItem('tenantRefreshToken');
    if (savedRefreshToken) {
      const interval = setInterval(() => {
        refreshToken();
      }, 10 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/api/tenant/auth/login', { email, password });
      
      if (response.data.success) {
        const { accessToken, refreshToken, tenant } = response.data;
        
        // Save to state
        setAccessToken(accessToken);
        setTenant(tenant);
        
        // Save to localStorage
        localStorage.setItem('tenantAccessToken', accessToken);
        localStorage.setItem('tenantRefreshToken', refreshToken);
        localStorage.setItem('tenantData', JSON.stringify(tenant));
        
        // Set token for API calls
        api.setAuthToken(accessToken);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const logout = () => {
    // Clear state
    setTenant(null);
    setAccessToken(null);
    
    // Clear localStorage
    localStorage.removeItem('tenantAccessToken');
    localStorage.removeItem('tenantRefreshToken');
    localStorage.removeItem('tenantData');
    
    // Clear API token
    api.setAuthToken(null);
    
    // Redirect to login
    window.location.href = '/login';
  };

  const refreshToken = async () => {
    try {
      const savedRefreshToken = localStorage.getItem('tenantRefreshToken');
      if (!savedRefreshToken) {
        throw new Error('No refresh token');
      }

      const response = await api.post('/api/tenant/auth/refresh', {
        refreshToken: savedRefreshToken
      });

      if (response.data.success) {
        const { accessToken } = response.data;
        
        // Update token
        setAccessToken(accessToken);
        localStorage.setItem('tenantAccessToken', accessToken);
        api.setAuthToken(accessToken);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{
      tenant,
      accessToken,
      loading,
      login,
      logout,
      refreshToken
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
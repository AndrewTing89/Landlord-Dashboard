import axios, { AxiosInstance } from 'axios';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    // Use port 3002 for backend
    const baseURL = process.env.NODE_ENV === 'production' 
      ? '/api' 
      : 'http://localhost:3002';

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('tenantAccessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED') {
          // Try to refresh token
          try {
            await this.refreshToken();
            // Retry original request
            return this.client(error.config);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            window.location.href = '/tenant/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token: string | null) {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('tenantRefreshToken');
    if (!refreshToken) throw new Error('No refresh token');

    const response = await this.post('/api/tenant/auth/refresh', { refreshToken });
    if (response.data.success) {
      const { accessToken } = response.data;
      localStorage.setItem('tenantAccessToken', accessToken);
      this.setAuthToken(accessToken);
      return accessToken;
    }
    throw new Error('Token refresh failed');
  }

  // HTTP methods
  get = (url: string, config?: any) => this.client.get(url, config);
  post = (url: string, data?: any, config?: any) => this.client.post(url, data, config);
  put = (url: string, data?: any, config?: any) => this.client.put(url, data, config);
  delete = (url: string, config?: any) => this.client.delete(url, config);
}

export const api = new ApiService();

// Tenant API endpoints
export const tenantApi = {
  // Auth
  login: (email: string, password: string) => 
    api.post('/api/tenant/auth/login', { email, password }),
  
  logout: () => 
    api.post('/api/tenant/auth/logout'),
  
  // Dashboard
  getDashboard: () => 
    api.get('/api/tenant/dashboard'),
  
  // Payments
  getPayments: (params?: { status?: string; year?: number; month?: number }) => 
    api.get('/api/tenant/payments', { params }),
  
  getPendingPayments: () => 
    api.get('/api/tenant/payments/pending'),
  
  getPaymentDetails: (id: number) => 
    api.get(`/api/tenant/payments/${id}`),
  
  acknowledgePayment: (id: number) => 
    api.post(`/api/tenant/payments/${id}/acknowledge`),
  
  getReceipt: (id: number) => 
    api.get(`/api/tenant/payments/${id}/receipt`),
  
  // Maintenance
  getMaintenanceRequests: (params?: { status?: string; priority?: string }) => 
    api.get('/api/tenant/maintenance', { params }),
  
  submitMaintenanceRequest: (data: {
    category: string;
    priority: string;
    title: string;
    description: string;
    photos?: string[];
  }) => api.post('/api/tenant/maintenance', data),
  
  getMaintenanceDetails: (id: number) => 
    api.get(`/api/tenant/maintenance/${id}`),
  
  updateMaintenanceRequest: (id: number, data: { action: string; notes?: string }) => 
    api.put(`/api/tenant/maintenance/${id}`, data),
  
  rateMaintenanceRequest: (id: number, rating: number, comments?: string) => 
    api.post(`/api/tenant/maintenance/${id}/rate`, { rating, comments }),
};
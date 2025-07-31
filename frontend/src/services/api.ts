import axios, { AxiosInstance, AxiosError } from 'axios';
import config from '../config';

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: config.api.baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (ready for auth tokens)
api.interceptors.request.use(
  (config) => {
    // TODO: Add auth token when implementing Cognito
    // const token = localStorage.getItem('authToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Handle unauthorized (redirect to login when auth is added)
      console.error('Unauthorized access');
    }
    return Promise.reject(error);
  }
);

// API service methods
export const apiService = {
  // Plaid
  createLinkToken: () => 
    api.post(config.api.endpoints.createLinkToken),
  
  exchangePublicToken: (publicToken: string) =>
    api.post(config.api.endpoints.exchangePublicToken, { public_token: publicToken }),
  
  // Lambda functions
  syncTransactions: () =>
    api.post(config.api.endpoints.syncTransactions),
  
  processBills: (data?: any) =>
    api.post(config.api.endpoints.processBills, data),
  
  generateReport: (reportType: 'annual' | 'monthly', year: number, month?: number) =>
    api.post(config.api.endpoints.generateReport, { reportType, year, month }),
  
  // Dashboard
  getTransactions: (params?: {
    start_date?: string;
    end_date?: string;
    expense_type?: string;
  }) => api.get(config.api.endpoints.transactions, { params }),
  
  getSummary: (year?: number, month?: number) =>
    api.get(config.api.endpoints.summary, { params: { year, month } }),
  
  getMonthlyComparison: (year?: number) =>
    api.get(config.api.endpoints.monthlyComparison, { params: { year } }),
  
  getPaymentRequests: (params?: {
    month?: number;
    year?: number;
    status?: string;
  }) => api.get('/api/payment/requests', { params }),
  
  // Payment status
  markPaymentPaid: (id: number) =>
    api.post(`/api/payment/requests/${id}/mark-paid`),
  
  sendPaymentSMS: (id: number) =>
    api.post(`/api/payment/requests/${id}/send-notification`),
  
  checkPaymentEmails: () =>
    api.post('/api/check-payment-emails'),
  
  getPaymentConfirmations: () =>
    api.get('/api/payment-confirmations'),
  
  // SimpleFIN sync
  syncWithSimpleFin: () =>
    api.post('/api/simplefin/sync'),
  
  // Transaction management
  updateTransactionCategory: (id: number, expenseType: string) =>
    api.put(`/api/transactions/${id}/category`, { expense_type: expenseType }),
};

export default api;
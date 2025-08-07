// Type definitions for the application

// Re-export API types
export * from './api';

export interface Transaction {
  id: number;
  plaid_transaction_id: string;
  plaid_account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name: string | null;
  category: string | null;
  subcategory: string | null;
  expense_type: ExpenseType | null; // Allow null to prevent runtime errors
  created_at: string;
  updated_at: string;
}

export type ExpenseType = 
  | 'electricity' 
  | 'water' 
  | 'maintenance' 
  | 'landscape'
  | 'property_tax'
  | 'insurance'
  | 'internet'
  | 'rent' 
  | 'utility_reimbursement'
  | 'other';

export interface ExpenseSummary {
  expense_type: ExpenseType | null;
  transaction_count: string | number; // Backend returns string
  gross_amount?: string;
  total_adjustments?: string;
  total_amount: string | number; // Backend returns string
}

export interface PaymentRequest {
  id: number;
  utility_bill_id: number | null;
  roommate_name: string;
  venmo_username: string;
  amount: string | number; // Backend returns string
  request_date: string;
  status: 'pending' | 'sent' | 'paid' | 'foregone';
  venmo_link: string;
  venmo_web_link?: string; // Optional web link for desktop
  bill_type: 'electricity' | 'water' | null;
  month: number | null;
  year: number | null;
  merchant_name?: string | null;
  charge_date?: string | null;
  due_date?: string | null;
  paid_date?: string | null;
  bill_total_amount?: string | number | null;
  total_amount?: string | number | null;
  company_name?: string | null;
  tracking_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UtilityBill {
  id: number;
  transaction_id: number;
  bill_type: 'electricity' | 'water';
  total_amount: number;
  split_amount: number;
  month: number;
  year: number;
  payment_requested: boolean;
  created_at: string;
}

export interface MonthlyReport {
  id: number;
  month: number;
  year: number;
  total_revenue: number;
  total_expenses: number;
  expense_breakdown: Record<ExpenseType, number>;
  report_s3_key: string;
  generated_at: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  expensesByCategory: ExpenseSummary[];
  recentTransactions: Transaction[];
  pendingPayments: PaymentRequest[];
}

export interface ReportRequest {
  reportType: 'annual' | 'monthly';
  year: number;
  month?: number;
}

export interface ReportResponse {
  success: boolean;
  message: string;
  s3Key: string;
  downloadUrl: string;
}
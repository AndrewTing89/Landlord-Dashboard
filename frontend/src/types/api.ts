// Generic API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Sync-related types
export interface SyncHistory {
  id: number;
  sync_type: 'daily' | 'catch_up';
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  transactions_imported: number;
  bills_processed: number;
  payment_requests_created: number;
  pending_review: number;
  errors: string[] | null;
  details: Record<string, any>;
  created_at: string;
}

export interface SyncStats {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  running_syncs: number;
}

export interface SyncStartResponse {
  success: boolean;
  message: string;
  pid?: number;
}

// Enhanced expense type to prevent null issues
export type ExpenseType = 
  | 'electricity' 
  | 'water' 
  | 'maintenance' 
  | 'yard_maintenance'
  | 'property_tax'
  | 'insurance'
  | 'internet'
  | 'rent' 
  | 'utility_reimbursement'
  | 'other'
  | null; // Explicitly allow null

// Review-related types
export interface ReviewTransaction {
  id: string;
  simplefin_id: string;
  posted_date: string;
  description: string;
  amount: number;
  payee: string | null;
  suggested_expense_type: ExpenseType;
  suggested_merchant: string | null;
  confidence_score: number;
  category: string | null;
}

// Monthly comparison types
export interface MonthlyComparison {
  month: string;
  revenue: number;
  expenses: number;
  netIncome: number;
}

// Payment confirmation types
export interface PaymentConfirmation {
  id: number;
  payment_request_id: number;
  confirmation_date: string;
  confirmation_source: string;
  raw_email_data?: string;
  created_at: string;
  roommate_name?: string;
  bill_type?: string;
}
const db = require('../db/connection');

/**
 * Middleware to validate data against database rules
 */
class ValidationMiddleware {
  /**
   * Validate payment request status transitions
   */
  static validateStatusTransition(oldStatus, newStatus) {
    const validTransitions = {
      'pending': ['sent', 'paid', 'foregone'],
      'sent': ['paid', 'foregone'],
      'paid': [], // Cannot transition from paid
      'foregone': [] // Cannot transition from foregone
    };

    if (!validTransitions[oldStatus]) {
      return { valid: false, error: `Invalid current status: ${oldStatus}` };
    }

    if (!validTransitions[oldStatus].includes(newStatus)) {
      return { 
        valid: false, 
        error: `Cannot transition from '${oldStatus}' to '${newStatus}'` 
      };
    }

    return { valid: true };
  }

  /**
   * Validate amount is positive
   */
  static validateAmount(amount, fieldName = 'amount') {
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount)) {
      return { valid: false, error: `${fieldName} must be a number` };
    }

    if (numAmount <= 0) {
      return { valid: false, error: `${fieldName} must be greater than zero` };
    }

    if (numAmount > 1000000) {
      return { valid: false, error: `${fieldName} seems unreasonably high` };
    }

    return { valid: true };
  }

  /**
   * Validate date is reasonable
   */
  static validateDate(date, fieldName = 'date') {
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return { valid: false, error: `${fieldName} is not a valid date` };
    }

    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const yearAhead = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    if (dateObj < yearAgo) {
      return { valid: false, error: `${fieldName} is too far in the past` };
    }

    if (dateObj > yearAhead) {
      return { valid: false, error: `${fieldName} is too far in the future` };
    }

    return { valid: true };
  }

  /**
   * Validate payment request data
   */
  static async validatePaymentRequest(data, isUpdate = false) {
    const errors = [];

    // Validate amount
    if (data.amount !== undefined) {
      const amountValidation = this.validateAmount(data.amount);
      if (!amountValidation.valid) {
        errors.push(amountValidation.error);
      }
    }

    // Validate total amount if provided
    if (data.total_amount !== undefined) {
      const totalValidation = this.validateAmount(data.total_amount, 'total_amount');
      if (!totalValidation.valid) {
        errors.push(totalValidation.error);
      }

      // Total should be >= amount
      if (data.amount && parseFloat(data.total_amount) < parseFloat(data.amount)) {
        errors.push('Total amount cannot be less than split amount');
      }
    }

    // Validate status transitions for updates
    if (isUpdate && data.status) {
      // This would need the old status from database
      // Simplified for now
      const validStatuses = ['pending', 'sent', 'paid', 'foregone'];
      if (!validStatuses.includes(data.status)) {
        errors.push(`Invalid status: ${data.status}`);
      }
    }

    // Validate dates
    if (data.charge_date) {
      const dateValidation = this.validateDate(data.charge_date, 'charge_date');
      if (!dateValidation.valid) {
        errors.push(dateValidation.error);
      }
    }

    // Validate bill type
    if (data.bill_type) {
      const validTypes = ['electricity', 'water', 'internet', 'rent', 'maintenance'];
      if (!validTypes.includes(data.bill_type)) {
        errors.push(`Invalid bill type: ${data.bill_type}`);
      }
    }

    // Check for logical inconsistencies
    if (data.status === 'paid' && !data.paid_date && isUpdate) {
      errors.push('Paid status requires a paid date');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate expense data
   */
  static validateExpense(data) {
    const errors = [];

    // Validate amount
    if (data.amount !== undefined) {
      const amountValidation = this.validateAmount(data.amount);
      if (!amountValidation.valid) {
        errors.push(amountValidation.error);
      }
    }

    // Validate date
    if (data.date) {
      const dateValidation = this.validateDate(data.date);
      if (!dateValidation.valid) {
        errors.push(dateValidation.error);
      }
    }

    // Validate expense type
    if (data.expense_type) {
      const validTypes = [
        'electricity', 'water', 'internet', 'maintenance', 
        'landscape', 'property_tax', 'insurance', 'other'
      ];
      if (!validTypes.includes(data.expense_type)) {
        errors.push(`Invalid expense type: ${data.expense_type}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate income data
   */
  static validateIncome(data) {
    const errors = [];

    // Validate amount
    if (data.amount !== undefined) {
      const amountValidation = this.validateAmount(data.amount);
      if (!amountValidation.valid) {
        errors.push(amountValidation.error);
      }
    }

    // Validate date
    if (data.date) {
      const dateValidation = this.validateDate(data.date);
      if (!dateValidation.valid) {
        errors.push(dateValidation.error);
      }
    }

    // Validate income type
    if (data.income_type) {
      const validTypes = ['rent', 'utility_reimbursement', 'other'];
      if (!validTypes.includes(data.income_type)) {
        errors.push(`Invalid income type: ${data.income_type}`);
      }
    }

    // Check logical consistency
    if (data.income_type === 'utility_reimbursement' && !data.payment_request_id) {
      errors.push('Utility reimbursement should be linked to a payment request');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Express middleware for validation
   */
  static validate(type) {
    return async (req, res, next) => {
      let validation;
      
      switch (type) {
        case 'paymentRequest':
          validation = await this.validatePaymentRequest(req.body, req.method === 'PUT');
          break;
        case 'expense':
          validation = this.validateExpense(req.body);
          break;
        case 'income':
          validation = this.validateIncome(req.body);
          break;
        default:
          return next();
      }

      if (!validation.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: validation.errors
        });
      }

      // Log validation success in audit log
      if (process.env.AUDIT_VALIDATION === 'true') {
        await db.insert('audit_log', {
          table_name: type,
          record_id: 0,
          action: 'VALIDATE',
          new_values: { validated: true, data: req.body },
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        }).catch(console.error);
      }

      next();
    };
  }
}

module.exports = ValidationMiddleware;
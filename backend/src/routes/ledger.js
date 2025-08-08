const express = require('express');
const router = express.Router();
const db = require('../db/connection');

/**
 * Get ledger entries (combined income and expenses)
 */
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, type, search, limit = 100, offset = 0 } = req.query;
    
    // Build parameters array first to know the indices
    const params = [];
    let paramIndex = 0;
    let startDateParam = '';
    let endDateParam = '';
    let searchParam = '';
    
    if (start_date) {
      params.push(start_date);
      paramIndex++;
      startDateParam = `$${paramIndex}`;
    }
    
    if (end_date) {
      params.push(end_date);
      paramIndex++;
      endDateParam = `$${paramIndex}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      paramIndex++;
      searchParam = `$${paramIndex}`;
    }
    
    // Build the query using UNION to combine income and expenses
    let query = `
      WITH ledger_entries AS (
        -- Income entries
        SELECT 
          'income' as entry_type,
          i.id,
          i.date,
          i.amount,
          i.description,
          i.income_type as category,
          i.payer_name as party,
          i.notes,
          i.created_at,
          i.updated_at,
          pr.tracking_id,
          pr.status as payment_status
        FROM income i
        LEFT JOIN payment_requests pr ON i.payment_request_id = pr.id
        WHERE 1=1
        ${start_date ? `AND i.date >= ${startDateParam}` : ""}
        ${end_date ? `AND i.date <= ${endDateParam}` : ""}
        ${type === 'income' ? "" : type === 'expense' ? "AND FALSE" : ""}
        
        UNION ALL
        
        -- Expense entries
        SELECT 
          'expense' as entry_type,
          e.id,
          e.date,
          e.amount,
          e.name as description,
          e.expense_type as category,
          e.merchant_name as party,
          CONCAT_WS(' - ', e.category, e.subcategory) as notes,
          e.created_at,
          e.updated_at,
          NULL as tracking_id,
          NULL as payment_status
        FROM expenses e
        WHERE e.expense_type != 'other'
        ${start_date ? `AND e.date >= ${startDateParam}` : ""}
        ${end_date ? `AND e.date <= ${endDateParam}` : ""}
        ${type === 'expense' ? "" : type === 'income' ? "AND FALSE" : ""}
      )
      SELECT 
        *,
        SUM(CASE WHEN entry_type = 'income' THEN amount ELSE -amount END) 
          OVER (ORDER BY date ASC, created_at ASC) as running_balance
      FROM ledger_entries
      WHERE 1=1
      ${search ? `AND (LOWER(description) LIKE LOWER(${searchParam}) OR LOWER(party) LIKE LOWER(${searchParam}))` : ""}
      ORDER BY date DESC, created_at DESC
      LIMIT ${parseInt(limit)}
      OFFSET ${parseInt(offset)}
    `;
    
    const result = await db.query(query, params);
    
    // Get totals for the period - use only date params
    const totalsParams = [];
    if (start_date) totalsParams.push(start_date);
    if (end_date) totalsParams.push(end_date);
    
    const totalsQuery = `
      WITH period_totals AS (
        SELECT 
          COALESCE(SUM(amount), 0) as total_income
        FROM income
        WHERE 1=1
        ${start_date ? `AND date >= ${startDateParam}` : ""}
        ${end_date ? `AND date <= ${endDateParam}` : ""}
      ),
      expense_totals AS (
        SELECT 
          COALESCE(SUM(amount), 0) as total_expenses
        FROM expenses
        WHERE expense_type != 'other'
        ${start_date ? `AND date >= ${startDateParam}` : ""}
        ${end_date ? `AND date <= ${endDateParam}` : ""}
      )
      SELECT 
        pi.total_income,
        et.total_expenses,
        pi.total_income - et.total_expenses as net_income
      FROM period_totals pi, expense_totals et
    `;
    
    const totals = await db.query(totalsQuery, totalsParams);
    
    res.json({
      entries: result.rows,
      totals: totals.rows[0],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('Ledger API error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get ledger summary by category
 */
router.get('/summary', async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'month' } = req.query;
    
    let dateFormat;
    if (group_by === 'day') {
      dateFormat = 'YYYY-MM-DD';
    } else if (group_by === 'month') {
      dateFormat = 'YYYY-MM';
    } else if (group_by === 'year') {
      dateFormat = 'YYYY';
    } else {
      dateFormat = 'YYYY-MM';
    }
    
    const query = `
      WITH income_summary AS (
        SELECT 
          TO_CHAR(date, '${dateFormat}') as period,
          income_type as category,
          SUM(amount) as amount
        FROM income
        WHERE 1=1
        ${start_date ? "AND date >= $1" : ""}
        ${end_date ? "AND date <= $2" : ""}
        GROUP BY TO_CHAR(date, '${dateFormat}'), income_type
      ),
      expense_summary AS (
        SELECT 
          TO_CHAR(date, '${dateFormat}') as period,
          expense_type as category,
          SUM(amount) as amount
        FROM expenses
        WHERE expense_type != 'other'
        ${start_date ? "AND date >= $1" : ""}
        ${end_date ? "AND date <= $2" : ""}
        GROUP BY TO_CHAR(date, '${dateFormat}'), expense_type
      )
      SELECT 
        period,
        'income' as type,
        category,
        amount
      FROM income_summary
      
      UNION ALL
      
      SELECT 
        period,
        'expense' as type,
        category,
        amount
      FROM expense_summary
      
      ORDER BY period DESC, type, category
    `;
    
    const params = [];
    if (start_date) params.push(start_date);
    if (end_date) params.push(end_date);
    
    const result = await db.query(query, params);
    
    // Transform data into a more usable format
    const summaryByPeriod = {};
    result.rows.forEach(row => {
      if (!summaryByPeriod[row.period]) {
        summaryByPeriod[row.period] = {
          period: row.period,
          income: {},
          expenses: {},
          totalIncome: 0,
          totalExpenses: 0,
          netIncome: 0
        };
      }
      
      if (row.type === 'income') {
        summaryByPeriod[row.period].income[row.category] = parseFloat(row.amount);
        summaryByPeriod[row.period].totalIncome += parseFloat(row.amount);
      } else {
        summaryByPeriod[row.period].expenses[row.category] = parseFloat(row.amount);
        summaryByPeriod[row.period].totalExpenses += parseFloat(row.amount);
      }
      
      summaryByPeriod[row.period].netIncome = 
        summaryByPeriod[row.period].totalIncome - summaryByPeriod[row.period].totalExpenses;
    });
    
    res.json({
      summary: Object.values(summaryByPeriod),
      groupBy: group_by
    });
  } catch (error) {
    console.error('Ledger summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
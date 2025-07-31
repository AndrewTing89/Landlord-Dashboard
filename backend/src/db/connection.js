const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper functions for common queries
const db = {
  // Execute a query
  query: async (text, params) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },

  // Get a single row
  getOne: async (text, params) => {
    const res = await db.query(text, params);
    return res.rows[0];
  },

  // Get multiple rows
  getMany: async (text, params) => {
    const res = await db.query(text, params);
    return res.rows;
  },

  // Insert and return the inserted row
  insert: async (table, data) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const text = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const res = await db.query(text, values);
    return res.rows[0];
  },

  // Update and return the updated row
  update: async (table, id, data, includeUpdatedAt = true) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    
    // Only add updated_at if requested (default true for backward compatibility)
    const updatedAtClause = includeUpdatedAt ? ', updated_at = CURRENT_TIMESTAMP' : '';
    
    const text = `
      UPDATE ${table}
      SET ${setClause}${updatedAtClause}
      WHERE id = $1
      RETURNING *
    `;
    
    const res = await db.query(text, [id, ...values]);
    return res.rows[0];
  },

  // Transaction helper
  transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Close the pool
  close: async () => {
    await pool.end();
  }
};

module.exports = db;
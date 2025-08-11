const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Get all estimated taxes
router.get('/', async (req, res) => {
  try {
    const taxes = await db.query(`
      SELECT id, tax_year, estimated_amount, description, notes, created_at, updated_at
      FROM estimated_taxes 
      ORDER BY tax_year DESC
    `);
    
    res.json(taxes.rows);
  } catch (error) {
    console.error('Error fetching estimated taxes:', error);
    res.status(500).json({ error: 'Failed to fetch estimated taxes' });
  }
});

// Get estimated tax for a specific year
router.get('/:year', async (req, res) => {
  try {
    const { year } = req.params;
    const tax = await db.getOne(`
      SELECT id, tax_year, estimated_amount, description, notes, created_at, updated_at
      FROM estimated_taxes 
      WHERE tax_year = $1
    `, [year]);
    
    if (!tax) {
      return res.status(404).json({ error: 'Estimated tax not found for this year' });
    }
    
    res.json(tax);
  } catch (error) {
    console.error('Error fetching estimated tax:', error);
    res.status(500).json({ error: 'Failed to fetch estimated tax' });
  }
});

// Create or update estimated tax for a year
router.post('/', async (req, res) => {
  try {
    const { tax_year, estimated_amount, description, notes } = req.body;
    
    if (!tax_year || !estimated_amount) {
      return res.status(400).json({ error: 'Tax year and estimated amount are required' });
    }
    
    // Check if entry already exists
    const existing = await db.getOne(`
      SELECT id FROM estimated_taxes WHERE tax_year = $1
    `, [tax_year]);
    
    if (existing) {
      // Update existing entry
      await db.query(`
        UPDATE estimated_taxes 
        SET estimated_amount = $2,
            description = $3,
            notes = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE tax_year = $1
      `, [tax_year, estimated_amount, description, notes]);
      
      const updated = await db.getOne(`
        SELECT * FROM estimated_taxes WHERE tax_year = $1
      `, [tax_year]);
      
      res.json({ message: 'Estimated tax updated successfully', data: updated });
    } else {
      // Create new entry
      const newTax = await db.query(`
        INSERT INTO estimated_taxes (tax_year, estimated_amount, description, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [tax_year, estimated_amount, description, notes]);
      
      res.status(201).json({ message: 'Estimated tax created successfully', data: newTax.rows[0] });
    }
  } catch (error) {
    console.error('Error creating/updating estimated tax:', error);
    res.status(500).json({ error: 'Failed to save estimated tax' });
  }
});

// Delete estimated tax for a year
router.delete('/:year', async (req, res) => {
  try {
    const { year } = req.params;
    
    const result = await db.query(`
      DELETE FROM estimated_taxes WHERE tax_year = $1
    `, [year]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Estimated tax not found for this year' });
    }
    
    res.json({ message: 'Estimated tax deleted successfully' });
  } catch (error) {
    console.error('Error deleting estimated tax:', error);
    res.status(500).json({ error: 'Failed to delete estimated tax' });
  }
});

module.exports = router;
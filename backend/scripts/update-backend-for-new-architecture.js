#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to update and their replacements
const updates = [
  {
    file: 'src/server.js',
    replacements: [
      // Update transactions queries to expenses
      { from: /FROM transactions(?!\s+AS)/g, to: 'FROM expenses' },
      { from: /UPDATE transactions/g, to: 'UPDATE expenses' },
      { from: /INSERT INTO transactions/g, to: 'INSERT INTO expenses' },
      { from: /DELETE FROM transactions/g, to: 'DELETE FROM expenses' },
      // Update joins
      { from: /LEFT JOIN utility_adjustments adj ON adj\.transaction_id/g, to: 'LEFT JOIN utility_adjustments adj ON adj.expense_id' },
      // Keep expense_type as is (not renaming to category)
    ]
  },
  {
    file: 'src/services/venmoMatchingService.js',
    replacements: [
      { from: /FROM transactions/g, to: 'FROM expenses' },
      { from: /INSERT INTO transactions/g, to: 'INSERT INTO income' },
      // This service now creates income records, not expense records
    ]
  },
  {
    file: 'src/scripts/daily/full-sync.js',
    replacements: [
      { from: /FROM transactions/g, to: 'FROM expenses' },
      { from: /INSERT INTO transactions/g, to: 'INSERT INTO expenses' },
      { from: /UPDATE transactions/g, to: 'UPDATE expenses' },
    ]
  },
  {
    file: 'src/routes/review.js',
    replacements: [
      { from: /FROM transactions/g, to: 'FROM expenses' },
      { from: /UPDATE transactions/g, to: 'UPDATE expenses' },
      { from: /INSERT INTO transactions/g, to: 'INSERT INTO expenses' },
    ]
  },
  {
    file: 'src/services/transactionClassifier.js',
    replacements: [
      { from: /INSERT INTO transactions/g, to: 'INSERT INTO expenses' },
    ]
  },
];

console.log('🔧 Updating backend files for new architecture...\n');

updates.forEach(({ file, replacements }) => {
  const filePath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changeCount = 0;
  
  replacements.forEach(({ from, to }) => {
    const matches = content.match(from);
    if (matches) {
      changeCount += matches.length;
      content = content.replace(from, to);
    }
  });
  
  if (changeCount > 0) {
    // Backup original
    const backupPath = filePath + '.pre-migration';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'));
    }
    
    // Write updated content
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated ${file} (${changeCount} changes)`);
  } else {
    console.log(`⏭️  No changes needed in ${file}`);
  }
});

console.log('\n📝 Note: Review the changes and test thoroughly!');
console.log('   Backup files created with .pre-migration extension');
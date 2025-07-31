const db = require('../src/db/connection');

async function addLandscapeCategory() {
  try {
    // Check if landscape category exists
    const existing = await db.query("SELECT * FROM expense_categories WHERE category_name = 'landscape'");
    
    if (existing.rows.length === 0) {
      // Add landscape category
      await db.query(
        "INSERT INTO expense_categories (category_name, keywords) VALUES ($1, $2)",
        ['landscape', JSON.stringify(['GARDENER', 'LANDSCAPE', 'LANDSCAPING', 'LAWN', 'YARD', 'CARLOS'])]
      );
      console.log('✓ Added landscape expense category');
    } else {
      console.log('Landscape category already exists');
    }
    
    // Show all categories
    const all = await db.query('SELECT category_name, keywords FROM expense_categories ORDER BY category_name');
    console.log('\nAll expense categories:');
    all.rows.forEach(cat => {
      console.log(`- ${cat.category_name}: ${JSON.stringify(cat.keywords)}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addLandscapeCategory();
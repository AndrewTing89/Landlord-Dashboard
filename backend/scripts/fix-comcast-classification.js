const db = require('../src/db/connection');

async function fixComcastClassification() {
  try {
    // Check expense categories
    const categories = await db.query("SELECT * FROM expense_categories ORDER BY category_name");
    
    console.log("Current Expense Categories:");
    categories.rows.forEach(cat => {
      console.log(`- ${cat.category_name}: ${JSON.stringify(cat.keywords || [])}`);
    });
    
    // Add COMCAST to internet keywords
    console.log("\nUpdating internet category to include COMCAST...");
    
    const internetCat = categories.rows.find(c => c.category_name === 'internet');
    if (internetCat) {
      const currentKeywords = internetCat.keywords || [];
      
      if (!currentKeywords.includes('COMCAST')) {
        currentKeywords.push('COMCAST');
        
        await db.query(
          "UPDATE expense_categories SET keywords = $1 WHERE category_name = $2",
          [JSON.stringify(currentKeywords), 'internet']
        );
        
        console.log("✓ Added COMCAST to internet keywords");
      } else {
        console.log("COMCAST already in internet keywords");
      }
    } else {
      // Create internet category if it doesn't exist
      console.log("Creating internet category...");
      await db.query(
        "INSERT INTO expense_categories (category_name, keywords) VALUES ($1, $2)",
        ['internet', JSON.stringify(['COMCAST', 'XFINITY', 'INTERNET', 'ISP', 'BROADBAND'])]
      );
      console.log("✓ Created internet category with COMCAST keyword");
    }
    
    // Verify the update
    const updated = await db.query("SELECT * FROM expense_categories WHERE category_name = 'internet'");
    console.log("\nUpdated internet category:");
    console.log(updated.rows[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixComcastClassification();
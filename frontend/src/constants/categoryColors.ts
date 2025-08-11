// Shared color constants for expense and income categories
// Used across all components to ensure consistency

export const CATEGORY_COLORS: Record<string, string> = {
  // Utility expenses
  electricity: '#D4A017', // Gold/Yellow (unchanged)
  water: '#64B5F6', // Light Blue
  internet: '#1565C0', // Dark Blue
  
  // Property expenses  
  supplies: '#FF5722', // Deep Orange (renamed from maintenance)
  maintenance: '#FF5722', // Deep Orange (keeping for backward compatibility)
  cleaning_maintenance: '#2E7D32', // Dark Forest Green (renamed from landscape)
  landscape: '#2E7D32', // Dark Forest Green (keeping for backward compatibility)
  property_tax: '#D32F2F', // Dark Red
  insurance: '#FF6F00', // Amber-Orange
  
  // Income
  rent: '#4CAF50', // Green
  utility_reimbursement: '#81C784', // Light Green (income)
  
  // Other
  other: '#8884D8', // Light Purple
};

export const getCategoryChip = (type: string | null) => {
  // Map old category names to new labels
  const labelMapping: Record<string, string> = {
    'maintenance': 'Supplies',
    'landscape': 'Maintenance/Cleaning',
    'cleaning_maintenance': 'Maintenance/Cleaning',
    'supplies': 'Supplies'
  };
  
  const label = type ? (
    labelMapping[type] || 
    type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  ) : 'Unknown';

  return {
    label,
    backgroundColor: CATEGORY_COLORS[type || ''] || '#757575',
    color: 'white'
  };
};
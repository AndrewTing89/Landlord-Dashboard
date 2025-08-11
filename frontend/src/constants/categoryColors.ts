// Shared color constants for expense and income categories
// Used across all components to ensure consistency

export const CATEGORY_COLORS: Record<string, string> = {
  // Utility expenses
  electricity: '#D4A017', // Gold/Yellow
  water: '#9C27B0', // Purple
  internet: '#2196F3', // Blue
  
  // Property expenses  
  maintenance: '#FF5722', // Deep Orange
  landscape: '#E91E63', // Pink-Red
  property_tax: '#D32F2F', // Dark Red
  insurance: '#FF6F00', // Amber-Orange
  
  // Income
  rent: '#4CAF50', // Green
  utility_reimbursement: '#4CAF50', // Green (income)
  
  // Other
  other: '#8884D8', // Light Purple
};

export const getCategoryChip = (type: string | null) => {
  const label = type ? type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ') : 'Unknown';

  return {
    label,
    backgroundColor: CATEGORY_COLORS[type || ''] || '#757575',
    color: 'white'
  };
};
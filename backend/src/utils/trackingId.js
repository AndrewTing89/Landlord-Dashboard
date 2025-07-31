/**
 * Generate a unique tracking ID for payment requests
 * Format: YYYY-Month-UtilityType (e.g., 2025-July-Electricity)
 */
function generateTrackingId(month, year, utilityType) {
  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Get month name
  const monthName = monthNames[month - 1];
  
  // Capitalize utility type
  const utilityName = utilityType.charAt(0).toUpperCase() + utilityType.slice(1);
  
  return `${year}-${monthName}-${utilityName}`;
}

/**
 * Extract tracking ID from text (email body or Venmo note)
 */
function extractTrackingId(text) {
  if (!text) return null;
  
  // Match pattern: YYYY-Month-UtilityType
  const match = text.match(/\d{4}-(January|February|March|April|May|June|July|August|September|October|November|December)-(Electricity|Water)/i);
  return match ? match[0] : null;
}

/**
 * Parse tracking ID to get month, year, and utility type
 */
function parseTrackingId(trackingId) {
  if (!trackingId) return null;
  
  const match = trackingId.match(/(\d{4})-(January|February|March|April|May|June|July|August|September|October|November|December)-(Electricity|Water)/i);
  if (!match) return null;
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return {
    year: parseInt(match[1]),
    month: monthNames.indexOf(match[2]) + 1,
    monthName: match[2],
    utilityType: match[3].toLowerCase(),
    fullId: trackingId
  };
}

module.exports = {
  generateTrackingId,
  extractTrackingId,
  parseTrackingId
};
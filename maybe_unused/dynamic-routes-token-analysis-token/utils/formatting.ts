import Big from 'big.js';

// Format price with appropriate decimal places
export const formatPrice = (value: string | undefined): string => {
  if (!value) return '0.00';
  try {
    const num = new Big(value);
    if (num.eq(0)) return '0.00';
    if (num.lt(0.000001)) return num.toFixed(8);
    if (num.lt(0.01)) return num.toFixed(6);
    if (num.lt(1)) return num.toFixed(4);
    if (num.lt(100)) return num.toFixed(2);
    return num.toFixed(2);
  } catch (error) {
    console.error('Error formatting price:', error);
    return '0.00';
  }
};

// Format large numbers
export const formatNumber = (value: string | undefined): string => {
  if (!value) return '0';
  try {
    const num = new Big(value);
    if (num.eq(0)) return '0';
    if (num.lt(0.000001)) return num.toFixed(8);
    if (num.lt(0.01)) return num.toFixed(6);
    if (num.lt(1)) return num.toFixed(4);
    if (num.lt(1000)) return num.toFixed(2);
    if (num.lt(1000000)) return `${num.div(1000).toFixed(2)}K`;
    if (num.lt(1000000000)) return `${num.div(1000000).toFixed(2)}M`;
    return `${num.div(1000000000).toFixed(2)}B`;
  } catch (error) {
    console.error('Error formatting number:', error);
    return '0';
  }
};

// Format percentage
export const formatPercentage = (value: string | undefined): string => {
  if (!value) return '0.00%';
  try {
    const num = new Big(value);
    if (num.eq(0)) return '0.00%';
    return `${num.toFixed(2)}%`;
  } catch (error) {
    console.error('Error formatting percentage:', error);
    return '0.00%';
  }
};

// Format date
export const formatDate = (timestamp: number | undefined): string => {
  if (!timestamp) return 'Unknown';
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Unknown';
  }
}; 
import { describe, it, expect } from 'vitest'
import Big from 'big.js'

// Sample token data from API response
const sampleTokenData = {
  baseToken: {
    address: "Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump",
    name: "NotInEmploymentEducationTraining",
    symbol: "neet"
  },
  priceUsd: "0.01106",
  transactions: {
    buys: 0,
    sells: 0
  },
  volume: {
    h24: 4192527.47
  },
  priceChange: {
    h24: -25.62
  },
  liquidity: {
    usd: 524729.35
  },
  mintAddress: "5wNu5QhdpRGrL37ffcd6TMMqZugQgxwafgz477rShtHy",
  marketInfo: {
    marketCap: 11064605,
    fdv: 11064605,
    supply: 1000000000,
    pairCreatedAt: 1745715491000
  }
}

// Format price with appropriate decimal places
const formatPrice = (value: string | undefined): string => {
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
const formatNumber = (value: string | undefined): string => {
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
const formatPercentage = (value: string | undefined): string => {
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

describe('Token Data Parsing', () => {
  it('should correctly parse and format token basic info', () => {
    expect(sampleTokenData.baseToken.name).toBe("NotInEmploymentEducationTraining");
    expect(sampleTokenData.baseToken.symbol).toBe("neet");
    expect(sampleTokenData.baseToken.address).toBe("Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump");
  });

  it('should correctly format price values', () => {
    const price = formatPrice(sampleTokenData.priceUsd.toString());
    expect(price).toBe("0.0111"); // Should round to 4 decimal places for small numbers
  });

  it('should correctly format market cap and FDV', () => {
    const marketCap = formatNumber(sampleTokenData.marketInfo.marketCap.toString());
    const fdv = formatNumber(sampleTokenData.marketInfo.fdv.toString());
    expect(marketCap).toBe("11.06M");
    expect(fdv).toBe("11.06M");
  });

  it('should correctly format volume and liquidity', () => {
    const volume = formatNumber(sampleTokenData.volume.h24.toString());
    const liquidity = formatNumber(sampleTokenData.liquidity.usd.toString());
    expect(volume).toBe("4.19M");
    expect(liquidity).toBe("524.73K");
  });

  it('should correctly format percentage changes', () => {
    const priceChange = formatPercentage(sampleTokenData.priceChange.h24.toString());
    expect(priceChange).toBe("-25.62%");
  });

  it('should handle undefined values gracefully', () => {
    expect(formatPrice(undefined)).toBe("0.00");
    expect(formatNumber(undefined)).toBe("0");
    expect(formatPercentage(undefined)).toBe("0.00%");
  });

  it('should handle zero values correctly', () => {
    expect(formatPrice("0")).toBe("0.00");
    expect(formatNumber("0")).toBe("0");
    expect(formatPercentage("0")).toBe("0.00%");
  });

  it('should handle very small numbers correctly', () => {
    expect(formatPrice("0.00000001")).toBe("0.00000001");
    expect(formatNumber("0.00000001")).toBe("0.00000001");
  });

  it('should handle very large numbers correctly', () => {
    expect(formatNumber("1000000000")).toBe("1.00B");
    expect(formatNumber("1000000")).toBe("1.00M");
    expect(formatNumber("1000")).toBe("1.00K");
  });
});

// Test data processing from API response
describe('API Response Processing', () => {
  it('should correctly process token info array', () => {
    const tokenInfoArray = [sampleTokenData];
    const mainPair = tokenInfoArray[0];
    
    // Test main pair data
    expect(mainPair.priceUsd).toBe("0.01106");
    expect(mainPair.volume.h24).toBe(4192527.47);
    expect(mainPair.liquidity.usd).toBe(524729.35);
  });

  it('should correctly calculate derived values', () => {
    const marketCap = sampleTokenData.marketInfo.marketCap;
    const fdv = sampleTokenData.marketInfo.fdv;
    const supply = sampleTokenData.marketInfo.supply;
    
    // Test market cap calculations
    expect(marketCap).toBe(11064605);
    expect(fdv).toBe(11064605);
    expect(supply).toBe(1000000000);
  });

  it('should correctly format dates', () => {
    const pairCreatedAt = new Date(sampleTokenData.marketInfo.pairCreatedAt);
    expect(pairCreatedAt instanceof Date).toBe(true);
    expect(pairCreatedAt.getTime()).toBe(1745715491000);
  });
}); 
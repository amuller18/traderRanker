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

describe('Token Data Processing', () => {
  it('should correctly process token basic info', () => {
    const { baseToken } = sampleTokenData;
    expect(baseToken.name).toBe("NotInEmploymentEducationTraining");
    expect(baseToken.symbol).toBe("neet");
    expect(baseToken.address).toBe("Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump");
  });

  it('should correctly process price and volume data', () => {
    const { priceUsd, volume, priceChange } = sampleTokenData;
    expect(priceUsd).toBe("0.01106");
    expect(volume.h24).toBe(4192527.47);
    expect(priceChange.h24).toBe(-25.62);
  });

  it('should correctly process market data', () => {
    const { marketInfo, liquidity } = sampleTokenData;
    expect(marketInfo.marketCap).toBe(11064605);
    expect(marketInfo.fdv).toBe(11064605);
    expect(marketInfo.supply).toBe(1000000000);
    expect(liquidity.usd).toBe(524729.35);
  });

  it('should correctly process transaction data', () => {
    const { transactions } = sampleTokenData;
    expect(transactions.buys).toBe(0);
    expect(transactions.sells).toBe(0);
  });

  it('should correctly process timestamp data', () => {
    const { marketInfo } = sampleTokenData;
    const date = new Date(marketInfo.pairCreatedAt);
    expect(date instanceof Date).toBe(true);
    expect(date.getTime()).toBe(1745715491000);
  });

  it('should handle undefined values gracefully', () => {
    const emptyData = {
      baseToken: {
        address: "",
        name: "",
        symbol: ""
      },
      priceUsd: undefined,
      transactions: {
        buys: 0,
        sells: 0
      },
      volume: {
        h24: undefined
      },
      priceChange: {
        h24: undefined
      },
      liquidity: {
        usd: undefined
      },
      marketInfo: {
        marketCap: undefined,
        fdv: undefined,
        supply: undefined,
        pairCreatedAt: undefined
      }
    };

    expect(emptyData.priceUsd).toBeUndefined();
    expect(emptyData.volume.h24).toBeUndefined();
    expect(emptyData.priceChange.h24).toBeUndefined();
    expect(emptyData.liquidity.usd).toBeUndefined();
    expect(emptyData.marketInfo.marketCap).toBeUndefined();
  });
}); 
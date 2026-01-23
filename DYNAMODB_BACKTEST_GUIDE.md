# DynamoDB-Only Backtesting Guide

## Overview

The new `/api/simulate/dynamodb` endpoint provides backtesting functionality using **ONLY DynamoDB data** with **zero external API calls**. This is faster, more reliable, and doesn't depend on external services like Birdeye.

## Prerequisites

### 1. DynamoDB Table Setup

You need a DynamoDB table with the following structure:

**Table Name:** `officialPriceData` (configurable via `DYNAMODB_PRICE_DATA_TABLE` env var)

**Schema:**
- **Partition Key:** `ca` (String) - Contract address
- **Sort Key:** `timestamp` (Number) - Unix timestamp in seconds

**Required Attributes:**
- `ca` - Contract address (e.g., "6FtbGaqgZzti1TxJksBV4PSya5of9VqA9vJNDxPwbonk")
- `timestamp` - Unix timestamp (e.g., 1751615690)
- `price` - Token price in USD (e.g., 0.0028921665900405)
- `volume` - Trading volume (optional)
- `interval` - Time interval (optional, e.g., "5m")

### 2. Environment Variables

Add to your `.env` file:

```bash
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# DynamoDB Tables
DYNAMODB_PRICE_DATA_TABLE=officialPriceData
DYNAMODB_TRADES_TABLE=officialCalls
DYNAMODB_TRADER_STATISTICS=officialStats
```

### 3. Data Population

Use the provided Google Colab script or similar to populate price data:

```python
import boto3
from boto3.dynamodb.conditions import Key

# Initialize DynamoDB
dynamodb = boto3.resource(
    'dynamodb',
    region_name=AWS_REGION_NAME,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY
)

price_table = dynamodb.Table('officialPriceData')

# Insert price data
price_table.put_item(Item={
    'ca': '6FtbGaqgZzti1TxJksBV4PSya5of9VqA9vJNDxPwbonk',
    'timestamp': 1751615690,
    'price': 0.0028921665900405,
    'volume': 0,
    'interval': '5m'
})
```

## API Endpoint

### POST `/api/simulate/dynamodb`

Runs backtesting simulation using only DynamoDB data.

#### Request Body

```json
{
  "tokens": [
    "6FtbGaqgZzti1TxJksBV4PSya5of9VqA9vJNDxPwbonk"
  ],
  "amount_usd": 100,
  "tp": ["0.10:0.5", "0.20:0.5"],
  "sl": ["0.10:0.3", "0.20:0.7"]
}
```

**Parameters:**
- `tokens` - Array of Solana contract addresses (CAs)
- `amount_usd` - Investment amount in USD
- `tp` - Take profit ladder: `["ratio:sell_fraction", ...]`
  - `ratio`: Profit percentage (e.g., `0.10` = 10% gain)
  - `sell_fraction`: Fraction of position to sell (e.g., `0.5` = 50%)
- `sl` - Stop loss ladder: same format as TP

#### Response

```json
[
  {
    "token": "6FtbGaqgZzti1TxJksBV4PSya5of9VqA9vJNDxPwbonk",
    "ledger": [
      {
        "ts": 1751615690,
        "value": 100.0,
        "coins_held": 34.56,
        "unrealized": 0.0,
        "realized": 0.0
      },
      ...
    ],
    "realized_profit": 5.23,
    "unrealized_profit": 1.50,
    "coins_left": 17.28,
    "tps_hit": [1.10],
    "sls_hit": [],
    "error": null
  }
]
```

## Example Usage

### cURL

```bash
curl -X POST http://localhost:8000/api/simulate/dynamodb \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": ["6FtbGaqgZzti1TxJksBV4PSya5of9VqA9vJNDxPwbonk"],
    "amount_usd": 100,
    "tp": ["0.10:0.5", "0.25:0.5"],
    "sl": ["0.10:1.0"]
  }'
```

### Python

```python
import requests

response = requests.post(
    "http://localhost:8000/api/simulate/dynamodb",
    json={
        "tokens": ["6FtbGaqgZzti1TxJksBV4PSya5of9VqA9vJNDxPwbonk"],
        "amount_usd": 100,
        "tp": ["0.10:0.5", "0.20:0.5"],
        "sl": ["0.10:0.3"]
    }
)

results = response.json()
for result in results:
    if result["error"]:
        print(f"Error: {result['error']}")
    else:
        print(f"Realized: ${result['realized_profit']:.2f}")
        print(f"Unrealized: ${result['unrealized_profit']:.2f}")
        print(f"Total: ${result['realized_profit'] + result['unrealized_profit']:.2f}")
```

### JavaScript/Fetch

```javascript
const response = await fetch('http://localhost:8000/api/simulate/dynamodb', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tokens: ['6FtbGaqgZzti1TxJksBV4PSya5of9VqA9vJNDxPwbonk'],
    amount_usd: 100,
    tp: ['0.10:0.5', '0.20:0.5'],
    sl: ['0.10:0.3']
  })
});

const results = await response.json();
console.log(results);
```

## Advantages over Birdeye API

1. **No External Dependencies** - Works without Birdeye API keys
2. **Faster** - No network latency from external API calls
3. **More Reliable** - No rate limits or API downtime
4. **Cost Effective** - No API usage fees
5. **Historical Data** - Use your own curated historical price data
6. **Offline Capable** - Works without internet (if DynamoDB is local)

## Data Flow

```
1. Client Request
   ↓
2. Fetch Price History from DynamoDB
   - Query by CA (partition key)
   - Sorted by timestamp (sort key)
   ↓
3. Convert to OHLC Format
   - Each price point → OHLC candle
   ↓
4. Get Current Price
   - Most recent timestamp entry
   ↓
5. Run Numba-Optimized Backtest
   - Check TP/SL using high/low prices
   - Track position ledger
   ↓
6. Return Results
   - Full position history
   - Realized/unrealized P/L
   - TP/SL triggers
```

## Troubleshooting

### "No price data available in DynamoDB"

- Check that the CA exists in your `officialPriceData` table
- Verify the partition key is `ca` and sort key is `timestamp`
- Ensure price data was populated correctly

### "Price data table not available"

- Check AWS credentials in `.env`
- Verify table name matches `DYNAMODB_PRICE_DATA_TABLE`
- Ensure IAM permissions allow DynamoDB access

### "Not enough data points"

- Minimum 10 price points required for backtesting
- Add more historical data to the table

### Authentication Errors

- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
- Check IAM user has `dynamodb:Query` and `dynamodb:Scan` permissions
- Confirm `AWS_REGION` matches your table's region

## Performance Optimizations

The endpoint uses **Numba JIT compilation** for 10-100x faster backtesting:

1. **NumPy arrays** - All OHLC data converted to NumPy for vectorized operations
2. **@njit decorator** - Just-in-time compilation for hot loops
3. **No pandas iteration** - Direct array indexing instead of `iterrows()`
4. **Efficient TP/SL checks** - Uses high/low prices correctly

For large datasets (1000+ candles), expect:
- **With Numba**: ~1-10ms per token
- **Without Numba**: ~100-1000ms per token

## See Also

- Original endpoint: `/api/simulate` (uses Birdeye API)
- Breakdown endpoint: `/api/simulate/breakdown`
- Trades endpoint: `/api/simulate/trades`

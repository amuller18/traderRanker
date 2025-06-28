const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// Test tokens - some that might not be in CoinGecko but should be in DexScreener
const testTokens = [
  "So11111111111111111111111111111111111111112", // SOL (should be in both)
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC (should be in both)
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // Random token (might only be in DexScreener)
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // Bonk (should be in both)
  "11111111111111111111111111111112", // A token that might only be in Birdeye
]

async function testBulkTokenPrices(tokens, apiUrl) {
  console.log(`\n🔄 Testing Bulk Token Prices API with DexScreener and Birdeye Fallback`);
  console.log(`🌐 API URL: ${apiUrl}`);
  console.log(`📝 Tokens to test: ${tokens.length}`);
  
  try {
    const response = await fetch(`${apiUrl}/api/bulk-token-prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tokens })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Bulk token prices successful`);
      console.log(`📊 Results:`, data.length, 'tokens processed');
      
      data.forEach((result, index) => {
        const status = result.error ? '❌' : '✅';
        const price = result.price ? `$${result.price.toFixed(6)}` : 'N/A';
        const marketCap = result.market_cap ? `$${result.market_cap.toLocaleString()}` : 'N/A';
        console.log(`   ${index + 1}. ${status} ${result.token}: ${price} | ${marketCap}`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });
    } else {
      console.log(`❌ Bulk token prices failed: ${response.status} - ${data.error || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
    return null;
  }
}

async function testIndividualTokenInfo(token, apiUrl) {
  console.log(`\n🔍 Testing Individual Token Info for: ${token}`);
  console.log(`🌐 API URL: ${apiUrl}`);
  
  try {
    const response = await fetch(`${apiUrl}/api/token-info?address=${token}`);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Token info successful`);
      const marketCap = data.tokenInfo?.marketInfo?.marketCap || data.tokenInfo?.marketInfo?.fdv || 0;
      const price = data.tokenInfo?.priceUsd || 'N/A';
      console.log(`   Price: ${price}`);
      console.log(`   Market Cap: $${marketCap.toLocaleString()}`);
      console.log(`   Data Source: ${data.dataSource}`);
    } else {
      console.log(`❌ Token info failed: ${response.status} - ${data.error || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
    return null;
  }
}

async function testRankingsPage(apiUrl) {
  console.log(`\n🏆 Testing Rankings Page`);
  console.log(`🌐 API URL: ${apiUrl}`);
  
  try {
    const response = await fetch(`${apiUrl}/api/trades`);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Trades API successful`);
      console.log(`📊 Fetched ${data.length} trades`);
      
      if (data.length > 0) {
        // Group by trader to see trader stats
        const traders = {};
        data.forEach(trade => {
          if (!traders[trade.caller]) {
            traders[trade.caller] = [];
          }
          traders[trade.caller].push(trade);
        });
        
        console.log(`👥 Found ${Object.keys(traders).length} traders:`);
        Object.entries(traders).forEach(([trader, trades]) => {
          const winningTrades = trades.filter(t => t.is_winner).length;
          const winRate = ((winningTrades / trades.length) * 100).toFixed(1);
          const avgRoi = trades.reduce((sum, t) => sum + (t.roi || 0), 0) / trades.length;
          console.log(`   ${trader}: ${trades.length} trades, ${winRate}% win rate, ${avgRoi.toFixed(1)}% avg ROI`);
        });
        
        // Check a few sample trades for ROI data
        console.log(`\n📊 Sample trade analysis:`);
        const sampleTrades = data.slice(0, 3);
        sampleTrades.forEach((trade, index) => {
          console.log(`   Trade ${index + 1}:`);
          console.log(`     Token: ${trade.ca}`);
          console.log(`     Trader: ${trade.caller}`);
          console.log(`     Initial MC: $${trade.initial_mc?.toLocaleString() || 'N/A'}`);
          console.log(`     Current MC: $${trade.current_mc?.toLocaleString() || 'N/A'}`);
          console.log(`     ROI: ${trade.roi?.toFixed(2) || 'N/A'}%`);
          console.log(`     Is Winner: ${trade.is_winner}`);
        });
      }
    } else {
      console.log(`❌ Trades API failed: ${response.status} - ${data.error || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log(`🚀 Starting DexScreener and Birdeye Fallback Tests`);
  
  // Test Next.js API (port 3000)
  console.log(`\n=== Testing Next.js API (Port 3000) ===`);
  await testBulkTokenPrices(testTokens, 'http://localhost:3000');
  
  // Test Python API (port 8000)
  console.log(`\n=== Testing Python API (Port 8000) ===`);
  await testBulkTokenPrices(testTokens, 'http://localhost:8000');
  
  // Test individual token info with Next.js API
  console.log(`\n=== Testing Individual Token Info (Next.js API) ===`);
  for (const token of testTokens) {
    await testIndividualTokenInfo(token, 'http://localhost:3000');
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Test rankings page
  console.log(`\n=== Testing Rankings Page ===`);
  await testRankingsPage('http://localhost:3000');
  
  console.log(`\n✅ All tests completed`);
}

// Run the tests
runTests().catch(console.error); 
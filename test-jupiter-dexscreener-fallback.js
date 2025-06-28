// Test script for Jupiter fallback to DexScreener API for current market cap
// Specifically testing the rankings page functionality

const API_BASE_URL = 'http://localhost:3000';

// Test tokens with different scenarios
const testTokens = [
  {
    name: "High Market Cap Token (DexScreener should work)",
    address: "So11111111111111111111111111111111111111112", // Wrapped SOL
    expectedSource: "DexScreener",
    expectedMarketCap: "high"
  },
  {
    name: "Low Market Cap Token (should fallback to Jupiter)",
    address: "7nZG8jEaU3HFsRQ2JkUAVPQqzGMpw37V5CYtV9JdDSLf", // From mock data
    expectedSource: "Jupiter",
    expectedMarketCap: "low"
  },
  {
    name: "Non-existent Token (should return null)",
    address: "InvalidTokenAddress123456789",
    expectedSource: "null",
    expectedMarketCap: "none"
  }
];

// Test trader data for rankings page
const testTrader = {
  name: "TestTrader",
  trades: [
    {
      ca: "So11111111111111111111111111111111111111112",
      initial_mc: 1000000,
      date_called: "2023-12-15T14:30:00Z"
    },
    {
      ca: "7nZG8jEaU3HFsRQ2JkUAVPQqzGMpw37V5CYtV9JdDSLf",
      initial_mc: 500000,
      date_called: "2023-12-16T10:15:00Z"
    }
  ]
};

async function testTokenInfoAPI(tokenAddress, expectedSource) {
  console.log(`\n🔍 Testing Token Info API for: ${tokenAddress}`);
  console.log(`Expected source: ${expectedSource}`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/token-info?address=${tokenAddress}`);
    const data = await response.json();
    
    console.log(`📡 Raw API Response:`, JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log(`✅ API Response: ${response.status}`);
      
      // Check the actual response structure
      if (data.tokenInfo) {
        console.log(`📊 Token Info found:`, data.tokenInfo);
        
        if (data.tokenInfo.marketInfo) {
          const marketCap = data.tokenInfo.marketInfo.marketCap || data.tokenInfo.marketInfo.fdv || 0;
          console.log(`💰 Market Cap: $${marketCap.toLocaleString()}`);
          
          if (marketCap > 1000000) {
            console.log(`✅ High market cap detected - likely from DexScreener`);
          } else if (marketCap > 0) {
            console.log(`⚠️  Low market cap detected - likely from Jupiter fallback`);
          } else {
            console.log(`❌ No market cap data`);
          }
        } else {
          console.log(`❌ No market info in tokenInfo`);
        }
      } else if (data.marketInfo) {
        // Direct marketInfo structure
        const marketCap = data.marketInfo.marketCap || data.marketInfo.fdv || 0;
        console.log(`💰 Market Cap: $${marketCap.toLocaleString()}`);
        
        if (marketCap > 1000000) {
          console.log(`✅ High market cap detected - likely from DexScreener`);
        } else if (marketCap > 0) {
          console.log(`⚠️  Low market cap detected - likely from Jupiter fallback`);
        } else {
          console.log(`❌ No market cap data`);
        }
      } else {
        console.log(`❌ No market info in response`);
      }
    } else {
      console.log(`❌ API Error: ${response.status} - ${data.error || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
    return null;
  }
}

async function testDirectDexScreener(tokenAddress) {
  console.log(`\n🔍 Testing Direct DexScreener API for: ${tokenAddress}`);
  
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ DexScreener Response: ${response.status}`);
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        console.log(`📊 DexScreener Market Cap: $${(pair.marketCap || 0).toLocaleString()}`);
        console.log(`📊 DexScreener FDV: $${(pair.fdv || 0).toLocaleString()}`);
        return pair;
      } else {
        console.log(`❌ No pairs found in DexScreener`);
        return null;
      }
    } else {
      console.log(`❌ DexScreener Error: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ DexScreener Network Error: ${error.message}`);
    return null;
  }
}

async function testDirectJupiter(tokenAddress) {
  console.log(`\n🔍 Testing Direct Jupiter API for: ${tokenAddress}`);
  
  try {
    // Test Jupiter token list
    const tokenListResponse = await fetch("https://token.jup.ag/strict");
    if (tokenListResponse.ok) {
      const tokens = await tokenListResponse.json();
      const token = tokens.find((t) => t.address === tokenAddress);
      
      if (token) {
        console.log(`✅ Token found in Jupiter: ${token.symbol} (${token.name})`);
        
        // Test Jupiter price API
        const priceResponse = await fetch(`https://price.jup.ag/v4/price?ids=${tokenAddress}`);
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          if (priceData.data[tokenAddress]) {
            console.log(`💰 Jupiter Price: $${priceData.data[tokenAddress].price}`);
            return { token, price: priceData.data[tokenAddress].price };
          }
        }
        
        return { token, price: 0 };
      } else {
        console.log(`❌ Token not found in Jupiter`);
        return null;
      }
    } else {
      console.log(`❌ Jupiter token list error: ${tokenListResponse.status}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Jupiter Network Error: ${error.message}`);
    return null;
  }
}

async function testRankingsPageTrader(traderName, trades) {
  console.log(`\n🏆 Testing Rankings Page for Trader: ${traderName}`);
  console.log(`📈 Number of trades: ${trades.length}`);
  
  // Simulate the rankings page logic
  const tokenInfos = await Promise.all(
    trades.map(async (trade) => {
      console.log(`\n  🔄 Fetching market data for trade: ${trade.ca}`);
      
      // Test our API first
      const apiData = await testTokenInfoAPI(trade.ca, "auto");
      
      // Test direct APIs for comparison
      const dexScreenerData = await testDirectDexScreener(trade.ca);
      const jupiterData = await testDirectJupiter(trade.ca);
      
      let marketInfo = null;
      let dataSource = "none";
      
      if (apiData && apiData.tokenInfo && apiData.tokenInfo.marketInfo) {
        marketInfo = apiData.tokenInfo.marketInfo;
        dataSource = "our-api";
      } else if (dexScreenerData) {
        marketInfo = {
          marketCap: dexScreenerData.marketCap || 0,
          fdv: dexScreenerData.fdv || 0,
          pairCreatedAt: dexScreenerData.pairCreatedAt || 0
        };
        dataSource = "dexscreener-direct";
      } else if (jupiterData) {
        marketInfo = {
          marketCap: 0, // Jupiter doesn't provide market cap
          fdv: 0,
          pairCreatedAt: 0
        };
        dataSource = "jupiter-direct";
      }
      
      if (marketInfo) {
        const currentMc = marketInfo.fdv || marketInfo.marketCap || 0;
        const roi = ((currentMc - trade.initial_mc) / trade.initial_mc) * 100;
        const isWinner = currentMc > trade.initial_mc;
        
        console.log(`    💰 Initial MC: $${trade.initial_mc.toLocaleString()}`);
        console.log(`    📊 Current MC: $${currentMc.toLocaleString()}`);
        console.log(`    📈 ROI: ${roi.toFixed(2)}%`);
        console.log(`    ${isWinner ? '✅ Winner' : '❌ Loser'}`);
        console.log(`    🔗 Data Source: ${dataSource}`);
        
        return {
          token: trade.ca,
          marketInfo,
          roi,
          isWinner,
          dataSource
        };
      } else {
        console.log(`    ❌ No market data available from any source`);
        return {
          token: trade.ca,
          marketInfo: null,
          roi: 0,
          isWinner: false,
          dataSource: "none"
        };
      }
    })
  );
  
  // Calculate trader stats (simulating rankings page logic)
  const total_calls = trades.length;
  const winning_calls = tokenInfos.filter(info => info.isWinner).length;
  const win_rate = total_calls > 0 ? (winning_calls / total_calls) * 100 : 0;
  const average_roi = total_calls > 0 ? 
    tokenInfos.reduce((sum, info) => sum + info.roi, 0) / total_calls : 0;
  
  console.log(`\n📊 Trader Performance Summary:`);
  console.log(`   Total Calls: ${total_calls}`);
  console.log(`   Winning Calls: ${winning_calls}`);
  console.log(`   Win Rate: ${win_rate.toFixed(1)}%`);
  console.log(`   Average ROI: ${average_roi.toFixed(2)}%`);
  
  // Data source breakdown
  const dataSourceCounts = tokenInfos.reduce((acc, info) => {
    acc[info.dataSource] = (acc[info.dataSource] || 0) + 1;
    return acc;
  }, {});
  
  console.log(`\n📊 Data Source Breakdown:`);
  Object.entries(dataSourceCounts).forEach(([source, count]) => {
    console.log(`   ${source}: ${count} tokens`);
  });
  
  return {
    total_calls,
    winning_calls,
    win_rate,
    average_roi,
    tokenInfos,
    dataSourceCounts
  };
}

async function testBulkPriceUpdate(tokens) {
  console.log(`\n🔄 Testing Bulk Price Update API`);
  console.log(`📝 Tokens to update: ${tokens.length}`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/bulk-price-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tokens })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Bulk update successful`);
      console.log(`📊 Results:`, data.results?.length || 0, 'tokens processed');
      
      if (data.results) {
        data.results.forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.token}: $${result.marketCap?.toLocaleString() || 'N/A'}`);
        });
      }
    } else {
      console.log(`❌ Bulk update failed: ${response.status} - ${data.error || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
    return null;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Jupiter/DexScreener Fallback Tests for Rankings Page');
  console.log('=' .repeat(60));
  
  // Test 1: Individual token info API calls with detailed debugging
  console.log('\n📋 Test 1: Individual Token Info API Calls (Detailed)');
  for (const token of testTokens) {
    await testTokenInfoAPI(token.address, token.expectedSource);
  }
  
  // Test 2: Direct API testing
  console.log('\n📋 Test 1.5: Direct API Testing');
  for (const token of testTokens) {
    console.log(`\n--- Testing ${token.name} ---`);
    await testDirectDexScreener(token.address);
    await testDirectJupiter(token.address);
  }
  
  // Test 3: Rankings page trader simulation
  console.log('\n📋 Test 2: Rankings Page Trader Simulation');
  const traderResults = await testRankingsPageTrader(testTrader.name, testTrader.trades);
  
  // Test 4: Bulk price update
  console.log('\n📋 Test 3: Bulk Price Update API');
  const tokenAddresses = testTrader.trades.map(trade => trade.ca);
  await testBulkPriceUpdate(tokenAddresses);
  
  // Test 5: Test rankings page directly
  console.log('\n📋 Test 4: Direct Rankings Page Access');
  try {
    const response = await fetch(`${API_BASE_URL}/rankings`);
    if (response.ok) {
      console.log('✅ Rankings page accessible');
    } else {
      console.log(`❌ Rankings page error: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Rankings page network error: ${error.message}`);
  }
  
  console.log('\n🎯 Test Summary:');
  console.log('=' .repeat(40));
  console.log(`✅ Individual token API tests completed`);
  console.log(`✅ Direct API tests completed`);
  console.log(`✅ Rankings page simulation completed`);
  console.log(`✅ Bulk price update test completed`);
  console.log(`✅ Direct page access test completed`);
  
  if (traderResults) {
    console.log(`\n📊 Final Trader Performance:`);
    console.log(`   Win Rate: ${traderResults.win_rate.toFixed(1)}%`);
    console.log(`   Average ROI: ${traderResults.average_roi.toFixed(2)}%`);
    console.log(`   Data Sources: ${traderResults.tokenInfos.filter(info => info.marketInfo).length}/${traderResults.tokenInfos.length} tokens have market data`);
    
    console.log(`\n📊 Data Source Analysis:`);
    Object.entries(traderResults.dataSourceCounts).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} tokens`);
    });
  }
  
  console.log('\n✨ All tests completed!');
}

// Run the tests
runAllTests().catch(console.error); 
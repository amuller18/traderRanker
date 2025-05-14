import { scanTable } from "./dynamo-minimal"
import { mockTraderStats } from "./mock-data"
import type { TraderStats } from "./trader-data"

/**
 * Direct implementation of getTraderStats using the minimal DynamoDB client
 * This function is used by the test-dynamodb API route
 */
export async function getTraderStats(): Promise<TraderStats[]> {
  try {
    console.log("Getting trader statistics directly from DynamoDB")

    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADER_STATISTICS || "stats"

    // Check if we have the required environment variables
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
      console.log("AWS credentials not found in environment variables, using mock data")
      return mockTraderStats
    }

    // Scan the table
    const items = await scanTable(tableName, {
      limit: 100,
      consistentRead: true,
    })

    // If no items found, return mock data
    if (items.length === 0) {
      console.log("No items found in DynamoDB, using mock data")
      return mockTraderStats
    }

    // Convert items to TraderStats
    return items.map((item) => ({
      caller: String(item.caller || "Unknown"),
      win_rate: Number.parseFloat(item.win_rate || 0),
      total_calls: Number.parseInt(item.total_calls || 0, 10),
      winning_calls: Number.parseInt(item.winning_calls || 0, 10),
      average_roi: Number.parseFloat(item.average_roi || 0),
      micro_cap_roi: Number.parseFloat(item.micro_cap_roi || 0),
      micro_cap_winrate: Number.parseFloat(item.micro_cap_winrate || 0),
      small_cap_roi: Number.parseFloat(item.small_cap_roi || 0),
      small_cap_winrate: Number.parseFloat(item.small_cap_winrate || 0),
      mid_cap_roi: Number.parseFloat(item.mid_cap_roi || 0),
      mid_cap_winrate: Number.parseFloat(item.mid_cap_winrate || 0),
      large_cap_roi: Number.parseFloat(item.large_cap_roi || 0),
      large_cap_winrate: Number.parseFloat(item.large_cap_winrate || 0),
      mega_cap_roi: Number.parseFloat(item.mega_cap_roi || 0),
      mega_cap_winrate: Number.parseFloat(item.mega_cap_winrate || 0),
    }))
  } catch (error) {
    console.error("Error fetching trader statistics directly from DynamoDB:", error)
    console.log("Falling back to mock data due to error")
    return mockTraderStats
  }
}


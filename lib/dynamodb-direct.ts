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
      return mockTraderStats as TraderStats[] as TraderStats[]
    }

    // Scan the table
    const items = await scanTable(tableName, {
      limit: 100,
      consistentRead: true,
    })

    // If no items found, return mock data
    if (items.length === 0) {
      console.log("No items found in DynamoDB, using mock data")
      return mockTraderStats as TraderStats[]
    }

    // Convert items to TraderStats with all required fields
    return items.map((item) => ({
      caller: String(item.caller || "Unknown"),
      n_calls: Number.parseInt(item.n_calls || item.total_calls || 0, 10),
      first_call_date: String(item.first_call_date || ""),
      last_call_date: String(item.last_call_date || ""),
      mean_ath_roi_pct: Number.parseFloat(item.mean_ath_roi_pct || item.average_roi || 0),
      median_ath_roi_pct: Number.parseFloat(item.median_ath_roi_pct || 0),
      std_ath_roi_pct: Number.parseFloat(item.std_ath_roi_pct || 0),
      mean_atl_roi_pct: Number.parseFloat(item.mean_atl_roi_pct || 0),
      best_roi_pct: Number.parseFloat(item.best_roi_pct || 0),
      worst_roi_pct: Number.parseFloat(item.worst_roi_pct || 0),
      win_rate_pct: Number.parseFloat(item.win_rate_pct || item.win_rate || 0),
      win_threshold_pct: Number.parseFloat(item.win_threshold_pct || 0),
      win_rate_mc_p5: Number.parseFloat(item.win_rate_mc_p5 || 0),
      win_rate_mc_p50: Number.parseFloat(item.win_rate_mc_p50 || 0),
      win_rate_mc_p95: Number.parseFloat(item.win_rate_mc_p95 || 0),
      hit_2x_pct: Number.parseFloat(item.hit_2x_pct || 0),
      hit_3x_pct: Number.parseFloat(item.hit_3x_pct || 0),
      hit_5x_pct: Number.parseFloat(item.hit_5x_pct || 0),
      hit_10x_pct: Number.parseFloat(item.hit_10x_pct || 0),
      hit_20x_pct: Number.parseFloat(item.hit_20x_pct || 0),
      hit_50x_pct: Number.parseFloat(item.hit_50x_pct || 0),
      hit_100x_pct: Number.parseFloat(item.hit_100x_pct || 0),
      sharpe_ratio: Number.parseFloat(item.sharpe_ratio || 0),
      sortino_ratio: Number.parseFloat(item.sortino_ratio || 0),
      max_drawdown_pct: Number.parseFloat(item.max_drawdown_pct || 0),
      ev: Number.parseFloat(item.ev || 0),
      ev_weighted: Number.parseFloat(item.ev_weighted || 0),
      avg_days_to_ath: Number.parseFloat(item.avg_days_to_ath || 0),
      median_days_to_ath: Number.parseFloat(item.median_days_to_ath || 0),
      avg_correlation_with_others: Number.parseFloat(item.avg_correlation_with_others || 0),
      risk_score: Number.parseFloat(item.risk_score || 0),
      consistency_score: Number.parseFloat(item.consistency_score || 0),
      computed_at: String(item.computed_at || new Date().toISOString()),
      // Deprecated fields for backwards compatibility
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
    return mockTraderStats as TraderStats[]
  }
}


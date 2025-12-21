/**
 * Official Stats Repository
 *
 * Data access layer for official trader statistics from the officialStats DynamoDB table.
 * This table uses 'username' as the primary key instead of 'caller'.
 * Maps the database schema to the expected frontend format.
 *
 * Part of: Backend Layer (Data Access)
 */

import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, OFFICIAL_STATS_TABLE } from './dynamoClient.js'

/**
 * Map official stats record to frontend-compatible format
 * @param {Object} record - Raw DynamoDB record
 * @returns {Object} Mapped trader stats
 */
function mapToTraderStats(record) {
  const winRatePct = record.win_rate_pct || 0
  const nCalls = record.n_calls || 0

  return {
    // Primary identifier (map username to caller for frontend compatibility)
    caller: record.username,

    // Basic stats
    total_calls: nCalls,
    winning_calls: Math.round(nCalls * (winRatePct / 100)),
    win_rate: winRatePct / 100, // Convert percentage to decimal for frontend
    average_roi: record.mean_ath_roi_pct || 0,

    // Extended stats from officialStats table
    first_call_date: record.first_call_date,
    last_call_date: record.last_call_date,
    computed_at: record.computed_at,

    // ROI metrics
    mean_ath_roi_pct: record.mean_ath_roi_pct || 0,
    median_ath_roi_pct: record.median_ath_roi_pct || 0,
    std_ath_roi_pct: record.std_ath_roi_pct || 0,
    mean_atl_roi_pct: record.mean_atl_roi_pct || 0,
    best_roi_pct: record.best_roi_pct || 0,
    worst_roi_pct: record.worst_roi_pct || 0,

    // Win rate metrics
    win_rate_pct: winRatePct,
    win_threshold_pct: record.win_threshold_pct || 25,
    win_rate_mc_p5: record.win_rate_mc_p5 || 0,
    win_rate_mc_p50: record.win_rate_mc_p50 || 0,
    win_rate_mc_p95: record.win_rate_mc_p95 || 0,

    // Hit rate metrics (percentage of trades hitting various multipliers)
    hit_2x_pct: record.hit_2x_pct || 0,
    hit_3x_pct: record.hit_3x_pct || 0,
    hit_5x_pct: record.hit_5x_pct || 0,
    hit_10x_pct: record.hit_10x_pct || 0,
    hit_20x_pct: record.hit_20x_pct || 0,
    hit_50x_pct: record.hit_50x_pct || 0,
    hit_100x_pct: record.hit_100x_pct || 0,

    // Risk metrics
    sharpe_ratio: record.sharpe_ratio || 0,
    sortino_ratio: record.sortino_ratio || 0,
    max_drawdown_pct: record.max_drawdown_pct || 0,
    risk_score: record.risk_score || 0,
    consistency_score: record.consistency_score || 0,

    // Expected value metrics
    ev: record.ev || 0,
    ev_weighted: record.ev_weighted || 0,

    // Time to ATH metrics
    avg_days_to_ath: record.avg_days_to_ath || 0,
    median_days_to_ath: record.median_days_to_ath || 0,

    // Correlation metrics
    avg_correlation_with_others: record.avg_correlation_with_others || 0,
  }
}

/**
 * Fetch all trader statistics from the officialStats DynamoDB table
 * @returns {Promise<Array>} Array of mapped trader statistics
 */
export async function findAll() {
  const command = new ScanCommand({
    TableName: OFFICIAL_STATS_TABLE,
  })

  const result = await docClient.send(command)
  const items = result.Items || []

  // Map each record to the frontend-compatible format
  return items.map(mapToTraderStats)
}

/**
 * Find a specific trader by username
 * @param {string} username - The trader's username
 * @returns {Promise<Object|null>} Mapped trader stats or null if not found
 */
export async function findByUsername(username) {
  const command = new ScanCommand({
    TableName: OFFICIAL_STATS_TABLE,
    FilterExpression: 'username = :username',
    ExpressionAttributeValues: {
      ':username': username,
    },
  })

  const result = await docClient.send(command)
  const items = result.Items || []

  if (items.length === 0) {
    return null
  }

  return mapToTraderStats(items[0])
}

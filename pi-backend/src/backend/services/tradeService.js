/**
 * Trade Service
 *
 * Business logic layer for trade operations. Orchestrates between
 * repositories and applies domain rules.
 *
 * Part of: Backend Layer (Business Logic)
 */

import * as tradeRepository from '../repositories/tradeRepository.js'
import { applyTradeFilters } from '../utils/filters.js'

/**
 * Get all trades
 * @returns {Promise<Array>} All trade records
 */
export async function getAllTrades() {
  return await tradeRepository.findAll()
}

/**
 * Get trades with filtering
 * @param {Object} [filters] - Optional filter criteria
 * @returns {Promise<Array>} Filtered trade records
 */
export async function getFilteredTrades(filters = {}) {
  const trades = await tradeRepository.findAll()
  return applyTradeFilters(trades, filters)
}

/**
 * Get trades for a specific trader
 * @param {string} caller - Trader identifier
 * @returns {Promise<Array>} Trades for the trader
 */
export async function getTraderTrades(caller) {
  return await tradeRepository.findByTrader(caller)
}

/**
 * Create or update a trade
 * @param {Object} trade - Trade data
 * @throws {Error} If required fields are missing
 */
export async function saveTrade(trade) {
  if (!trade.caller || !trade.ca || !trade.date_called) {
    throw new Error('Trade caller, ca, and date_called are required')
  }

  await tradeRepository.save(trade)
}

/**
 * Delete a trade
 * @param {string} caller - Trader identifier
 * @param {string} ca - Contract address
 * @param {string} date_called - Trade date
 * @throws {Error} If required fields are missing
 */
export async function deleteTrade(caller, ca, date_called) {
  if (!caller || !ca || !date_called) {
    throw new Error('caller, ca, and date_called are required')
  }

  await tradeRepository.remove(caller, ca, date_called)
}

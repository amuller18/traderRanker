/**
 * Trader Service
 *
 * Business logic layer for trader operations. Orchestrates between
 * repositories and applies domain rules.
 *
 * Part of: Backend Layer (Business Logic)
 */

import * as traderRepository from '../repositories/traderRepository.js'
import { applyTraderFilters } from '../utils/filters.js'

/**
 * Get all traders with optional filtering
 * @param {Object} [filters] - Optional filter criteria
 * @returns {Promise<Array>} Filtered trader statistics
 */
export async function getTraders(filters = {}) {
  const traders = await traderRepository.findAll()
  return applyTraderFilters(traders, filters)
}

/**
 * Create or update a trader
 * @param {Object} trader - Trader data
 * @throws {Error} If caller is missing
 */
export async function saveTrader(trader) {
  if (!trader.caller) {
    throw new Error('Trader caller is required')
  }

  await traderRepository.save(trader)
}

/**
 * Delete a trader
 * @param {string} caller - Trader identifier
 */
export async function deleteTrader(caller) {
  await traderRepository.remove(caller)
}

/**
 * Filter Utilities
 *
 * Domain-level filter functions for traders and trades.
 * These implement the business rules for filtering data.
 *
 * Part of: Backend Layer (Domain Utilities)
 */

/**
 * Apply filters to trader statistics
 * @param {Array} traders - Array of trader records
 * @param {Object} filters - Filter criteria
 * @param {number} [filters.winRateMin] - Minimum win rate
 * @param {number} [filters.winRateMax] - Maximum win rate
 * @param {number} [filters.totalCallsMin] - Minimum total calls
 * @param {number} [filters.totalCallsMax] - Maximum total calls
 * @param {number} [filters.roiMin] - Minimum ROI
 * @param {number} [filters.roiMax] - Maximum ROI
 * @param {string} [filters.search] - Search term for caller
 * @returns {Array} Filtered traders
 */
export function applyTraderFilters(traders, filters) {
  let filtered = [...traders]

  if (filters.winRateMin !== undefined) {
    filtered = filtered.filter(t => t.win_rate >= parseFloat(filters.winRateMin))
  }
  if (filters.winRateMax !== undefined) {
    filtered = filtered.filter(t => t.win_rate <= parseFloat(filters.winRateMax))
  }
  if (filters.totalCallsMin !== undefined) {
    filtered = filtered.filter(t => t.total_calls >= parseInt(filters.totalCallsMin))
  }
  if (filters.totalCallsMax !== undefined) {
    filtered = filtered.filter(t => t.total_calls <= parseInt(filters.totalCallsMax))
  }
  if (filters.roiMin !== undefined) {
    filtered = filtered.filter(t => t.average_roi >= parseFloat(filters.roiMin))
  }
  if (filters.roiMax !== undefined) {
    filtered = filtered.filter(t => t.average_roi <= parseFloat(filters.roiMax))
  }
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filtered = filtered.filter(t => t.caller.toLowerCase().includes(searchLower))
  }

  return filtered
}

/**
 * Apply filters to trades
 * @param {Array} trades - Array of trade records
 * @param {Object} filters - Filter criteria
 * @param {number} [filters.roiMin] - Minimum ROI percentage
 * @param {number} [filters.roiMax] - Maximum ROI percentage
 * @param {number} [filters.mcMin] - Minimum initial market cap
 * @param {number} [filters.mcMax] - Maximum initial market cap
 * @param {string} [filters.dateFrom] - Start date
 * @param {string} [filters.dateTo] - End date
 * @param {string} [filters.search] - Search term for contract address
 * @param {string} [filters.trader] - Filter by specific trader
 * @returns {Array} Filtered trades
 */
export function applyTradeFilters(trades, filters) {
  let filtered = [...trades]

  if (filters.roiMin !== undefined || filters.roiMax !== undefined) {
    filtered = filtered.filter(trade => {
      const roi = ((trade.current_mc - trade.initial_mc) / trade.initial_mc) * 100
      if (filters.roiMin !== undefined && roi < parseFloat(filters.roiMin)) return false
      if (filters.roiMax !== undefined && roi > parseFloat(filters.roiMax)) return false
      return true
    })
  }

  if (filters.mcMin !== undefined) {
    filtered = filtered.filter(t => t.initial_mc >= parseFloat(filters.mcMin))
  }
  if (filters.mcMax !== undefined) {
    filtered = filtered.filter(t => t.initial_mc <= parseFloat(filters.mcMax))
  }

  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom)
    filtered = filtered.filter(t => new Date(t.date_called) >= fromDate)
  }
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo)
    filtered = filtered.filter(t => new Date(t.date_called) <= toDate)
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filtered = filtered.filter(t => t.ca.toLowerCase().includes(searchLower))
  }
  if (filters.trader) {
    filtered = filtered.filter(t => t.caller === filters.trader)
  }

  return filtered
}

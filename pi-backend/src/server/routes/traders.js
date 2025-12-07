/**
 * Trader Routes
 *
 * HTTP endpoints for trader operations. These are thin wrappers
 * that delegate to the backend service layer.
 *
 * Part of: Server Layer (Routes)
 */

import { Router } from 'express'
import * as traderService from '../../backend/services/traderService.js'
import * as tradeService from '../../backend/services/tradeService.js'

const router = Router()

/**
 * GET /api/traders/stats
 * Fetch all trader statistics with optional filters
 */
router.get('/stats', async (req, res) => {
  try {
    const traders = await traderService.getTraders(req.query)
    res.json(traders)
  } catch (error) {
    console.error('Error fetching trader stats:', error)
    res.status(500).json({ error: 'Failed to fetch trader stats', message: error.message })
  }
})

/**
 * GET /api/traders/:caller/trades
 * Fetch all trades for a specific trader
 */
router.get('/:caller/trades', async (req, res) => {
  try {
    const { caller } = req.params
    const trades = await tradeService.getTraderTrades(decodeURIComponent(caller))
    res.json(trades)
  } catch (error) {
    console.error(`Error fetching trades for ${req.params.caller}:`, error)
    res.status(500).json({ error: 'Failed to fetch trader trades', message: error.message })
  }
})

/**
 * POST /api/traders
 * Create or update a trader
 */
router.post('/', async (req, res) => {
  try {
    await traderService.saveTrader(req.body)
    res.json({ success: true, message: `Trader ${req.body.caller} saved successfully` })
  } catch (error) {
    console.error('Error saving trader:', error)
    res.status(error.message.includes('required') ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to save trader'
    })
  }
})

/**
 * DELETE /api/traders/:caller
 * Delete a trader
 */
router.delete('/:caller', async (req, res) => {
  try {
    const { caller } = req.params
    await traderService.deleteTrader(decodeURIComponent(caller))
    res.json({ success: true, message: `Trader ${caller} removed successfully` })
  } catch (error) {
    console.error(`Error deleting trader ${req.params.caller}:`, error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete trader'
    })
  }
})

export default router

/**
 * Trade Routes
 *
 * HTTP endpoints for trade operations. These are thin wrappers
 * that delegate to the backend service layer.
 *
 * Part of: Server Layer (Routes)
 */

import { Router } from 'express'
import * as tradeService from '../../backend/services/tradeService.js'

const router = Router()

/**
 * GET /api/trades
 * Fetch all trades
 */
router.get('/', async (req, res) => {
  try {
    const trades = await tradeService.getAllTrades()
    res.json(trades)
  } catch (error) {
    console.error('Error fetching all trades:', error)
    res.status(500).json({ error: 'Failed to fetch trades', message: error.message })
  }
})

/**
 * GET /api/trades/filtered
 * Fetch trades with filters
 */
router.get('/filtered', async (req, res) => {
  try {
    const trades = await tradeService.getFilteredTrades(req.query)
    res.json(trades)
  } catch (error) {
    console.error('Error fetching filtered trades:', error)
    res.status(500).json({ error: 'Failed to fetch trades', message: error.message })
  }
})

/**
 * POST /api/trades
 * Create or update a trade
 */
router.post('/', async (req, res) => {
  try {
    await tradeService.saveTrade(req.body)
    res.json({ success: true, message: `Trade for ${req.body.caller} saved successfully` })
  } catch (error) {
    console.error('Error saving trade:', error)
    res.status(error.message.includes('required') ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to save trade'
    })
  }
})

/**
 * DELETE /api/trades
 * Delete a trade
 */
router.delete('/', async (req, res) => {
  try {
    const { caller, ca, date_called } = req.body
    await tradeService.deleteTrade(caller, ca, date_called)
    res.json({ success: true, message: `Trade for ${caller} removed successfully` })
  } catch (error) {
    console.error('Error deleting trade:', error)
    res.status(error.message.includes('required') ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to delete trade'
    })
  }
})

export default router

/**
 * Health Check Routes
 *
 * Provides health/readiness endpoints for monitoring.
 *
 * Part of: Server Layer (Routes)
 */

import { Router } from 'express'

const router = Router()

/**
 * GET /health
 * Health check endpoint (no authentication required)
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default router

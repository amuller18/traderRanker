/**
 * Route Registry
 *
 * Central registration point for all API routes.
 * Applies authentication middleware to protected routes.
 *
 * Part of: Server Layer (Routes)
 */

import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import healthRoutes from './health.js'
import traderRoutes from './traders.js'
import tradeRoutes from './trades.js'

const router = Router()

// Public routes (no authentication required)
router.use(healthRoutes)

// Protected API routes
router.use('/api/traders', authenticate, traderRoutes)
router.use('/api/trades', authenticate, tradeRoutes)

export default router

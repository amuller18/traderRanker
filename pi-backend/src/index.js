/**
 * TraderRanker API Server Entry Point
 *
 * This is the main entry point for the Express server.
 * It configures middleware, registers routes, and starts the server.
 *
 * Architecture:
 * - Server Layer: HTTP handling, middleware, routes
 * - Backend Layer: Business logic, data access, domain utilities
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'

import routes from './server/routes/index.js'
import { notFoundHandler, globalErrorHandler } from './server/middleware/errorHandler.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 8000

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// Security headers
app.use(helmet())

// CORS configuration - only allow configured origins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))

// Parse JSON bodies
app.use(express.json())

// ============================================================================
// ROUTES
// ============================================================================

app.use(routes)

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use(notFoundHandler)
app.use(globalErrorHandler)

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`🚀 TraderRanker API server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔒 CORS allowed origins: ${process.env.ALLOWED_ORIGINS || 'None configured'}`)
  console.log(`💾 DynamoDB Tables: ${process.env.DYNAMODB_TRADERS_TABLE || 'CallerStatistics'}, ${process.env.DYNAMODB_TRADES_TABLE || 'Trades'}`)
  console.log('')
  console.log('📁 Architecture:')
  console.log('   └── server/     (HTTP handling, routes, middleware)')
  console.log('   └── backend/    (Business logic, repositories, services)')
})

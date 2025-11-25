import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  PutCommand,
  DeleteCommand
} from '@aws-sdk/lib-dynamodb'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 8000

// Initialize DynamoDB Client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const docClient = DynamoDBDocumentClient.from(dynamoClient)

const TRADERS_TABLE = process.env.DYNAMODB_TRADERS_TABLE || 'CallerStatistics'
const TRADES_TABLE = process.env.DYNAMODB_TRADES_TABLE || 'Trades'

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet())

// CORS configuration - only allow your Vercel domain
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
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * API Key authentication middleware
 * Checks for X-API-Key header or Cloudflare Access JWT
 */
function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key']
  const expectedApiKey = process.env.API_KEY

  // Check API key
  if (apiKey && apiKey === expectedApiKey) {
    return next()
  }

  // Optional: Check Cloudflare Access JWT
  // If you're using Cloudflare Tunnel with Access, validate the CF-Access-JWT-Assertion header
  const cfJwt = req.headers['cf-access-jwt-assertion']
  if (cfJwt && process.env.CLOUDFLARE_TEAM_DOMAIN) {
    // In production, you would verify this JWT against Cloudflare's public keys
    // For now, we'll just check if it exists
    // See: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
    console.log('Cloudflare Access JWT detected')
    return next()
  }

  res.status(401).json({ error: 'Unauthorized - Invalid or missing API key' })
}

// Apply authentication to all API routes
app.use('/api', authenticate)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Apply filters to trader stats query
 */
function applyTraderFilters(traders, filters) {
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
 * Apply filters to trades query
 */
function applyTradeFilters(trades, filters) {
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

// ============================================================================
// API ROUTES
// ============================================================================

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ----------------------------------------------------------------------------
// TRADER STATS ROUTES
// ----------------------------------------------------------------------------

/**
 * GET /api/traders/stats
 * Fetch all trader statistics with optional filters
 */
app.get('/api/traders/stats', async (req, res) => {
  try {
    const command = new ScanCommand({
      TableName: TRADERS_TABLE,
    })

    const result = await docClient.send(command)
    let traders = result.Items || []

    // Apply filters if provided
    traders = applyTraderFilters(traders, req.query)

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
app.get('/api/traders/:caller/trades', async (req, res) => {
  try {
    const { caller } = req.params

    const command = new QueryCommand({
      TableName: TRADES_TABLE,
      KeyConditionExpression: 'caller = :caller',
      ExpressionAttributeValues: {
        ':caller': decodeURIComponent(caller),
      },
    })

    const result = await docClient.send(command)
    res.json(result.Items || [])
  } catch (error) {
    console.error(`Error fetching trades for ${req.params.caller}:`, error)
    res.status(500).json({ error: 'Failed to fetch trader trades', message: error.message })
  }
})

/**
 * POST /api/traders
 * Create or update a trader
 */
app.post('/api/traders', async (req, res) => {
  try {
    const trader = req.body

    if (!trader.caller) {
      return res.status(400).json({ error: 'Trader caller is required' })
    }

    const command = new PutCommand({
      TableName: TRADERS_TABLE,
      Item: trader,
    })

    await docClient.send(command)
    res.json({ success: true, message: `Trader ${trader.caller} saved successfully` })
  } catch (error) {
    console.error('Error saving trader:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save trader'
    })
  }
})

/**
 * DELETE /api/traders/:caller
 * Delete a trader
 */
app.delete('/api/traders/:caller', async (req, res) => {
  try {
    const { caller } = req.params

    const command = new DeleteCommand({
      TableName: TRADERS_TABLE,
      Key: { caller: decodeURIComponent(caller) },
    })

    await docClient.send(command)
    res.json({ success: true, message: `Trader ${caller} removed successfully` })
  } catch (error) {
    console.error(`Error deleting trader ${req.params.caller}:`, error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete trader'
    })
  }
})

// ----------------------------------------------------------------------------
// TRADES ROUTES
// ----------------------------------------------------------------------------

/**
 * GET /api/trades
 * Fetch all trades
 */
app.get('/api/trades', async (req, res) => {
  try {
    const command = new ScanCommand({
      TableName: TRADES_TABLE,
    })

    const result = await docClient.send(command)
    res.json(result.Items || [])
  } catch (error) {
    console.error('Error fetching all trades:', error)
    res.status(500).json({ error: 'Failed to fetch trades', message: error.message })
  }
})

/**
 * GET /api/trades/filtered
 * Fetch trades with filters
 */
app.get('/api/trades/filtered', async (req, res) => {
  try {
    const command = new ScanCommand({
      TableName: TRADES_TABLE,
    })

    const result = await docClient.send(command)
    let trades = result.Items || []

    // Apply filters
    trades = applyTradeFilters(trades, req.query)

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
app.post('/api/trades', async (req, res) => {
  try {
    const trade = req.body

    if (!trade.caller || !trade.ca || !trade.date_called) {
      return res.status(400).json({ error: 'Trade caller, ca, and date_called are required' })
    }

    const command = new PutCommand({
      TableName: TRADES_TABLE,
      Item: trade,
    })

    await docClient.send(command)
    res.json({ success: true, message: `Trade for ${trade.caller} saved successfully` })
  } catch (error) {
    console.error('Error saving trade:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save trade'
    })
  }
})

/**
 * DELETE /api/trades
 * Delete a trade
 */
app.delete('/api/trades', async (req, res) => {
  try {
    const { caller, ca, date_called } = req.body

    if (!caller || !ca || !date_called) {
      return res.status(400).json({ error: 'caller, ca, and date_called are required' })
    }

    const command = new DeleteCommand({
      TableName: TRADES_TABLE,
      Key: { caller, ca, date_called },
    })

    await docClient.send(command)
    res.json({ success: true, message: `Trade for ${caller} removed successfully` })
  } catch (error) {
    console.error('Error deleting trade:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete trade'
    })
  }
})

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`🚀 TraderRanker API server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔒 CORS allowed origins: ${process.env.ALLOWED_ORIGINS || 'None configured'}`)
  console.log(`💾 DynamoDB Tables: ${TRADERS_TABLE}, ${TRADES_TABLE}`)
})

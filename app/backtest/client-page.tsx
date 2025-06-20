"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
// Simple table components
const Table = ({ children }: { children: React.ReactNode }) => (
  <table className="w-full caption-bottom text-sm">{children}</table>
)
const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <thead className="[&_tr]:border-b">{children}</thead>
)
const TableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="[&_tr:last-child]:border-0">{children}</tbody>
)
const TableRow = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <tr className={`border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${className}`}>
    {children}
  </tr>
)
const TableHead = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <th className={`h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 ${className}`}>
    {children}
  </th>
)
const TableCell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`}>
    {children}
  </td>
)
// Trade interface definition
interface Trade {
  ca: string
  caller: string
  date_called: string
  initial_mc: number
  current_mc: number
  high_mc?: number
  low_mc?: number
  high_price?: number
  low_price?: number
  high_time?: string
  low_time?: string
  total_supply?: number
  circulating_supply?: number
}
import { Button } from "@/components/ui/button"
import { Plus, Minus, Download } from "lucide-react"
import { Input } from "@/components/ui/input"

interface TakeProfitLevel {
  percentage: number
  sellPercentage: number
}

interface StopLossLevel {
  percentage: number
  sellPercentage: number
}

interface PositionSizing {
  type: 'percentage' | 'fixed'
  value: number
}

interface BacktestResult {
  date: string
  profit: number
  cumulativeProfit: number
  trade: Trade
  exitPrice: number
  exitDate: string
  roi: number
  unrealizedGain: number
  realizedGain: number
  remainingPosition: number
  takeProfitsHit: number[]
  stopLossesHit: number[]
  positionSize: number
  isBankrupt: boolean
  finalValue: number
  entryPrice: number
}

// Updated interfaces to match the new FastAPI response
interface PositionPoint {
  ts: number
  value: number
  coins_held: number
  unrealized: number
  realized: number
}

interface SimulationResult {
  token: string
  ledger: PositionPoint[] | null
  realized_profit: number | null
  unrealized_profit: number | null
  coins_left: number | null
  tps_hit: number[] | null
  sls_hit: number[] | null
  error?: string
}

interface BacktestClientPageProps {
  initialTrades: Trade[]
}

// Chart data interfaces
interface ChartDataPoint {
  timestamp: number
  date: string
  [key: string]: any // For dynamic token values
}

function formatLargeNumber(num: number): string {
  if (!isFinite(num)) return '0'
  const absNum = Math.abs(num)
  if (absNum >= 1e12) return (num / 1e12).toFixed(2) + ' T'
  if (absNum >= 1e9) return (num / 1e9).toFixed(2) + ' B'
  if (absNum >= 1e6) return (num / 1e6).toFixed(2) + ' M'
  if (absNum >= 1e3) return (num / 1e3).toFixed(2) + ' K'
  return num.toFixed(2)
}

function calculatePriceFromMarketCap(marketCap: number, supply: number = 1e9): number {
  if (!marketCap || !supply || supply === 0) return 0
  return marketCap / supply
}

function calculateMarketCapFromPrice(price: number, supply: number = 1e9): number {
  if (!price || !supply) return 0
  return price * supply * 1000 // Multiply by 1000 to get correct market cap
}

function safeFormatDate(date: Date | string, fallback: string = "N/A"): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) return fallback
    
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return fallback
  }
}

function formatChartDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  if (isToday) {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }
}

export function BacktestClientPage({ initialTrades }: BacktestClientPageProps) {
  const [takeProfits, setTakeProfits] = useState<TakeProfitLevel[]>([{ percentage: 100, sellPercentage: 100 }])
  const [stopLosses, setStopLosses] = useState<StopLossLevel[]>([])
  const [selectedCaller, setSelectedCaller] = useState<string>("all")
  const [initialCapital, setInitialCapital] = useState(1000)
  const [positionSizing, setPositionSizing] = useState<PositionSizing>({ type: 'percentage', value: 10 })
  const [marketCapRange, setMarketCapRange] = useState<[number, number]>([0, 1e12])
  const [timeRange, setTimeRange] = useState<[Date, Date]>([new Date(2023, 0, 1), new Date()])
  const [maxTrades, setMaxTrades] = useState<number>(0)
  const [isRunning, setIsRunning] = useState(false)
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [simulationErrors, setSimulationErrors] = useState<string[]>([])
  const [backtestDuration, setBacktestDuration] = useState<number | null>(null)
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [apiUrl] = useState(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [cumulativeChartData, setCumulativeChartData] = useState<ChartDataPoint[]>([])

  const callers = useMemo(() => {
    const uniqueCallers = new Set(initialTrades.map(trade => trade.caller))
    return Array.from(uniqueCallers).filter(Boolean)
  }, [initialTrades])

  const filteredTrades = useMemo(() => {
    let filtered = initialTrades
    
    if (selectedCaller !== "all") {
      filtered = filtered.filter(trade => trade.caller === selectedCaller)
    }
    
    filtered = filtered.filter(trade => {
      try {
        const tradeDate = new Date(trade.date_called)
        const mc = trade.initial_mc ?? 0
        return (
          !isNaN(tradeDate.getTime()) &&
          tradeDate >= timeRange[0] && 
          tradeDate <= timeRange[1] &&
          mc >= marketCapRange[0] &&
          mc <= marketCapRange[1] &&
          mc > 0
        )
      } catch {
        return false
      }
    })
    
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.date_called).getTime()
      const dateB = new Date(b.date_called).getTime()
      return dateB - dateA
    })
    
    if (maxTrades > 0) {
      filtered = filtered.slice(0, maxTrades)
    }
    
    return filtered
  }, [initialTrades, selectedCaller, timeRange, marketCapRange, maxTrades])

  // Check API status on mount and periodically
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

        const response = await fetch(`${apiUrl}/ping`, {
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (response.ok) {
          setApiStatus('connected')
          setError(null)
        } else {
          setApiStatus('disconnected')
          setError('API server is not responding correctly')
        }
      } catch (error) {
        setApiStatus('disconnected')
        setError('Failed to connect to API server')
      }
    }

    // Check immediately
    checkApiStatus()

    // Then check every 30 seconds
    const intervalId = setInterval(checkApiStatus, 30000)

    return () => clearInterval(intervalId)
  }, [apiUrl])

  // Helper function to convert take profit/stop loss levels to the format expected by the API
  const convertLadderLevels = (levels: TakeProfitLevel[] | StopLossLevel[], isTakeProfit: boolean) => {
    if (levels.length === 0) {
      return []
    }
    
    return levels.map(level => {
      // For take profits: percentage is positive (e.g., 100% = 1.0)
      // For stop losses: percentage is negative (e.g., -10% = 0.1)
      const ratio = isTakeProfit ? level.percentage / 100 : Math.abs(level.percentage) / 100
      const sellFraction = level.sellPercentage / 100
      
      // Allow 0:0 to disable a level
      if (ratio === 0 && sellFraction === 0) {
        return "0:0"
      }
      
      return `${ratio.toFixed(4)}:${sellFraction.toFixed(4)}`
    }).filter(level => level !== "0:0") // Remove disabled levels
  }

  // Function to generate chart data from simulation results
  const generateChartData = (simulationResults: SimulationResult[]) => {
    const validResults = simulationResults.filter(r => r.ledger && r.ledger.length > 0)
    
    if (validResults.length === 0) {
      setChartData([])
      setCumulativeChartData([])
      return
    }

    // Collect all timestamps and find the time range
    const allTimestamps = new Set<number>()
    let earliestTime = Infinity
    let latestTime = 0
    
    validResults.forEach(result => {
      result.ledger!.forEach(point => {
        allTimestamps.add(point.ts)
        earliestTime = Math.min(earliestTime, point.ts)
        latestTime = Math.max(latestTime, point.ts)
      })
    })

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b)

    // Generate individual token chart data
    const individualChartData: ChartDataPoint[] = sortedTimestamps.map(ts => {
      const dataPoint: ChartDataPoint = {
        timestamp: ts,
        date: formatChartDate(ts)
      }

      validResults.forEach(result => {
        const ledgerPoint = result.ledger!.find(p => p.ts === ts)
        if (ledgerPoint) {
          const equity = ledgerPoint.value + ledgerPoint.realized
          dataPoint[result.token] = equity
        } else {
          // If no data point for this timestamp, use the last available value
          const lastPoint = result.ledger!.filter(p => p.ts <= ts).pop()
          if (lastPoint) {
            const equity = lastPoint.value + lastPoint.realized
            dataPoint[result.token] = equity
          }
        }
      })

      return dataPoint
    })

    // Generate cumulative chart data
    const cumulativeChartData: ChartDataPoint[] = sortedTimestamps.map(ts => {
      const dataPoint: ChartDataPoint = {
        timestamp: ts,
        date: formatChartDate(ts),
        cumulative: 0
      }

      let cumulativeValue = 0
      validResults.forEach(result => {
        const ledgerPoint = result.ledger!.find(p => p.ts === ts)
        if (ledgerPoint) {
          const equity = ledgerPoint.value + ledgerPoint.realized
          cumulativeValue += equity
        } else {
          // If no data point for this timestamp, use the last available value
          const lastPoint = result.ledger!.filter(p => p.ts <= ts).pop()
          if (lastPoint) {
            const equity = lastPoint.value + lastPoint.realized
            cumulativeValue += equity
          }
        }
      })

      dataPoint.cumulative = cumulativeValue
      return dataPoint
    })

    console.log('Chart time range:', {
      earliest: new Date(earliestTime * 1000).toISOString(),
      latest: new Date(latestTime * 1000).toISOString(),
      dataPoints: individualChartData.length,
      timeSpan: `${Math.round((latestTime - earliestTime) / 3600)} hours`
    })

    // Log sample data points for debugging
    if (individualChartData.length > 0) {
      console.log('Sample chart data:', {
        first: individualChartData[0],
        last: individualChartData[individualChartData.length - 1],
        totalPoints: individualChartData.length
      })
    }

    setChartData(individualChartData)
    setCumulativeChartData(cumulativeChartData)
  }

  const runBacktest = async () => {
    console.log('Starting backtest...')
    if (apiStatus !== 'connected') {
      console.log('API not connected, current status:', apiStatus)
      setError('API server is not connected. Please ensure the FastAPI server is running.')
      return
    }

    setIsRunning(true)
    setError(null)
    setSimulationErrors([])
    setBacktestResults([])
    setChartData([])
    setCumulativeChartData([])
    const results: BacktestResult[] = []
    const startTime = Date.now()

    try {
      // Prepare tokens for simulation
      const tokens = filteredTrades.map(trade => trade.ca)
      console.log('Prepared tokens for simulation:', tokens.length)
      
      if (tokens.length === 0) {
        setError('No valid trades to analyze. Please check your filters.')
        return
      }

      // Calculate the earliest trade date to use as start time
      const earliestTradeDate = new Date(Math.min(...filteredTrades.map(trade => new Date(trade.date_called).getTime())))
      const startUnix = Math.floor(earliestTradeDate.getTime() / 1000)
      
      console.log('Trade date range:', {
        earliest: earliestTradeDate.toISOString(),
        latest: new Date().toISOString(),
        startUnix
      })

      // Convert ladder levels to API format
      const tpLevels = convertLadderLevels(takeProfits, true)
      const slLevels = convertLadderLevels(stopLosses, false)

      console.log('TP levels:', tpLevels)
      console.log('SL levels:', slLevels)

      // Call FastAPI simulate endpoint with timeout and retries
      const maxRetries = 3
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Attempt ${attempt} of ${maxRetries}`)
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

          const requestBody = {
            tokens,
            amount_usd: initialCapital,
            start_unix: startUnix,  // Use actual trade start time
            tp: tpLevels,
            sl: slLevels,
            timeframe_minutes: 5,
            days_back: 30  // Fallback for maximum range
          }

          console.log('Sending request to:', `${apiUrl}/api/simulate`)
          console.log('Request body:', JSON.stringify(requestBody, null, 2))
          console.log('Time range:', {
            from: earliestTradeDate.toISOString(),
            to: new Date().toISOString(),
            startUnix,
            daysBack: Math.ceil((Date.now() - earliestTradeDate.getTime()) / (1000 * 60 * 60 * 24))
          })

          const response = await fetch(`${apiUrl}/api/simulate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          })

          clearTimeout(timeoutId)
          console.log('Response status:', response.status)

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('API error response:', errorData)
            throw new Error(errorData.detail || `API request failed with status ${response.status}`)
          }

          const simulationResults = await response.json() as SimulationResult[]
          console.log('Received simulation results:', simulationResults.length)

          if (!Array.isArray(simulationResults)) {
            console.error('Invalid response format:', simulationResults)
            throw new Error('Invalid response format from API')
          }

          // Filter out failed simulations
          const validResults = simulationResults.filter(result => {
            const isValid = !result.error && result.ledger && result.ledger.length > 0
            if (!isValid) {
              console.warn(`Invalid result for token ${result.token}:`, {
                error: result.error,
                hasLedger: !!result.ledger,
                ledgerLength: result.ledger?.length || 0
              })
            }
            return isValid
          })
          console.log(`Valid results: ${validResults.length}/${simulationResults.length}`)

          // Collect errors for display
          const errors = simulationResults
            .filter(r => r.error)
            .map(r => `${r.token}: ${r.error}`)
          setSimulationErrors(errors)

          if (validResults.length === 0) {
            const errorDetails = errors.join('\n')
            throw new Error(`No valid simulation results returned. Errors:\n${errorDetails}`)
          }

          // Log successful results
          console.log(`Successfully processed ${validResults.length} tokens`)
          validResults.forEach(result => {
            console.log(`Token ${result.token}:`, {
              ledgerEntries: result.ledger?.length || 0,
              realizedProfit: result.realized_profit,
              unrealizedProfit: result.unrealized_profit,
              coinsLeft: result.coins_left,
              tpsHit: result.tps_hit?.length || 0,
              slsHit: result.sls_hit?.length || 0
            })
          })

          // Generate chart data
          generateChartData(simulationResults)

          // Process results
          let portfolioValue = initialCapital
          let isBankrupt = false

          for (let i = 0; i < filteredTrades.length; i++) {
            const trade = filteredTrades[i]
            const simResult = validResults.find((r: SimulationResult) => r.token === trade.ca)

            if (!simResult || !simResult.ledger) {
              console.warn(`Skipping invalid trade: ${trade.ca} - No simulation result or ledger found`)
              continue
            }

            const entryDate = new Date(trade.date_called)
            const positionSize = positionSizing.type === 'percentage'
              ? Math.min((portfolioValue * positionSizing.value) / 100, portfolioValue)
              : Math.min(positionSizing.value, portfolioValue)

            if (positionSize <= 0 || positionSize > portfolioValue) {
              isBankrupt = true
              results.push({
                date: safeFormatDate(entryDate),
                profit: 0,
                cumulativeProfit: 0,
                trade,
                exitPrice: 0,
                exitDate: safeFormatDate(entryDate),
                roi: -100,
                unrealizedGain: 0,
                realizedGain: -portfolioValue,
                remainingPosition: 0,
                takeProfitsHit: simResult.tps_hit || [],
                stopLossesHit: simResult.sls_hit || [],
                positionSize: 0,
                isBankrupt: true,
                finalValue: 0,
                entryPrice: 0
              })
              break
            }

            // Get the last ledger entry for final values
            const lastLedgerEntry = simResult.ledger[simResult.ledger.length - 1]
            const firstLedgerEntry = simResult.ledger[0]
            
            // Calculate returns based on the ledger
            const totalValue = lastLedgerEntry.value + lastLedgerEntry.realized
            const profit = totalValue - positionSize
            portfolioValue = portfolioValue - positionSize + totalValue

            // Calculate entry price from first ledger entry
            const entryPrice = firstLedgerEntry.value / firstLedgerEntry.coins_held

            // Check bankruptcy
            if (portfolioValue <= 0) {
              isBankrupt = true
              portfolioValue = 0
            }

            results.push({
              date: safeFormatDate(entryDate),
              profit,
              cumulativeProfit: portfolioValue,
              trade: {
                ...trade,
                current_mc: totalValue
              },
              exitPrice: lastLedgerEntry.value / (lastLedgerEntry.coins_held || 1), // Approximate exit price
              exitDate: safeFormatDate(new Date(lastLedgerEntry.ts * 1000)),
              roi: positionSize > 0 ? (profit / positionSize) * 100 : 0,
              unrealizedGain: lastLedgerEntry.unrealized,
              realizedGain: lastLedgerEntry.realized,
              remainingPosition: lastLedgerEntry.coins_held || 0,
              takeProfitsHit: simResult.tps_hit || [],
              stopLossesHit: simResult.sls_hit || [],
              positionSize,
              isBankrupt,
              finalValue: totalValue,
              entryPrice
            })
          }

          if (results.length === 0) {
            throw new Error('No valid trades could be processed')
          }

          setBacktestResults(results)

          // Calculate duration
          const duration = Date.now() - startTime
          setBacktestDuration(duration)
          console.log('Backtest completed successfully')

          return
        } catch (error) {
          console.error(`Attempt ${attempt} failed:`, error)
          lastError = error as Error
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000
            console.log(`Waiting ${delay}ms before retry...`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
          throw error
        }
      }
    } catch (error) {
      console.error('Backtest failed:', error)
      setError(error instanceof Error ? error.message : 'An unknown error occurred')
    } finally {
      setIsRunning(false)
    }
  }

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (backtestResults.length === 0) return null

    const validResults = backtestResults.filter(r => isFinite(r.profit))
    if (validResults.length === 0) return null

    const lastResult = backtestResults[backtestResults.length - 1]
    const finalPortfolioValue = lastResult.cumulativeProfit
    const totalProfit = finalPortfolioValue - initialCapital
    const winningTrades = validResults.filter(r => r.profit > 0).length
    const winRate = validResults.length > 0 ? (winningTrades / validResults.length) * 100 : 0
    const avgProfit = validResults.length > 0 ? totalProfit / validResults.length : 0
    const bankruptTrade = backtestResults.findIndex(r => r.isBankrupt)
    const tradesUntilBankruptcy = bankruptTrade === -1 ? backtestResults.length : bankruptTrade + 1

    return {
      totalProfit,
      winRate,
      avgProfit,
      totalTrades: backtestResults.length,
      winningTrades,
      isBankrupt: bankruptTrade !== -1,
      tradesUntilBankruptcy,
      finalPortfolioValue: Math.max(0, finalPortfolioValue) // Ensure non-negative
    }
  }, [backtestResults, initialCapital])

  const addTakeProfit = () => {
    setTakeProfits([...takeProfits, { percentage: 100, sellPercentage: 100 }])
  }

  const removeTakeProfit = (index: number) => {
    if (takeProfits.length > 1) {
      setTakeProfits(takeProfits.filter((_, i) => i !== index))
    }
  }

  const disableTakeProfit = (index: number) => {
    const newTakeProfits = [...takeProfits]
    newTakeProfits[index] = { percentage: 0, sellPercentage: 0 }
    setTakeProfits(newTakeProfits)
  }

  const addStopLoss = () => {
    setStopLosses([...stopLosses, { percentage: -10, sellPercentage: 100 }])
  }

  const removeStopLoss = (index: number) => {
    setStopLosses(stopLosses.filter((_, i) => i !== index))
  }

  const disableStopLoss = (index: number) => {
    const newStopLosses = [...stopLosses]
    newStopLosses[index] = { percentage: 0, sellPercentage: 0 }
    setStopLosses(newStopLosses)
  }

  const updateTakeProfit = (index: number, field: keyof TakeProfitLevel, value: string) => {
    const numValue = parseFloat(value) || 0
    const newTakeProfits = [...takeProfits]
    newTakeProfits[index] = { ...newTakeProfits[index], [field]: numValue }
    setTakeProfits(newTakeProfits)
  }

  const updateStopLoss = (index: number, field: keyof StopLossLevel, value: string) => {
    const numValue = parseFloat(value) || 0
    const newStopLosses = [...stopLosses]
    newStopLosses[index] = { ...newStopLosses[index], [field]: numValue }
    setStopLosses(newStopLosses)
  }

  return (
    <div className="space-y-8">
      {/* API Status Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${
          apiStatus === 'connected' ? 'bg-green-500' :
          apiStatus === 'checking' ? 'bg-yellow-500' :
          'bg-red-500'
        }`} />
        <span>
          {apiStatus === 'connected' ? 'Connected to API server' :
           apiStatus === 'checking' ? 'Checking API server...' :
           'API server disconnected'}
        </span>
        {apiStatus === 'disconnected' && (
          <span className="text-sm text-muted-foreground ml-2">
            Please ensure the FastAPI server is running at {apiUrl}
          </span>
        )}
      </div>

      {/* Feature Description */}
      <Card>
        <CardHeader>
          <CardTitle>Ladder-Based Backtesting</CardTitle>
          <CardDescription>
            Advanced backtesting with dynamic take-profit and stop-loss ladders. Each level can specify both the profit/loss percentage and the fraction of the position to sell.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>• <strong>Take Profit Ladders:</strong> Set multiple profit targets with different sell percentages</p>
            <p>• <strong>Stop Loss Ladders:</strong> Set multiple stop-loss levels with different sell percentages</p>
            <p>• <strong>Position Ledgers:</strong> Track detailed position values over time with realized/unrealized PnL</p>
            <p>• <strong>Value Charts:</strong> Visualize position values and cumulative account performance</p>
            <p>• <strong>Real-time Data:</strong> Uses Birdeye API for accurate price data and current market conditions</p>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy Settings</CardTitle>
          <CardDescription>Configure your backtesting parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Take Profit Levels</Label>
              <Button variant="outline" size="sm" onClick={addTakeProfit}>
                <Plus className="h-4 w-4 mr-2" />
                Add Level
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Set multiple profit targets. Use "Disable" to turn off a level without removing it.
            </p>
            <div className="grid gap-4">
              {takeProfits.map((tp, index) => (
                <div key={index} className={`flex items-center gap-4 p-3 border rounded-lg ${tp.percentage === 0 && tp.sellPercentage === 0 ? 'bg-gray-50 opacity-60' : ''}`}>
                  <div className="flex-1">
                    <Label>Take Profit (%)</Label>
                    <Input
                      type="number"
                      value={tp.percentage}
                      onChange={(e) => updateTakeProfit(index, "percentage", e.target.value)}
                      min={0}
                      max={10000}
                      disabled={tp.percentage === 0 && tp.sellPercentage === 0}
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Sell (%)</Label>
                    <Input
                      type="number"
                      value={tp.sellPercentage}
                      onChange={(e) => updateTakeProfit(index, "sellPercentage", e.target.value)}
                      min={0}
                      max={100}
                      disabled={tp.percentage === 0 && tp.sellPercentage === 0}
                    />
                  </div>
                  <div className="flex gap-2 mt-6">
                    {tp.percentage === 0 && tp.sellPercentage === 0 ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => updateTakeProfit(index, "percentage", "100")}
                      >
                        Enable
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => disableTakeProfit(index)}
                      >
                        Disable
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeTakeProfit(index)} 
                      disabled={takeProfits.length === 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Stop Loss Levels</Label>
              <Button variant="outline" size="sm" onClick={addStopLoss}>
                <Plus className="h-4 w-4 mr-2" />
                Add Level
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Set multiple stop-loss levels. Use "Disable" to turn off a level without removing it.
            </p>
            <div className="grid gap-4">
              {stopLosses.map((sl, index) => (
                <div key={index} className={`flex items-center gap-4 p-3 border rounded-lg ${sl.percentage === 0 && sl.sellPercentage === 0 ? 'bg-gray-50 opacity-60' : ''}`}>
                  <div className="flex-1">
                    <Label>Stop Loss (%)</Label>
                    <Input
                      type="number"
                      value={sl.percentage}
                      onChange={(e) => updateStopLoss(index, "percentage", e.target.value)}
                      min={-99}
                      max={0}
                      disabled={sl.percentage === 0 && sl.sellPercentage === 0}
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Sell (%)</Label>
                    <Input
                      type="number"
                      value={sl.sellPercentage}
                      onChange={(e) => updateStopLoss(index, "sellPercentage", e.target.value)}
                      min={0}
                      max={100}
                      disabled={sl.percentage === 0 && sl.sellPercentage === 0}
                    />
                  </div>
                  <div className="flex gap-2 mt-6">
                    {sl.percentage === 0 && sl.sellPercentage === 0 ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => updateStopLoss(index, "percentage", "-10")}
                      >
                        Enable
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => disableStopLoss(index)}
                      >
                        Disable
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => removeStopLoss(index)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Initial Capital ($)</Label>
            <Input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Math.max(1, parseFloat(e.target.value) || 1))}
              min={1}
              max={1000000}
            />
          </div>

          <div className="space-y-2">
            <Label>Position Sizing</Label>
            <div className="flex items-center gap-4">
              <Select
                value={positionSizing.type}
                onValueChange={(value: 'percentage' | 'fixed') => 
                  setPositionSizing({ ...positionSizing, type: value })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">% of Portfolio</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={positionSizing.value}
                onChange={(e) => 
                  setPositionSizing({ 
                    ...positionSizing, 
                    value: Math.max(0.01, parseFloat(e.target.value) || 0.01) 
                  })
                }
                min={0.01}
                max={positionSizing.type === 'percentage' ? 100 : 1000000}
                placeholder={positionSizing.type === 'percentage' ? 'Portfolio %' : 'Fixed Amount ($)'}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Market Cap Range ($)</Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                value={marketCapRange[0]}
                onChange={(e) => setMarketCapRange([Math.max(0, parseFloat(e.target.value) || 0), marketCapRange[1]])}
                placeholder="Min Market Cap"
              />
              <span>to</span>
              <Input
                type="number"
                value={marketCapRange[1]}
                onChange={(e) => setMarketCapRange([marketCapRange[0], Math.max(marketCapRange[0], parseFloat(e.target.value) || 1e12)])}
                placeholder="Max Market Cap"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Time Range</Label>
            <div className="flex items-center gap-4">
              <Input
                type="date"
                value={timeRange[0].toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value)
                  if (!isNaN(newDate.getTime())) {
                    setTimeRange([newDate, timeRange[1]])
                  }
                }}
                className="w-[180px]"
              />
              <span>to</span>
              <Input
                type="date"
                value={timeRange[1].toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value)
                  if (!isNaN(newDate.getTime())) {
                    setTimeRange([timeRange[0], newDate])
                  }
                }}
                className="w-[180px]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Max Number of Trades</Label>
            <Input
              type="number"
              value={maxTrades}
              onChange={(e) => setMaxTrades(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              placeholder="0 for no limit"
            />
            <p className="text-sm text-muted-foreground">
              Limit the number of trades to analyze (0 for no limit)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Filter by Caller</Label>
            <Select value={selectedCaller} onValueChange={setSelectedCaller}>
              <SelectTrigger>
                <SelectValue placeholder="Select caller" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Callers</SelectItem>
                {callers.map(caller => (
                  <SelectItem key={caller} value={caller}>
                    {caller}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="p-4 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          {simulationErrors.length > 0 && (
            <div className="p-4 text-sm bg-yellow-50 rounded-md">
              <div className="font-medium text-yellow-800 mb-2">
                Simulation Errors ({simulationErrors.length} tokens failed):
              </div>
              <div className="space-y-1">
                {simulationErrors.map((error, index) => (
                  <div key={index} className="text-yellow-700 font-mono text-xs">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              <div>{filteredTrades.length} trades will be analyzed</div>
              {filteredTrades.length > 0 && (
                <div className="text-xs">
                  Time range: {safeFormatDate(new Date(Math.min(...filteredTrades.map(trade => new Date(trade.date_called).getTime()))))} to {safeFormatDate(new Date())}
                </div>
              )}
            </div>
            <Button 
              onClick={runBacktest} 
              disabled={isRunning || filteredTrades.length === 0}
              className="w-32"
            >
              {isRunning ? "Running..." : "Run Backtest"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Individual Position Charts */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Individual Position Values</CardTitle>
            <CardDescription>
              Position equity for each token over time
              {chartData.length > 0 && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Time range: {formatChartDate(chartData[0].timestamp)} to {formatChartDate(chartData[chartData.length - 1].timestamp)}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis 
                    dataKey="date" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    stroke="#374151"
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    tickFormatter={(value) => `$${formatLargeNumber(value)}`}
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    stroke="#374151"
                    width={80}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${formatLargeNumber(value)}`, 'Position Value']}
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#F3F4F6'
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    wrapperStyle={{ color: '#9CA3AF' }}
                  />
                  {Object.keys(chartData[0] || {}).filter(key => key !== 'timestamp' && key !== 'date').map((token, index) => (
                    <Line
                      key={token}
                      type="monotone"
                      dataKey={token}
                      stroke={`hsl(${index * 137.5 % 360}, 70%, 50%)`}
                      name={token.slice(0, 6) + '...' + token.slice(-4)}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cumulative Chart */}
      {cumulativeChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cumulative Account Value</CardTitle>
            <CardDescription>
              Total portfolio value across all positions
              {cumulativeChartData.length > 0 && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Time range: {formatChartDate(cumulativeChartData[0].timestamp)} to {formatChartDate(cumulativeChartData[cumulativeChartData.length - 1].timestamp)}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeChartData}>
                  <defs>
                    <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis 
                    dataKey="date" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    stroke="#374151"
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    tickFormatter={(value) => `$${formatLargeNumber(value)}`}
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    stroke="#374151"
                    width={80}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${formatLargeNumber(value)}`, 'Cumulative Value']}
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#F3F4F6'
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    wrapperStyle={{ color: '#9CA3AF' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#3b82f6"
                    name="Cumulative Portfolio Value"
                    dot={false}
                    strokeWidth={3}
                    fill="url(#colorCumulative)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      {summaryStats && (
        <Card>
          <CardHeader>
            <CardTitle>Results Summary</CardTitle>
            <CardDescription>Performance metrics for the selected strategy</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Time Range Info */}
            {chartData.length > 0 && (
              <div className="mb-6 p-4 bg-muted rounded-lg">
                <div className="text-sm font-medium text-muted-foreground mb-2">Simulation Time Range</div>
                <div className="text-sm">
                  <div>From: {formatChartDate(chartData[0].timestamp)}</div>
                  <div>To: {formatChartDate(chartData[chartData.length - 1].timestamp)}</div>
                  <div>Duration: {Math.round((chartData[chartData.length - 1].timestamp - chartData[0].timestamp) / 3600)} hours</div>
                </div>
              </div>
            )}
            
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Total Profit</div>
                <div className={`text-2xl font-bold ${summaryStats.isBankrupt ? "text-red-500" : summaryStats.totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {summaryStats.isBankrupt ? "BANKRUPT" : `$${formatLargeNumber(summaryStats.totalProfit)}`}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Win Rate</div>
                <div className="text-2xl font-bold">
                  {summaryStats.winRate.toFixed(1)}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Avg Profit/Trade</div>
                <div className={`text-2xl font-bold ${summaryStats.avgProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  ${formatLargeNumber(summaryStats.avgProfit)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Trades Until Bankruptcy</div>
                <div className="text-2xl font-bold">
                  {summaryStats.tradesUntilBankruptcy}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Final Portfolio</div>
                <div className={`text-2xl font-bold ${summaryStats.finalPortfolioValue >= initialCapital ? "text-green-500" : "text-red-500"}`}>
                  ${formatLargeNumber(summaryStats.finalPortfolioValue)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trade Results Table */}
      {backtestResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trade Results</CardTitle>
            <CardDescription>Detailed results for each trade</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Token</TableHead>
                    <TableHead className="whitespace-nowrap">Caller</TableHead>
                    <TableHead className="whitespace-nowrap">Position Size</TableHead>
                    <TableHead className="whitespace-nowrap">Entry Price</TableHead>
                    <TableHead className="whitespace-nowrap">Final Value</TableHead>
                    <TableHead className="whitespace-nowrap">ROI</TableHead>
                    <TableHead className="whitespace-nowrap">Realized</TableHead>
                    <TableHead className="whitespace-nowrap">Unrealized</TableHead>
                    <TableHead className="whitespace-nowrap">Coins Left</TableHead>
                    <TableHead className="whitespace-nowrap">TPs Hit</TableHead>
                    <TableHead className="whitespace-nowrap">SLs Hit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backtestResults.map((result, index) => (
                    <TableRow key={index} className={result.isBankrupt ? "opacity-50" : ""}>
                      <TableCell className="whitespace-nowrap">{result.date}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <a 
                          href={`/token-analysis/${result.trade.ca}`}
                          className="text-blue-500 hover:underline font-mono text-xs"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {result.trade.ca.slice(0, 6)}...{result.trade.ca.slice(-4)}
                        </a>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{result.trade.caller}</TableCell>
                      <TableCell className="whitespace-nowrap">${formatLargeNumber(result.positionSize)}</TableCell>
                      <TableCell className="whitespace-nowrap">${result.entryPrice.toFixed(6)}</TableCell>
                      <TableCell className="whitespace-nowrap">${formatLargeNumber(result.finalValue)}</TableCell>
                      <TableCell className={`whitespace-nowrap font-medium ${result.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {result.roi.toFixed(2)}%
                      </TableCell>
                      <TableCell className={`whitespace-nowrap ${result.realizedGain >= 0 ? "text-green-500" : "text-red-500"}`}>
                        ${formatLargeNumber(result.realizedGain)}
                      </TableCell>
                      <TableCell className={`whitespace-nowrap ${result.unrealizedGain >= 0 ? "text-green-500" : "text-red-500"}`}>
                        ${formatLargeNumber(result.unrealizedGain)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{result.remainingPosition.toFixed(6)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {result.takeProfitsHit.length > 0 
                          ? result.takeProfitsHit.map(tp => `${tp.toFixed(2)}`).join(", ")
                          : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {result.stopLossesHit.length > 0 
                          ? result.stopLossesHit.map(sl => `${sl.toFixed(2)}`).join(", ")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
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
import { Plus, Minus } from "lucide-react"
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
}

interface SimulationResult {
  token: string
  entry_price: number
  final_usd: number
  roi_percent: number
  tps_hit: number[]
  sls_hit: number[]
  error?: string
}

interface BacktestClientPageProps {
  initialTrades: Trade[]
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
  const [backtestDuration, setBacktestDuration] = useState<number | null>(null)
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [apiUrl] = useState(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')

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

  const runBacktest = async () => {
    console.log('Starting backtest...')
    if (apiStatus !== 'connected') {
      console.log('API not connected, current status:', apiStatus)
      setError('API server is not connected. Please ensure the FastAPI server is running.')
      return
    }

    setIsRunning(true)
    setError(null)
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

      // Call FastAPI simulate endpoint with timeout and retries
      const maxRetries = 3
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Attempt ${attempt} of ${maxRetries}`)
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

          console.log('Sending request to:', `${apiUrl}/api/simulate`)
          const response = await fetch(`${apiUrl}/api/simulate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tokens,
              amount_usd: initialCapital,
              take_profits: takeProfits,
              stop_losses: stopLosses,
              timeframe_minutes: 5
            }),
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

          // Log each result to see what's happening
          simulationResults.forEach((result, index) => {
            console.log(`Result ${index + 1}:`, {
              token: result.token,
              hasError: !!result.error,
              error: result.error,
              hasEntryPrice: !!result.entry_price,
              hasFinalUsd: !!result.final_usd,
              hasRoi: !!result.roi_percent
            })
          })

          // Filter out failed simulations
          const validResults = simulationResults.filter(result => {
            const isValid = !result.error && 
                          result.entry_price !== undefined && 
                          result.final_usd !== undefined && 
                          result.roi_percent !== undefined
            if (!isValid) {
              console.warn(`Invalid result for token ${result.token}:`, {
                error: result.error,
                entry_price: result.entry_price,
                final_usd: result.final_usd,
                roi_percent: result.roi_percent
              })
            }
            return isValid
          })
          console.log(`Valid results: ${validResults.length}/${simulationResults.length}`)

          if (validResults.length === 0) {
            const errorDetails = simulationResults
              .filter(r => r.error)
              .map(r => `${r.token}: ${r.error}`)
              .join('\n')
            throw new Error(`No valid simulation results returned. Errors:\n${errorDetails}`)
          }

          // Process results
          let portfolioValue = initialCapital
          let isBankrupt = false

          for (let i = 0; i < filteredTrades.length; i++) {
            const trade = filteredTrades[i]
            const simResult = validResults.find((r: SimulationResult) => r.token === trade.ca)

            if (!simResult) {
              console.warn(`Skipping invalid trade: ${trade.ca} - No simulation result found`)
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
                exitPrice: simResult.entry_price || 0,
                exitDate: safeFormatDate(entryDate),
                roi: -100,
                unrealizedGain: 0,
                realizedGain: -portfolioValue,
                remainingPosition: 0,
                takeProfitsHit: [],
                stopLossesHit: [],
                positionSize: 0,
                isBankrupt: true
              })
              break
            }

            // Calculate returns
            const profit = (simResult.final_usd || 0) - positionSize
            portfolioValue = portfolioValue - positionSize + (simResult.final_usd || 0)

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
                current_mc: simResult.final_usd || 0
              },
              exitPrice: simResult.entry_price || 0,
              exitDate: safeFormatDate(entryDate),
              roi: simResult.roi_percent || 0,
              unrealizedGain: profit,
              realizedGain: profit,
              remainingPosition: 0,
              takeProfitsHit: simResult.tps_hit || [],
              stopLossesHit: simResult.sls_hit || [],
              positionSize,
              isBankrupt
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
      finalPortfolioValue
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

  const addStopLoss = () => {
    setStopLosses([...stopLosses, { percentage: -10, sellPercentage: 100 }])
  }

  const removeStopLoss = (index: number) => {
    setStopLosses(stopLosses.filter((_, i) => i !== index))
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
            <div className="grid gap-4">
              {takeProfits.map((tp, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>Take Profit (%)</Label>
                    <Input
                      type="number"
                      value={tp.percentage}
                      onChange={(e) => updateTakeProfit(index, "percentage", e.target.value)}
                      min={10}
                      max={10000}
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Sell (%)</Label>
                    <Input
                      type="number"
                      value={tp.sellPercentage}
                      onChange={(e) => updateTakeProfit(index, "sellPercentage", e.target.value)}
                      min={1}
                      max={100}
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeTakeProfit(index)} 
                    className="mt-6"
                    disabled={takeProfits.length === 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
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
            <div className="grid gap-4">
              {stopLosses.map((sl, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>Stop Loss (%)</Label>
                    <Input
                      type="number"
                      value={sl.percentage}
                      onChange={(e) => updateStopLoss(index, "percentage", e.target.value)}
                      min={-99}
                      max={0}
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Sell (%)</Label>
                    <Input
                      type="number"
                      value={sl.sellPercentage}
                      onChange={(e) => updateStopLoss(index, "sellPercentage", e.target.value)}
                      min={1}
                      max={100}
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeStopLoss(index)} className="mt-6">
                    <Minus className="h-4 w-4" />
                  </Button>
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

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {filteredTrades.length} trades will be analyzed
            </p>
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

      {/* Results Summary */}
      {summaryStats && (
        <Card>
          <CardHeader>
            <CardTitle>Results Summary</CardTitle>
            <CardDescription>Performance metrics for the selected strategy</CardDescription>
          </CardHeader>
          <CardContent>
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

      {/* Profit Chart */}
      {backtestResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Value Over Time</CardTitle>
            <CardDescription>Portfolio value following the selected strategy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={backtestResults}>
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
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: '2-digit'
                      })
                    }}
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    tickFormatter={(value) => `$${formatLargeNumber(value)}`}
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    stroke="#374151"
                    width={80}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${formatLargeNumber(value)}`, 'Portfolio Value']}
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#F3F4F6'
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                    labelFormatter={(label) => {
                      const date = new Date(label)
                      return date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    wrapperStyle={{ color: '#9CA3AF' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeProfit"
                    stroke="#22c55e"
                    name="Portfolio Value"
                    dot={false}
                    strokeWidth={2}
                    fill="url(#colorPortfolio)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-sm text-muted-foreground text-center">
              Backtested {backtestResults.length} trades in {backtestDuration?.toFixed(2) || "N/A"} seconds
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
                    <TableHead className="whitespace-nowrap">Entry MC</TableHead>
                    <TableHead className="whitespace-nowrap">Current MC</TableHead>
                    <TableHead className="whitespace-nowrap">ROI</TableHead>
                    <TableHead className="whitespace-nowrap">Realized</TableHead>
                    <TableHead className="whitespace-nowrap">Unrealized</TableHead>
                    <TableHead className="whitespace-nowrap">Remaining</TableHead>
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
                      <TableCell className="whitespace-nowrap">${formatLargeNumber(result.trade.initial_mc)}</TableCell>
                      <TableCell className="whitespace-nowrap">${formatLargeNumber(result.trade.current_mc)}</TableCell>
                      <TableCell className={`whitespace-nowrap font-medium ${result.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {result.roi.toFixed(2)}%
                      </TableCell>
                      <TableCell className={`whitespace-nowrap ${result.realizedGain >= 0 ? "text-green-500" : "text-red-500"}`}>
                        ${formatLargeNumber(result.realizedGain)}
                      </TableCell>
                      <TableCell className={`whitespace-nowrap ${result.unrealizedGain >= 0 ? "text-green-500" : "text-red-500"}`}>
                        ${formatLargeNumber(result.unrealizedGain)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{result.remainingPosition.toFixed(1)}%</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {result.takeProfitsHit.length > 0 
                          ? result.takeProfitsHit.map(tp => `${tp}%`).join(", ")
                          : "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {result.stopLossesHit.length > 0 
                          ? result.stopLossesHit.map(sl => `${sl}%`).join(", ")
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
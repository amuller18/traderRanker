// Full corrected and realistic BacktestClientPage
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import type { Trade } from "@/lib/trader-data"
import { Button } from "@/components/ui/button"
import { Plus, Minus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { getTokenInfo, getTokenSupply } from "@/lib/token-api"

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

interface BacktestClientPageProps {
  initialTrades: Trade[]
}

function formatLargeNumber(num: number): string {
  const absNum = Math.abs(num)
  if (absNum >= 1e12) return (num / 1e12).toPrecision(5) + ' T'
  if (absNum >= 1e9) return (num / 1e9).toPrecision(5) + ' B'
  if (absNum >= 1e6) return (num / 1e6).toPrecision(5) + ' M'
  if (absNum >= 1e3) return (num / 1e3).toPrecision(5) + ' K'
  return num.toPrecision(5)
}

export function BacktestClientPage({ initialTrades }: BacktestClientPageProps) {
  const [takeProfits, setTakeProfits] = useState<TakeProfitLevel[]>([{ percentage: 100, sellPercentage: 100 }])
  const [stopLosses, setStopLosses] = useState<StopLossLevel[]>([])
  const [selectedCaller, setSelectedCaller] = useState<string>("all")
  const [initialCapital, setInitialCapital] = useState(1000)
  const [positionSizing, setPositionSizing] = useState<PositionSizing>({ type: 'percentage', value: 10 })
  const [marketCapRange, setMarketCapRange] = useState<[number, number]>([0, 1e12])
  const [timeRange, setTimeRange] = useState<[Date, Date]>([new Date(2023, 0, 1), new Date()])
  const [isRunning, setIsRunning] = useState(false)
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([])

  const callers = useMemo(() => {
    const uniqueCallers = new Set(initialTrades.map(trade => trade.caller))
    return Array.from(uniqueCallers)
  }, [initialTrades])

  const filteredTrades = useMemo(() => {
    let filtered = initialTrades
    if (selectedCaller !== "all") {
      filtered = filtered.filter(trade => trade.caller === selectedCaller)
    }
    filtered = filtered.filter(trade => {
      const tradeDate = new Date(trade.date_called)
      const mc = trade.initial_mc ?? 0
      return (
        tradeDate >= timeRange[0] && 
        tradeDate <= timeRange[1] &&
        mc >= marketCapRange[0] &&
        mc <= marketCapRange[1] &&
        mc > 0
      )
    })
    return filtered.sort((a, b) => new Date(a.date_called).getTime() - new Date(b.date_called).getTime())
  }, [initialTrades, selectedCaller, timeRange, marketCapRange])

  const runBacktest = async () => {
    setIsRunning(true)
    const results: BacktestResult[] = []
    let portfolioValue = initialCapital
    let isBankrupt = false

    for (const trade of filteredTrades) {
      if (isBankrupt) return

      const entryDate = new Date(trade.date_called)
      const athDate = new Date(trade.high_time)
      const atlDate = new Date(trade.low_time)
      const isValidEntryDate = !isNaN(entryDate.getTime())
      const isValidAthDate = !isNaN(athDate.getTime())
      const isValidAtlDate = !isNaN(atlDate.getTime())

      try {
        // Fetch token information
        const tokenInfo = await getTokenInfo(trade.ca)
        if (!tokenInfo || tokenInfo.length === 0) {
          console.warn(`No token info found for ${trade.ca}`)
          continue
        }

        const supply = await getTokenSupply(trade.ca)
        if (!supply) {
          console.warn(`No supply found for ${trade.ca}`)
          continue
        }

        const currentPrice = parseFloat(tokenInfo[0].priceUsd)
        const currentMc = currentPrice * supply

        // Calculate high and low market caps using token info
        const highMc = (trade.high_price ?? currentPrice) * supply
        const lowMc = (trade.low_price ?? currentPrice) * supply

        const positionSize = positionSizing.type === 'percentage'
          ? (portfolioValue * positionSizing.value) / 100
          : positionSizing.value

        if (positionSize > portfolioValue) {
          isBankrupt = true
          results.push({
            date: isValidEntryDate ? format(entryDate, "yyyy-MM-dd") : "Invalid Date",
            profit: 0,
            cumulativeProfit: portfolioValue,
            trade,
            exitPrice: currentMc,
            exitDate: isValidAthDate ? format(athDate, "yyyy-MM-dd") : "Invalid Date",
            roi: 0,
            unrealizedGain: 0,
            realizedGain: 0,
            remainingPosition: 0,
            takeProfitsHit: [],
            stopLossesHit: [],
            positionSize: 0,
            isBankrupt: true
          })
          continue
        }

        let remainingPosition = 100
        let realizedGain = 0
        let takeProfitsHit: number[] = []
        let stopLossesHit: number[] = []

        const sortedTakeProfits = [...takeProfits].sort((a, b) => a.percentage - b.percentage)
        const sortedStopLosses = [...stopLosses].sort((a, b) => b.percentage - a.percentage)

        // Check take profits
        for (const tp of sortedTakeProfits) {
          const targetMc = trade.initial_mc * (1 + tp.percentage / 100)
          if (highMc >= targetMc && remainingPosition > 0) {
            const positionToSell = Math.min(remainingPosition, tp.sellPercentage)
            const profit = (targetMc / trade.initial_mc - 1) * (positionToSell / 100) * positionSize
            realizedGain += profit
            remainingPosition -= positionToSell
            takeProfitsHit.push(tp.percentage)
          }
        }

        // Check stop losses
        for (const sl of sortedStopLosses) {
          const targetMc = trade.initial_mc * (1 - sl.percentage / 100)
          if (lowMc <= targetMc && remainingPosition > 0) {
            const positionToSell = Math.min(remainingPosition, sl.sellPercentage)
            const loss = (targetMc / trade.initial_mc - 1) * (positionToSell / 100) * positionSize
            realizedGain += loss
            remainingPosition -= positionToSell
            stopLossesHit.push(sl.percentage)
          }
        }

        const unrealizedGain = (currentMc / trade.initial_mc - 1) * (remainingPosition / 100) * positionSize

        portfolioValue += realizedGain

        if (portfolioValue <= 0) isBankrupt = true

        const totalGain = realizedGain + unrealizedGain
        const roi = (totalGain / positionSize) * 100

        results.push({
          date: isValidEntryDate ? format(entryDate, "yyyy-MM-dd") : "Invalid Date",
          profit: totalGain,
          cumulativeProfit: portfolioValue,
          trade,
          exitPrice: currentMc,
          exitDate: isValidAthDate ? format(athDate, "yyyy-MM-dd") : "Invalid Date",
          roi,
          unrealizedGain,
          realizedGain,
          remainingPosition,
          takeProfitsHit,
          stopLossesHit,
          positionSize,
          isBankrupt
        })
      } catch (error) {
        console.error(`Error processing trade for ${trade.ca}:`, error)
        continue
      }
    }

    setBacktestResults(results)
    setIsRunning(false)
  }
  

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (backtestResults.length === 0) return null

    const finalPortfolioValue = backtestResults[backtestResults.length - 1].cumulativeProfit
    const totalProfit = finalPortfolioValue - initialCapital
    const winningTrades = backtestResults.filter(r => r.profit > 0).length
    const winRate = (winningTrades / backtestResults.length) * 100
    const avgProfit = totalProfit / backtestResults.length
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
    setTakeProfits(takeProfits.filter((_, i) => i !== index))
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
                      max={500}
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Sell (%)</Label>
                    <Input
                      type="number"
                      value={tp.sellPercentage}
                      onChange={(e) => updateTakeProfit(index, "sellPercentage", e.target.value)}
                      min={10}
                      max={100}
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeTakeProfit(index)} className="mt-6">
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
                      min={-50}
                      max={0}
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Sell (%)</Label>
                    <Input
                      type="number"
                      value={sl.sellPercentage}
                      onChange={(e) => updateStopLoss(index, "sellPercentage", e.target.value)}
                      min={10}
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
              onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 0)}
              min={100}
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
                <SelectTrigger className="w-[120px]">
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
                  setPositionSizing({ ...positionSizing, value: parseFloat(e.target.value) || 0 })
                }
                min={1}
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
                onChange={(e) => setMarketCapRange([parseFloat(e.target.value) || 0, marketCapRange[1]])}
                placeholder="Min Market Cap"
                className="w-32"
              />
              <span>to</span>
              <Input
                type="number"
                value={marketCapRange[1]}
                onChange={(e) => setMarketCapRange([marketCapRange[0], parseFloat(e.target.value) || 1e12])}
                placeholder="Max Market Cap"
                className="w-32"
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
                  setTimeRange([newDate, timeRange[1]])
                }}
                className="w-[180px]"
              />
              <span>to</span>
              <Input
                type="date"
                value={timeRange[1].toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value)
                  setTimeRange([timeRange[0], newDate])
                }}
                className="w-[180px]"
              />
            </div>
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

          <div className="flex justify-end">
            <Button 
              onClick={runBacktest} 
              disabled={isRunning}
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
              <div className="space-y-1 w-[180px]">
                <div className="text-sm font-medium text-muted-foreground">Total Profit</div>
                <div className={`text-2xl font-bold ${summaryStats.isBankrupt ? "text-red-500" : summaryStats.totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {summaryStats.isBankrupt ? "BANKRUPT" : `$${formatLargeNumber(summaryStats.totalProfit)}`}
                </div>
              </div>
              <div className="space-y-1 w-[120px]">
                <div className="text-sm font-medium text-muted-foreground">Win Rate</div>
                <div className="text-2xl font-bold">
                  {summaryStats.winRate.toFixed(1)}%
                </div>
              </div>
              <div className="space-y-1 w-[180px]">
                <div className="text-sm font-medium text-muted-foreground">Avg Profit per Trade</div>
                <div className={`text-2xl font-bold ${summaryStats.isBankrupt ? "text-red-500" : summaryStats.avgProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {summaryStats.isBankrupt ? "BANKRUPT" : `$${formatLargeNumber(summaryStats.avgProfit)}`}
                </div>
              </div>
              <div className="space-y-1 w-[120px]">
                <div className="text-sm font-medium text-muted-foreground">Trades Until Bankruptcy</div>
                <div className="text-2xl font-bold">
                  {summaryStats.tradesUntilBankruptcy}
                </div>
              </div>
              <div className="space-y-1 w-[180px]">
                <div className="text-sm font-medium text-muted-foreground">Final Portfolio Value</div>
                <div className={`text-2xl font-bold ${summaryStats.isBankrupt ? "text-red-500" : summaryStats.finalPortfolioValue >= initialCapital ? "text-green-500" : "text-red-500"}`}>
                  {summaryStats.isBankrupt ? "BANKRUPT" : `$${formatLargeNumber(summaryStats.finalPortfolioValue)}`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profit Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Value Over Time</CardTitle>
          <CardDescription>Portfolio value following the selected strategy</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={backtestResults}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={['auto', 'auto']} />
                <Tooltip 
                  formatter={(value: number) => [`$${formatLargeNumber(value)}`, 'Portfolio Value']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cumulativeProfit"
                  stroke="#22c55e"
                  name="Portfolio Value ($)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Trade Results Table */}
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
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead className="w-[200px]">Token</TableHead>
                  <TableHead className="w-[150px]">Position Size</TableHead>
                  <TableHead className="w-[200px]">Entry Market Cap</TableHead>
                  <TableHead className="w-[200px]">Current Market Cap</TableHead>
                  <TableHead className="w-[120px]">ROI</TableHead>
                  <TableHead className="w-[150px]">Realized Gain</TableHead>
                  <TableHead className="w-[150px]">Unrealized Gain</TableHead>
                  <TableHead className="w-[150px]">Remaining Position</TableHead>
                  <TableHead className="w-[150px]">TPs Hit</TableHead>
                  <TableHead className="w-[150px]">SLs Hit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backtestResults.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell className="whitespace-nowrap">{result.date}</TableCell>
                    <TableCell>
                      <a 
                        href={`/token-analysis/${result.trade.ca}`}
                        className="text-blue-500 hover:underline"
                      >
                        {result.trade.ca}
                      </a>
                    </TableCell>
                    <TableCell>${formatLargeNumber(result.positionSize)}</TableCell>
                    <TableCell>${formatLargeNumber(result.trade.initial_mc)}</TableCell>
                    <TableCell>${formatLargeNumber(result.trade.current_mc)}</TableCell>
                    <TableCell className={result.roi >= 0 ? "text-green-500" : "text-red-500"}>
                      {result.roi.toFixed(2)}%
                    </TableCell>
                    <TableCell className={result.realizedGain >= 0 ? "text-green-500" : "text-red-500"}>
                      ${formatLargeNumber(result.realizedGain)}
                    </TableCell>
                    <TableCell className={result.unrealizedGain >= 0 ? "text-green-500" : "text-red-500"}>
                      ${formatLargeNumber(result.unrealizedGain)}
                    </TableCell>
                    <TableCell>{result.remainingPosition.toFixed(1)}%</TableCell>
                    <TableCell>
                      {result.takeProfitsHit.length > 0 
                        ? result.takeProfitsHit.map(tp => `${tp}%`).join(", ")
                        : "None"}
                    </TableCell>
                    <TableCell>
                      {result.stopLossesHit.length > 0 
                        ? result.stopLossesHit.map(sl => `${sl}%`).join(", ")
                        : "None"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
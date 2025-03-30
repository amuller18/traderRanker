"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

interface TransactionChartProps {
  data?: Record<string, { buys: number; sells: number; volume?: number }>
  tokenSymbol: string
}

export function TransactionChart({ data, tokenSymbol }: TransactionChartProps) {
  const [activeTab, setActiveTab] = useState<string>("h24")

  // Make sure data exists before trying to filter
  const timeframes = data
    ? [
        { id: "m5", label: "5m" },
        { id: "h1", label: "1h" },
        { id: "h6", label: "6h" },
        { id: "h12", label: "12h" },
        { id: "h24", label: "24h" },
      ].filter((tf) => data[tf.id])
    : []

  // Default to h24 if available, otherwise use the first available timeframe
  const defaultTimeframe = timeframes.find((tf) => tf.id === "h24") || timeframes[0]

  // Make sure we have a valid activeTab
  const safeActiveTab = timeframes.find((tf) => tf.id === activeTab) ? activeTab : defaultTimeframe?.id || "h24"

  // Safely get the current data with fallbacks
  const currentData = data && data[safeActiveTab] ? data[safeActiveTab] : { buys: 0, sells: 0, volume: 0 }

  const totalTransactions = currentData.buys + currentData.sells

  const chartData = [
    { name: "Buys", value: currentData.buys, color: "#10b981" },
    { name: "Sells", value: currentData.sells, color: "#ef4444" },
  ]

  return (
    <div className="space-y-4">
      <Tabs
        defaultValue={defaultTimeframe?.id || "h24"}
        value={safeActiveTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-5">
          {timeframes.map((tf) => (
            <TabsTrigger key={tf.id} value={tf.id}>
              {tf.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={safeActiveTab} className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Transaction Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Transactions</span>
                  <span className="font-medium">{totalTransactions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buy Transactions</span>
                  <span className="font-medium text-green-500">{currentData.buys}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sell Transactions</span>
                  <span className="font-medium text-red-500">{currentData.sells}</span>
                </div>
                {currentData.volume !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Volume</span>
                    <span className="font-medium">${currentData.volume.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buy/Sell Ratio</span>
                  <span className="font-medium">
                    {currentData.sells > 0
                      ? (currentData.buys / currentData.sells).toFixed(2)
                      : currentData.buys > 0
                        ? "∞"
                        : "0"}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-[200px]">
              {totalTransactions > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">No transaction data available</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}


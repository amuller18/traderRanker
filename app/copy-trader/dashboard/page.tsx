'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AccountValueChart } from './components/AccountValueChart';
import { TopStrategies } from './components/TopStrategies';
import { RecentTrades } from './components/RecentTrades';
import { RecentWins } from './components/RecentWins';
import { EnhancedDeployStrategyForm } from './components/EnhancedDeployStrategyForm';
import { TabType } from './types';
import { Rocket, LayoutDashboard } from 'lucide-react';

export default function CopyTradingDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Copy Trading Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your performance and deploy new strategies
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="deploy" className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Deploy Strategy
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Account Value Chart */}
          <AccountValueChart />

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Larger */}
            <div className="lg:col-span-2 space-y-6">
              <TopStrategies />
              <RecentTrades />
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              <RecentWins />

              {/* Deploy Strategy CTA */}
              <div className="sticky top-6">
                <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Ready to deploy?</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure and deploy a new copy trading strategy
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => setActiveTab('deploy')}
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    Deploy Strategy
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Deploy Strategy Tab */}
        <TabsContent value="deploy" className="space-y-6">
          <div className="max-w-3xl mx-auto">
            <EnhancedDeployStrategyForm />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

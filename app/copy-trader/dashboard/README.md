# Copy Trading Dashboard MVP

A clean, modern frontend-only copy trading dashboard built with React, TypeScript, and TailwindCSS.

## Tech Stack

- **React 19** with TypeScript
- **Next.js 15** App Router
- **TailwindCSS** for styling
- **Zustand** for state management
- **Recharts** for data visualization
- **shadcn/ui** component library
- **Sonner** for toast notifications

## Project Structure

```
app/copy-trader/dashboard/
├── components/           # React components
│   ├── AccountValueChart.tsx      # Line chart showing account value over time
│   ├── TopStrategies.tsx          # Table of top performing strategies
│   ├── RecentTrades.tsx           # Table of recent trades with PnL
│   ├── RecentWins.tsx             # Highlight panel for recent wins
│   └── DeployStrategyForm.tsx     # Form for deploying new strategies
├── data/                # Mock data
│   └── mock.ts          # All mock data and placeholder lists
├── store/               # Zustand state management
│   └── deployStrategyStore.ts     # State for Deploy Strategy form
├── types/               # TypeScript definitions
│   └── index.ts         # All type definitions
├── page.tsx            # Main dashboard page with tab navigation
└── README.md           # This file
```

## Core Features

### 1. Dashboard Tab

- **Account Value Chart**: Visualizes account performance over time using Recharts
- **Top Performing Strategies**: Displays strategies with win rate, ROI, and trade count
- **Recent Trades**: Shows all trades with entry/exit prices and PnL highlighting
- **Recent Wins**: Highlights the last 3 profitable trades
- **Deploy Strategy CTA**: Quick access button to deploy new strategies

### 2. Deploy Strategy Tab

- **Trader Selection**: Dropdown to select which trader to copy
- **Profit Strategy Dropdown**: Choose between Default or Custom strategies
  - **Default Strategy**: Pre-configured TP +100% / SL -90%
  - **Custom Strategy**: Dynamic table for custom TP/SL levels
- **Dynamic TP/SL Rows**: Add/remove unlimited take profit and stop loss conditions
- **Deploy Button**: Logs configuration and shows success toast (backend integration pending)

## State Management

Uses Zustand for clean, simple state management:

```typescript
// app/copy-trader/dashboard/store/deployStrategyStore.ts
const useDeployStrategyStore = create((set) => ({
  callerInput: '',
  profitStrategy: 'default',
  tpslRows: [...],
  // Actions: setCallerInput, setProfitStrategy, addTPSLRow, removeTPSLRow, updateTPSLRow
}));
```

## Mock Data

All data is currently mocked in `data/mock.ts`:

- `mockAccountData`: Account value time series
- `mockStrategies`: Top performing strategies
- `mockTrades`: Recent trades history
- `mockCallerOptions`: Available traders to copy

## Backend Integration Points

The following locations need backend integration (marked with `// TODO connect backend later`):

### 1. AccountValueChart Component
```typescript
useEffect(() => {
  // TODO fetch user account data later
  setData(mockAccountData);
}, []);
```

### 2. TopStrategies Component
```typescript
useEffect(() => {
  // TODO fetch top performing strategies later
  setStrategies(mockStrategies);
}, []);
```

### 3. RecentTrades Component
```typescript
useEffect(() => {
  // TODO fetch recent trades later
  setTrades(mockTrades);
}, []);
```

### 4. RecentWins Component
```typescript
useEffect(() => {
  // TODO fetch recent wins later
  setWins(getRecentWins());
}, []);
```

### 5. DeployStrategyForm Component
```typescript
const handleDeploy = async () => {
  // TODO connect backend later
  const config = {
    callerInput,
    profitStrategy,
    tpslRows: profitStrategy === 'custom' ? tpslRows : tpslRows.slice(0, 2),
  };

  console.log('Deploy Strategy Config:', config);
  // Add API call here: await deployStrategy(config);
};
```

## Component Responsibilities

### AccountValueChart
- Fetches and displays account value over time
- Calculates and displays total return percentage
- Uses Recharts LineChart for visualization
- Formats currency and dates

### TopStrategies
- Displays top performing copy trading strategies
- Shows win rate, ROI, and trade count
- Uses Table component for clean layout

### RecentTrades
- Lists recent trades with full details
- Highlights positive PnL in green, negative in red
- Shows token symbols and truncated addresses
- Displays trade status (open/closed)

### RecentWins
- Highlights recent profitable trades
- Shows PnL amount and percentage
- Uses special styling with green accent

### DeployStrategyForm
- Manages trader selection
- Handles profit strategy configuration
- Supports dynamic TP/SL row management
- Validates inputs before deployment
- Shows toast notifications on deploy

## Extending the Dashboard

### Adding a New Panel to Dashboard Tab

1. Create a new component in `components/`:
```typescript
// components/NewPanel.tsx
export function NewPanel() {
  const [data, setData] = useState([]);

  useEffect(() => {
    // TODO fetch data later
    setData(mockData);
  }, []);

  return <Card>...</Card>;
}
```

2. Import and add to dashboard layout in `page.tsx`:
```typescript
import { NewPanel } from './components/NewPanel';

// In the Dashboard TabsContent:
<NewPanel />
```

### Adding a New Form Field

1. Add the field to Zustand store:
```typescript
// store/deployStrategyStore.ts
interface DeployStrategyState {
  newField: string;
  setNewField: (value: string) => void;
}
```

2. Use in form component:
```typescript
const { newField, setNewField } = useDeployStrategyStore();

<Input value={newField} onChange={(e) => setNewField(e.target.value)} />
```

### Adding a New Tab

1. Update `types/index.ts`:
```typescript
export type TabType = 'dashboard' | 'deploy' | 'new-tab';
```

2. Add TabsTrigger and TabsContent in `page.tsx`:
```typescript
<TabsTrigger value="new-tab">New Tab</TabsTrigger>

<TabsContent value="new-tab">
  <NewTabContent />
</TabsContent>
```

## Styling Guidelines

Following modern design principles inspired by Phantom Wallet, Vercel Dashboard, and Notion:

- **Clean Spacing**: Uses Tailwind spacing scale consistently
- **Subtle Borders**: Light borders with `border` class
- **Clear Hierarchy**: Typography scale from text-xs to text-3xl
- **Card-based Layout**: All panels use Card component
- **Color Coding**: Green for positive, red for negative, blue for neutral
- **Minimal Clutter**: Clean white space, no unnecessary decoration

## Running Locally

```bash
npm install
npm run dev
```

Navigate to: `http://localhost:3000/copy-trader/dashboard`

## Build for Production

```bash
npm run build
npm start
```

## TypeScript Types

All types are defined in `types/index.ts`:

- `AccountDataPoint`: Time series data point
- `Strategy`: Trading strategy with metrics
- `Trade`: Individual trade record
- `TPSLRow`: Take profit / stop loss row
- `DeployStrategyConfig`: Configuration for deployment
- `TabType`: Available tab types

## Notes

- No business logic is hardwired - all logic will be in backend
- All handlers are placeholder functions
- Mock data is easily swappable with API calls
- State management is simple and maintainable
- Components are modular and reusable
- TypeScript provides type safety throughout

## Future Backend Integration Checklist

- [ ] Connect AccountValueChart to real account data API
- [ ] Connect TopStrategies to strategies API
- [ ] Connect RecentTrades to trades API
- [ ] Connect RecentWins to filtered trades API
- [ ] Implement deployStrategy API endpoint
- [ ] Add loading states for all data fetching
- [ ] Add error handling for API failures
- [ ] Add authentication/authorization
- [ ] Add WebSocket for real-time updates
- [ ] Add pagination for trade tables

# Trader Ranker

A Solana token analysis and backtesting platform with trader ranking capabilities.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Frontend (Vercel)                   │
│                    http://localhost:3000 (dev)                  │
└────────────────┬────────────────────────────┬───────────────────┘
                 │                            │
                 │ User Auth/Profile          │ Trader/Trade Data
                 ▼                            ▼
        ┌────────────────┐          ┌─────────────────────┐
        │   Supabase     │          │  Express Backend    │
        │  (PostgreSQL)  │          │  localhost:8000     │
        │                │          │  (Raspberry Pi)     │
        │  - User Auth   │          └──────────┬──────────┘
        │  - Profiles    │                     │
        │  - Wallets     │                     ▼
        └────────────────┘          ┌─────────────────────┐
                                    │   AWS DynamoDB      │
                                    │                     │
                                    │  - Trader Stats     │
                                    │  - Trade Records    │
                                    └─────────────────────┘
```

### Backend Routing Strategy

**Main Backend API: `localhost:8000`** (Express.js)
- This is your primary backend server that will eventually run on your Raspberry Pi
- Handles all trader and trade data operations
- Routes to **DynamoDB** for data storage

**User Information: Supabase** (PostgreSQL)
- Handles user authentication (login, register, logout)
- Stores user profiles (username, wallet address, avatar)
- **Only** used for user-related data

### Code Architecture (Server/Backend Split)

The Express backend follows a clean **Server/Backend** layered architecture:

```
pi-backend/src/
├── index.js                     # Entry point
├── server/                      # SERVER LAYER (HTTP handling)
│   ├── middleware/
│   │   ├── auth.js              # Authentication
│   │   └── errorHandler.js      # Error handling
│   └── routes/
│       ├── index.js             # Route registry
│       ├── health.js            # Health checks
│       ├── traders.js           # Trader routes
│       └── trades.js            # Trade routes
└── backend/                     # BACKEND LAYER (Business logic)
    ├── repositories/            # Data access
    ├── services/                # Business logic
    └── utils/                   # Domain utilities
```

**Server Layer:** Handles HTTP requests, authentication, routing
**Backend Layer:** Contains all business logic and data access (no HTTP code)

### Why This Architecture?

- ✅ **Separation of Concerns**: User auth is separated from business data
- ✅ **Scalability**: DynamoDB handles trader/trade data efficiently
- ✅ **Security**: Supabase provides built-in auth with RLS (Row Level Security)
- ✅ **Flexibility**: Backend can be deployed anywhere (Raspberry Pi, VPS, etc.)
- ✅ **Testability**: Clean layer separation enables unit testing
- ✅ **Maintainability**: Single-responsibility modules are easier to modify

## Backend Setup

### Main Backend (Express - Port 8000)

See [`pi-backend/README.md`](./pi-backend/README.md) for detailed setup instructions.

Quick start for local development:

```bash
cd pi-backend
npm install
cp .env.example .env
# Edit .env with your AWS credentials
npm start
```

The API will be available at `http://localhost:8000`

### Backtesting Service (FastAPI - Optional)

1. Create a Python virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Set up environment variables:
   Create a `.env` file in the root directory:

```
BIRDEYE_API_KEY=your_birdeye_api_key
```

4. Run the FastAPI server:

```bash
uvicorn main:app --reload --port 8001
```

The backtesting API will be available at `http://localhost:8001`

## Frontend Setup (Next.js)

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:
   Create a `.env.local` file in the root directory:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

3. Run the development server:

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## API Endpoints

### Main Backend (localhost:8000)

All endpoints require `X-API-Key` header for authentication.

#### Traders

- `GET /api/traders/stats` - Get all trader statistics with optional filters
  - Query params: `winRateMin`, `winRateMax`, `totalCallsMin`, `totalCallsMax`, `roiMin`, `roiMax`, `search`
- `GET /api/traders/:caller/trades` - Get trades for specific trader
- `POST /api/traders` - Create/update trader
- `DELETE /api/traders/:caller` - Delete trader

#### Trades

- `GET /api/trades` - Get all trades
- `GET /api/trades/filtered` - Get filtered trades
  - Query params: `roiMin`, `roiMax`, `mcMin`, `mcMax`, `dateFrom`, `dateTo`, `search`, `trader`
- `POST /api/trades` - Create/update trade
- `DELETE /api/trades` - Delete trade

#### Health Check

- `GET /health` - Health check endpoint (no auth required)

### Backtesting API (localhost:8001 - Optional)

- `GET /api/token-info?address={token_address}` - Get token information
- `POST /api/simulate` - Run backtesting simulation
  ```json
  {
    "tokens": ["token_address1", "token_address2"],
    "amount_usd": 1000,
    "start_unix": 1726000000,
    "timeframe_minutes": 5
  }
  ```

## Database Schema

### DynamoDB Tables

**CallerStatistics** (Trader Stats)
- Primary Key: `caller` (string)
- Attributes: `win_rate`, `total_calls`, `average_roi`, etc.

**Trades** (Trade Records)
- Primary Key: `caller` (string), Sort Key: `ca` (contract address)
- Attributes: `date_called`, `initial_mc`, `current_mc`, `roi`, etc.

### Supabase Tables

**profiles** (User Profiles)
- Primary Key: `id` (UUID - linked to auth.users)
- Attributes: `username`, `full_name`, `avatar_url`, `wallet_address`

## Development

- Main backend API: `http://localhost:8000`
- Backtesting API documentation: `http://localhost:8001/docs`
- Frontend development server: `http://localhost:3000`

## Environment Variables

### Frontend (.env.local)

```env
# Main Backend API
NEXT_PUBLIC_PI_API_BASE=http://localhost:8000
NEXT_PUBLIC_PI_API_KEY=your-secure-api-key

# Supabase (User Auth)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional: Backtesting API
NEXT_PUBLIC_PYTHON_API_URL=http://localhost:8001
```

### Backend (pi-backend/.env)

```env
PORT=8000
API_KEY=your-secure-api-key
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
DYNAMODB_TRADERS_TABLE=CallerStatistics
DYNAMODB_TRADES_TABLE=Trades
```

See [pi-backend/README.md](./pi-backend/README.md) for complete backend setup instructions.

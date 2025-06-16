# Trader Ranker

A Solana token analysis and backtesting platform.

## Backend Setup (FastAPI)

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
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

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

### Token Analysis

- `GET /api/token-info?address={token_address}` - Get token information
- `GET /api/token-holders?address={token_address}` - Get token holder information
- `GET /api/token-authorities?address={token_address}` - Get token authority information

### Backtesting

- `POST /api/simulate` - Run backtesting simulation
  ```json
  {
    "tokens": ["token_address1", "token_address2"],
    "amount_usd": 1000,
    "start_unix": 1726000000,
    "timeframe_minutes": 5
  }
  ```

## Development

- Backend API documentation is available at `http://localhost:8000/docs`
- Frontend development server with hot reloading at `http://localhost:3000`

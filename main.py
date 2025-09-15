from __future__ import annotations
"""
Back-tester FastAPI micro-service (extended, ladder-TP/SL version)
================================================================

* Replaces the fixed TP/SL constants with **dynamic ladders** that the
  client passes per request.
* New request JSON shape (all fields optional with sensible defaults)::

    {
      "tokens": [...],
      "amount_usd": 2500,
      "start_unix": 1726000000,
      "days_back": 3,
      "timeframe_minutes": 5,
      "tp": ["0.05:0.30", "0.10:0.30", "0.20:0.40"],
      "sl": ["0.03:0.25"]
    }

  Each list element is "ratio:sell_fraction" where *ratio* is a positive
  decimal (e.g. 0.05 ⇒ +5 %) and *sell_fraction* is 0 < x ≤ 1.
* Any remainder still open at the end of history is marked-to-market with
  **current_price** so the equity curve = realised + unrealised PnL.
* Tight inner loop compiled with **Numba** (falls back to pure-Python if
  Numba is not present).
* All previous endpoints (token-info, token-holders, health, etc.) are
  untouched.
"""

import math
import asyncio
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
import logging
import sys
from io import BytesIO
import matplotlib.pyplot as plt
from fastapi.responses import StreamingResponse
import itertools
from matplotlib.dates import DateFormatter
from dotenv import load_dotenv
import random

import aiohttp
import async_timeout
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
if not os.path.exists("logs"):
    os.makedirs("logs")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),  # Only console output to avoid file conflicts
    ],
)
logger = logging.getLogger(__name__)
logger.info("=" * 60)
logger.info("Starting FastAPI server with ladder TP/SL support")
logger.info("=" * 60)

# ---------------------------------------------------------------------------
# Load environment variables
# ---------------------------------------------------------------------------
load_dotenv()

# ---------------------------------------------------------------------------
# Constants / config
# ---------------------------------------------------------------------------
HTTP_TIMEOUT = 30  # Increased timeout
RETRIES = 3
RATE_LIMIT_RPS = 1 # Maximum 1 concurrent request to respect rate limits
sem = asyncio.Semaphore(RATE_LIMIT_RPS)

# Rate limiting configuration
DEV_MODE = True  # Set to False in production
REQUEST_DELAY_SECONDS = 2  # Minimum 2 seconds between requests (more conservative)
RATE_LIMIT_RETRY_DELAY = 5  # Wait 5 seconds after 429 error before retry
MAX_RETRIES_PER_REQUEST = 3  # Maximum retries per request

# Load API keys from environment variables
BIRDEYE_API_KEYS_RAW = '0c96b594d358413d939d025b646d466c'#os.getenv("BIRDEYE_API_KEY", "0c96b594d358413d939d025b646d466c")
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "CG-8jAASUaSyaz4VEsDjonVgjNr")

# Parse multiple Birdeye API keys if provided
BIRDEYE_API_KEYS = [key.strip() for key in BIRDEYE_API_KEYS_RAW.split(",")]
current_birdeye_key_index = 0

def get_next_birdeye_key():
    """Get the next API key in rotation."""
    global current_birdeye_key_index
    key = BIRDEYE_API_KEYS[current_birdeye_key_index]
    current_birdeye_key_index = (current_birdeye_key_index + 1) % len(BIRDEYE_API_KEYS)
    return key

def get_random_birdeye_key():
    """Get a random API key from the pool."""
    return random.choice(BIRDEYE_API_KEYS)

async def try_all_birdeye_keys(session: aiohttp.ClientSession, url: str, params: dict = None, headers: dict = None, timeout: int = HTTP_TIMEOUT):
    """
    Try all API keys in rotation with proper rate limiting and retry logic.
    Returns (success: bool, response_data: dict, used_key: str)
    """
    original_headers = headers.copy() if headers else {}
    
    for key_index, api_key in enumerate(BIRDEYE_API_KEYS):
        logger.info(f"Trying Birdeye API key {key_index + 1}/{len(BIRDEYE_API_KEYS)}: {api_key[:10]}...{api_key[-4:]}")
        
        # Update headers with current API key
        current_headers = original_headers.copy()
        current_headers["X-API-KEY"] = api_key
        
        # Try this API key with retries
        for retry_attempt in range(MAX_RETRIES_PER_REQUEST):
            try:
                # Always wait at least 1 second between requests
                await asyncio.sleep(REQUEST_DELAY_SECONDS)
                
                async with sem:  # Use the global semaphore for rate limiting
                    async with async_timeout.timeout(timeout):
                        async with session.get(url, params=params, headers=current_headers) as r:
                            if r.status == 200:
                                data = await r.json()
                                logger.info(f"Success with API key {key_index + 1}: {api_key[:10]}...{api_key[-4:]}")
                                return True, data, api_key
                            elif r.status == 401:
                                logger.warning(f"API key {key_index + 1} unauthorized (401) - trying next key")
                                break  # Don't retry 401 errors, try next key
                            elif r.status == 429:
                                logger.warning(f"API key {key_index + 1} rate limited (429) - attempt {retry_attempt + 1}/{MAX_RETRIES_PER_REQUEST}")
                                if retry_attempt < MAX_RETRIES_PER_REQUEST - 1:
                                    logger.info(f"Waiting {RATE_LIMIT_RETRY_DELAY} seconds before retry...")
                                    await asyncio.sleep(RATE_LIMIT_RETRY_DELAY)
                                    continue  # Retry with same key
                                else:
                                    logger.warning(f"Max retries reached for API key {key_index + 1}, trying next key")
                                    break  # Try next key
                            else:
                                error_text = await r.text()
                                logger.error(f"API key {key_index + 1} failed with status {r.status}: {error_text}")
                                break  # Don't retry other errors, try next key
            except Exception as e:
                logger.error(f"Error with API key {key_index + 1} (attempt {retry_attempt + 1}): {str(e)}")
                if retry_attempt < MAX_RETRIES_PER_REQUEST - 1:
                    await asyncio.sleep(1)  # Wait 1 second before retry
                    continue
                else:
                    break  # Try next key
    
    logger.error("All Birdeye API keys failed")
    return False, None, None

print(f"Loaded {len(BIRDEYE_API_KEYS)} Birdeye API keys")
for i, key in enumerate(BIRDEYE_API_KEYS):
    print(f"  Key {i+1}: {key[:10]}...{key[-4:]}")
print(f"Using COINGECKO_API_KEY: {COINGECKO_API_KEY}")

# Log startup info after API keys are loaded
logger.info(f"Loaded {len(BIRDEYE_API_KEYS)} Birdeye API keys")
for i, key in enumerate(BIRDEYE_API_KEYS):
    logger.info(f"  Key {i+1}: {key[:10]}...{key[-4:]}")
logger.info(f"CoinGecko API Key: {COINGECKO_API_KEY[:10]}...{COINGECKO_API_KEY[-4:]}")
logger.info(f"Development Mode: {DEV_MODE}")
logger.info(f"Request Delay: {REQUEST_DELAY_SECONDS} seconds")
logger.info("=" * 60)

# Low liquidity fallback settings
LOW_LIQUIDITY_MC = 20000  # 20k MC fallback
LOW_LIQUIDITY_PRICE = 0.00001  # Default price for low liquidity coins

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

def generate_low_liquidity_data(mint: str, start_unix: int, end_unix: int, interval_minutes: int = 60):
    return None

# ---------------------------------------------------------------------------
# Utility – Solana address validation (unchanged)
# ---------------------------------------------------------------------------

def is_valid_solana_address(address: str) -> bool:
    if not isinstance(address, str):
        return False
    if not 32 <= len(address) <= 44:
        return False
    try:
        import base58

        return len(base58.b58decode(address)) == 32
    except Exception:
        return False
    
def start_timestamp(req: SimulationRequest) -> int:
    """Return the exact unix 'time_from' value used everywhere."""
    if req.start_unix is not None:
        return int(req.start_unix)
    # floor to the nearest timeframe block so keys align
    base = int((datetime.utcnow() - timedelta(days=req.days_back)).timestamp())
    block = req.timeframe_minutes * 60
    return base - (base % block)

def _ledger_charts_png(sim_results: list[SimulationResult]) -> tuple[BytesIO, BytesIO]:
    """
    Build two charts:
      • value of each token (one colour per token, dots at every 5-min bar)
      • cumulative account value (single line)
    Returns (per_token_png, cumulative_png)
    """
    if not sim_results:
        raise ValueError("no simulations supplied")

    # 1) collect ledgers into a dict[token]→DataFrame
    token_frames = {}
    for res in sim_results:
        if res.ledger is None:
            continue
        rows = [pt.dict() if hasattr(pt, "dict") else pt.model_dump() for pt in res.ledger]
        df = (pd.DataFrame(rows)
              .assign(t=lambda d: pd.to_datetime(d["ts"], unit="s"))
              .set_index("t"))
        token_frames[res.token] = df

    # 2) Align all ledgers on the same time grid (outer join + ffill)
    all_times = sorted(set(itertools.chain.from_iterable(df.index for df in token_frames.values())))
    aligned = {
        tok: df.reindex(all_times).ffill()
        for tok, df in token_frames.items()
    }

    # 3) Build the cumulative equity curve
    cum_df = sum(df["value"] for df in aligned.values())

    # 4) ─── plot token-by-token ─────────────────────────────────────────
    per_png = BytesIO()
    fig1, ax1 = plt.subplots(figsize=(10, 4))
    for tok, df in aligned.items():
        ax1.plot(df.index, df["value"], marker="o", markersize=2, label=tok)
    ax1.set_title("Position value per token")
    ax1.set_ylabel("USD")
    ax1.xaxis.set_major_formatter(DateFormatter('%m-%d %H:%M'))
    ax1.legend(loc="upper left", fontsize="small")
    fig1.tight_layout()
    fig1.savefig(per_png, format="png", dpi=120)
    plt.close(fig1)
    per_png.seek(0)

    # 5) ─── plot cumulative ────────────────────────────────────────────
    cum_png = BytesIO()
    fig2, ax2 = plt.subplots(figsize=(10, 4))
    ax2.plot(cum_df.index, cum_df.values, marker="o", markersize=2)
    ax2.set_title("Cumulative account value")
    ax2.set_ylabel("USD")
    ax2.xaxis.set_major_formatter(DateFormatter('%m-%d %H:%M'))
    fig2.tight_layout()
    fig2.savefig(cum_png, format="png", dpi=120)
    plt.close(fig2)
    cum_png.seek(0)

    return per_png, cum_png
# ---------------------------------------------------------------------------
# Numba-accelerated ladder back-test core
# ---------------------------------------------------------------------------
try:
    from numba import njit, float64, int64, boolean  # type: ignore

    @njit(cache=True, fastmath=True)
    def _bt_core(
        close: np.ndarray,
        high: np.ndarray,
        low: np.ndarray,
        tp_r: np.ndarray,
        tp_s: np.ndarray,
        sl_r: np.ndarray,
        sl_s: np.ndarray,
    ):
        """Return list[tuple(idx, exit_idx, pnl_frac)] for a *single* trade."""
        n_candles = close.shape[0]
        entry_px = close[0]
        size_left = 1.0
        pnl = 0.0
        # flags so each ladder fires once
        tp_hit = np.zeros(tp_r.shape[0], dtype=boolean)
        sl_hit = np.zeros(sl_r.shape[0], dtype=boolean)

        for j in range(1, n_candles):
            if size_left <= 1e-9:
                break

            # ---- take profits first (greedy) ----
            for k in range(tp_r.shape[0]):
                if tp_hit[k]:
                    continue
                target = entry_px * (1.0 + tp_r[k])
                if high[j] >= target:
                    sell = min(size_left, tp_s[k])
                    pnl += sell * (target - entry_px)
                    size_left -= sell
                    tp_hit[k] = True
            # ---- stops ----
            for k in range(sl_r.shape[0]):
                if sl_hit[k]:
                    continue
                stop = entry_px * (1.0 - sl_r[k])
                if low[j] <= stop:
                    sell = min(size_left, sl_s[k])
                    pnl += sell * (stop - entry_px)
                    size_left -= sell
                    sl_hit[k] = True
        return pnl, size_left, tp_hit, sl_hit

    JIT_READY = True
except Exception as e:  # pragma: no cover – Numba not installed
    logger.warning("Numba unavailable – falling back to pure-Python back-tester (%s)", e)
    JIT_READY = False

# ---------------------------------------------------------------------------
# Pure-Python fallback (vectorised but no jit)
# ---------------------------------------------------------------------------

def _bt_core_py(
    close: np.ndarray,
    high: np.ndarray,
    low: np.ndarray,
    tp_r: np.ndarray,
    tp_s: np.ndarray,
    sl_r: np.ndarray,
    sl_s: np.ndarray,
):
    entry_px = close[0]
    size_left = 1.0
    pnl = 0.0
    tp_hit = np.zeros(tp_r.shape[0], dtype=bool)
    sl_hit = np.zeros(sl_r.shape[0], dtype=bool)

    for j in range(1, len(close)):
        if size_left <= 1e-9:
            break
        for k, (ratio, frac) in enumerate(zip(tp_r, tp_s)):
            if tp_hit[k]:
                continue
            tgt = entry_px * (1 + ratio)
            if high[j] >= tgt:
                sell = min(size_left, frac)
                pnl += sell * (tgt - entry_px)
                size_left -= sell
                tp_hit[k] = True
        for k, (ratio, frac) in enumerate(zip(sl_r, sl_s)):
            if sl_hit[k]:
                continue
            stp = entry_px * (1 - ratio)
            if low[j] <= stp:
                sell = min(size_left, frac)
                pnl += sell * (stp - entry_px)
                size_left -= sell
                sl_hit[k] = True
    return pnl, size_left, tp_hit, sl_hit

# convenience alias
_bt_engine = _bt_core if JIT_READY else _bt_core_py

# ---------------------------------------------------------------------------
# Data helpers (Birdeye clients cut for brevity – unchanged from original)
# ---------------------------------------------------------------------------

# ──────────────── HTTP HELPERS ───────────────────────────────────────────────


async def fetch_history_price(
    session: aiohttp.ClientSession,
    mint: str,
    start_unix: int,
    timeframe_minutes: int,
    end_unix: Optional[int] = None,
) -> Tuple[str, List[Dict[str, Any]]]:
    """Download price data with adaptive timeframes to get everything in ONE request per coin."""
    logger.info(f"=== FETCHING HISTORY PRICE FOR {mint} ===")
    
    if end_unix is None:
        end_ts = int(datetime.now().timestamp() // 60 * 60)
    else:
        end_ts = end_unix
    
    # Allow longer time ranges for single requests (up to 60 days for better price action)
    max_duration = 60 * 24 * 3600  # 60 days max for single requests
    if end_ts - start_unix > max_duration:
        start_unix = end_ts - max_duration
        logger.info(f"Limiting time range for {mint} to 60 days to avoid excessive API calls")
    
    logger.info(f"Fetching price history for {mint} from {start_unix} to {end_ts}")

    # Calculate the total time range in minutes
    total_minutes = (end_ts - start_unix) // 60
    
    # Determine the optimal time interval to get <= 1000 points
    # Birdeye API returns max 1000 data points per request
    # Valid timeframes: 1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H, 6H, 8H, 12H, 1D, 3D, 1W, 1M
    # For better granularity, prefer smaller intervals when possible
    if total_minutes <= 1000:
        # Use 1-minute intervals for short time ranges
        interval_type = "1m"
        interval_minutes = 1
    elif total_minutes <= 1000 * 3:  # Up to 3 hours
        # Use 3-minute intervals
        interval_type = "3m"
        interval_minutes = 3
    elif total_minutes <= 1000 * 5:  # Up to 5 hours
        # Use 5-minute intervals
        interval_type = "5m"
        interval_minutes = 5
    elif total_minutes <= 1000 * 15:  # Up to 15 hours
        # Use 15-minute intervals
        interval_type = "15m"
        interval_minutes = 15
    elif total_minutes <= 1000 * 30:  # Up to 30 hours
        # Use 30-minute intervals
        interval_type = "30m"
        interval_minutes = 30
    elif total_minutes <= 1000 * 60:  # Up to 60 hours (2.5 days)
        # Use 1-hour intervals
        interval_type = "1H"
        interval_minutes = 60
    elif total_minutes <= 1000 * 120:  # Up to 120 hours (5 days)
        # Use 2-hour intervals
        interval_type = "2H"
        interval_minutes = 120
    elif total_minutes <= 1000 * 240:  # Up to 240 hours (10 days)
        # Use 4-hour intervals
        interval_type = "4H"
        interval_minutes = 240
    elif total_minutes <= 1000 * 360:  # Up to 360 hours (15 days)
        # Use 6-hour intervals
        interval_type = "6H"
        interval_minutes = 360
    elif total_minutes <= 1000 * 480:  # Up to 480 hours (20 days)
        # Use 8-hour intervals
        interval_type = "8H"
        interval_minutes = 480
    elif total_minutes <= 1000 * 720:  # Up to 720 hours (30 days)
        # Use 12-hour intervals
        interval_type = "12H"
        interval_minutes = 720
    else:
        # Use 1-day intervals for very long ranges
        interval_type = "1D"
        interval_minutes = 1440
    
    expected_points = total_minutes // interval_minutes
    logger.info(f"Using {interval_type} intervals for {mint}: {expected_points} expected points over {total_minutes} minutes")
    
    # Single API call with the optimal interval
    # Use the correct endpoint from Birdeye documentation
    url = "https://public-api.birdeye.so/defi/history_price"
    params = {
        "address": mint,
        "address_type": "token",
        "type": interval_type,  # String values: "1m", "5m", "15m", "1h", "4h", "1d"
        "time_from": start_unix,
        "time_to": end_ts,
        "ui_amount_mode": "raw"
    }   
    headers = {
        "x-chain": "solana",
        "accept": "application/json",
    }
    
    logger.info(f"Making request to: {url}")
    logger.info(f"Parameters: {params}")
    
    # Try all API keys
    success, js, used_key = await try_all_birdeye_keys(session, url, params, headers)
    
    if not success:
        logger.error(f"All API keys failed for {mint}")
        return mint, []
    
    # Log the API response for debugging
    logger.info(f"API response for {mint}: {js}")
    
    items = js.get("data", {}).get("items", [])
    
    if not items:
        logger.warning(f"No price data in response for {mint}. Full response: {js}")
        return mint, []
    
    # Validate price data
    valid_items = []
    for item in items:
        if not isinstance(item.get("value"), (int, float)) or not isinstance(item.get("unixTime"), (int, float)):
            logger.warning(f"Invalid price data point for {mint}: {item}")
            continue
        # Convert unixTime to seconds if it's in milliseconds
        unix_time = item["unixTime"]
        if unix_time > 1e12:  # If timestamp is in milliseconds
            unix_time = unix_time // 1000
        valid_items.append({
            "unixTime": unix_time,
            "value": float(item["value"])
        })
    
    if not valid_items:
        logger.warning(f"No valid price data points for {mint}")
        return mint, []
    
    # Check if we have enough data points for meaningful analysis
    if len(valid_items) < 10:
        logger.warning(f"Insufficient data points for {mint}: only {len(valid_items)} points (need at least 10)")
        return mint, []
    
    # Sort by timestamp and remove duplicates
    valid_items.sort(key=lambda x: x["unixTime"])
    unique_items = []
    seen_timestamps = set()
    for item in valid_items:
        if item["unixTime"] not in seen_timestamps:
            unique_items.append(item)
            seen_timestamps.add(item["unixTime"])
    
    # Log the actual date range of the data
    if unique_items:
        first_ts = unique_items[0]["unixTime"]
        last_ts = unique_items[-1]["unixTime"]
        first_date = datetime.fromtimestamp(first_ts).strftime('%Y-%m-%d %H:%M:%S')
        last_date = datetime.fromtimestamp(last_ts).strftime('%Y-%m-%d %H:%M:%S')
        logger.info(f"Data range for {mint}: {first_date} to {last_date} ({len(unique_items)} points)")
        logger.info(f"Requested range: {datetime.fromtimestamp(start_unix).strftime('%Y-%m-%d %H:%M:%S')} to {datetime.fromtimestamp(end_ts).strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"Used {interval_type} intervals, got {len(unique_items)} points")
        
        # Log a few sample data points to debug
        logger.info(f"Sample data points for {mint}:")
        for i, item in enumerate(unique_items[:3]):
            sample_date = datetime.fromtimestamp(item["unixTime"]).strftime('%Y-%m-%d %H:%M:%S')
            logger.info(f"  Point {i}: {sample_date} - Price: {item['value']}")
        if len(unique_items) > 3:
            last_item = unique_items[-1]
            last_sample_date = datetime.fromtimestamp(last_item["unixTime"]).strftime('%Y-%m-%d %H:%M:%S')
            logger.info(f"  Last point: {last_sample_date} - Price: {last_item['value']}")
    else:
        logger.warning(f"No valid data points for {mint}")
    
    logger.info(f"Successfully retrieved {len(unique_items)} valid price points for {mint} using key: {used_key[:10]}...{used_key[-4:]}")
    return mint, unique_items

async def fetch_current_price(session: aiohttp.ClientSession, mint: str) -> Optional[float]:
    """Fetch current price from Birdeye API using the /defi/price endpoint."""
    logger.info(f"=== FETCHING CURRENT PRICE FOR {mint} ===")

    if session is None:
        logger.error(f"Session is None for {mint}")
        return None

    url = f"https://public-api.birdeye.so/defi/price?address={mint}&ui_amount_mode=raw"

    headers = {
        "x-chain": "solana",
        "accept": "application/json",
        "X-API-KEY": "0c96b594d358413d939d025b646d466c"
    }

    try:
        async with session.get(url, headers=headers) as response:
            if response.status != 200:
                logger.error(f"HTTP {response.status} error for {mint}")
                return None

            js = await response.json()

            if not js.get("success", False):
                logger.error(f"Birdeye API returned unsuccessful response for {mint}: {js}")
                return None

            price = js.get("data", {}).get("value")
            if price is None:
                logger.error(f"No price in response data for {mint}. Full response: {js}")
                return None

            logger.info(f"Current price for {mint}: {price}")
            return float(price)

    except Exception as e:
        logger.exception(f"Exception while fetching price for {mint}: {e}")
        return None

# ---------------------------------------------------------------------------
# OHLC builder (identical to original but factored into a fn)
# ---------------------------------------------------------------------------

def build_ohlc(items: List[Dict[str, Any]], tf_minutes: int) -> pd.DataFrame:
    """Convert API data points → OHLC DataFrame. The API already provides data at the requested interval."""
    if not items:
        logger.error("No items provided to build_ohlc")
        return pd.DataFrame()
        
    try:
        # The API already returns data at the requested interval, so we just need to format it
        df = (
            pd.DataFrame(items)
            .rename(columns={"unixTime": "t", "value": "close"})
            .assign(t=lambda d: pd.to_datetime(d["t"], unit="s"))
            .set_index("t")
        )
        
        if df.empty:
            logger.error("Empty DataFrame after initial processing")
            return pd.DataFrame()
        
        # Sort by timestamp to ensure proper order
        df = df.sort_index()
        
        # Since the API already provides data at the requested interval,
        # we need to create proper OHLC format
        # Use the actual price data from the API without artificial variations
        ohlc_bars = []
        for idx, row in df.iterrows():
            close_price = row["close"]
            # Use the actual price data - no artificial variations
            bar = {
                "t": idx,  # Use the timestamp from the data
                "open": close_price,   # Use actual close price as open
                "high": close_price,   # Use actual close price as high
                "low": close_price,    # Use actual close price as low
                "close": close_price,  # Use actual close price as close
                "volume": np.nan
            }
            ohlc_bars.append(bar)
        
        result = pd.DataFrame(ohlc_bars)
        
        logger.info(f"Built OHLC data with shape: {result.shape} from {len(items)} API data points")
        logger.info(f"Time range: {result['t'].min()} to {result['t'].max()}")
        logger.info(f"Sample prices: {result['close'].head(3).tolist()}")
        return result
        
    except Exception as e:
        logger.error(f"Error building OHLC data: {str(e)}", exc_info=True)
        return pd.DataFrame()

# ---------------------------------------------------------------------------
# Ladder-aware simulation wrapper
# ---------------------------------------------------------------------------

def run_simulation(
    df: pd.DataFrame,
    amount_usd: float,
    current_price: float,
    tp_r: List[float],
    tp_s: List[float],
    sl_r: List[float],
    sl_s: List[float],
):
    """Return entry, final value, ROI %, hit flags, equity curve."""
    if df.empty:
        raise ValueError("empty OHLC data")
    df = df.sort_values("t").reset_index(drop=True)
    entry_price = float(df["open"].iat[0])
    if entry_price <= 0:
        raise ValueError("entry price ≤ 0")

    qty_tokens = amount_usd / entry_price
    high = df["high"].to_numpy(np.float64)
    low = df["low"].to_numpy(np.float64)
    close = df["close"].to_numpy(np.float64)  # needed for length but engine uses close[0]

    pnl_usd_per_token, size_left, tp_hit, sl_hit = _bt_engine(
        close,
        high,
        low,
        np.array(tp_r, dtype=np.float64),
        np.array(tp_s, dtype=np.float64),
        np.array(sl_r, dtype=np.float64),
        np.array(sl_s, dtype=np.float64),
    )

    realised = pnl_usd_per_token * qty_tokens
    unrealised = size_left * qty_tokens * current_price - size_left * qty_tokens * entry_price
    final_value = amount_usd + realised + unrealised
    roi_pct = (final_value - amount_usd) / amount_usd * 100

    return {
        "current_price": round(current_price, 6),
        "amount_usd": amount_usd,
        "final_usd": round(final_value, 2),
        "roi_percent": round(roi_pct, 2),
        "tps_hit": tp_hit.tolist(),
        "sls_hit": sl_hit.tolist(),
    }

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class PositionPoint(BaseModel):
    ts: int                  # unix
    value: float             # USD value of the position *at* ts
    coins_held: float        # size remaining
    unrealized: float
    realized: float

class SimulationResult(BaseModel):
    token: str  
    ledger: List[PositionPoint] | None = None
    realized_profit: float | None = None
    unrealized_profit: float | None = None
    coins_left: float | None = None
    tps_hit: List[float] | None = None
    sls_hit: List[float] | None = None
    error: str | None = None

class TradeInfo(BaseModel):
    token: str
    date_called: str  # ISO string format

class SimulationRequest(BaseModel):
    tokens: List[str]
    amount_usd: float = Field(1000, gt=0)
    start_unix: Optional[int] = None
    end_unix: Optional[int] = None
    days_back: int = Field(30, ge=1, le=60)  # Increased max to 60 days for better price action
    timeframe_minutes: int = Field(15, ge=1, le=1440)  # Default to 15 minutes, max 24 hours
    tp: Optional[List[str]] = Field(None, description="List of 'ratio:sell' strings")
    sl: Optional[List[str]] = Field(None, description="List of 'ratio:sell' strings")

class TradeBasedSimulationRequest(BaseModel):
    trades: List[TradeInfo]
    amount_usd: float = Field(1000, gt=0)
    timeframe_minutes: int = Field(15, ge=1, le=1440)  # Default to 15 minutes, max 24 hours
    use_auto_timeframe: bool = Field(True, description="Whether to automatically calculate optimal timeframe")
    tp: Optional[List[str]] = Field(None, description="List of 'ratio:sell' strings")
    sl: Optional[List[str]] = Field(None, description="List of 'ratio:sell' strings")

    @validator("tp", "sl", always=True)
    def _default_ladders(cls, v, field):
        if v is None:
            return ["0.05:1.0"] if field.name == "tp" else []
        return v


# ---------------------------------------------------------------------------
# FastAPI app & CORS
# ---------------------------------------------------------------------------
app = FastAPI(title="Solana Backtester API", version="0.3.0 (ladder)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Helper: parse "ratio:sell" list → two float lists
# ---------------------------------------------------------------------------
# ─── helper: align ledgers WITHOUT "infinite" forward-fill ────────────────
def _aligned_ledgers(sim_results: list[SimulationResult]) -> dict[str, pd.DataFrame]:
    """
    Return {token: df} where df.index is datetime and df['value'] is USD equity.
    Each df is time-clipped at its own last bar, so no horizontal tail.
    """
    frames = {}
    for res in sim_results:
        if res.ledger is None:
            continue
        rows = [pt.dict() if hasattr(pt, "dict") else pt.model_dump()
                for pt in res.ledger]
        df = (pd.DataFrame(rows)
              .assign(t=lambda d: pd.to_datetime(d["ts"], unit="s"))
              .set_index("t"))
        frames[res.token] = df

    # outer-join on all times, but later mask beyond each token's last bar
    all_times = sorted(set(itertools.chain.from_iterable(df.index for df in frames.values())))
    aligned = {}
    for tok, df in frames.items():
        last = df.index[-1]
        tmp = df.reindex(all_times).ffill()
        tmp = tmp[tmp.index <= last]          # clip forward-fill tail
        aligned[tok] = tmp
    return aligned

# ── place below _aligned_ledgers ─────────────────────────────────────────
def _ledger_to_equity_df(res: SimulationResult) -> pd.DataFrame:
    """
    Return a DataFrame with
      • index = datetime
      • columns: ['value', 'realized', 'equity', 'sell_marker']
    """
    rows = [pt.dict() if hasattr(pt, "dict") else pt.model_dump()
            for pt in res.ledger or []]

    df = (pd.DataFrame(rows)
            .assign(t=lambda d: pd.to_datetime(d["ts"], unit="s"))
            .set_index("t"))

    df["equity"] = df["value"] + df["realized"]

    # mark bars where coins_held drops (TP or SL)
    delta = df["coins_held"].diff().fillna(0)
    df["sell_marker"] = np.where(delta < 0, df["equity"], np.nan)
    return df

# ─── build the two PNGs (per-token + cumulative) ──────────────────────────
# ── replace _build_value_pngs with this version ──────────────────────────
def _build_value_pngs(sim_results: list[SimulationResult]) -> tuple[BytesIO, BytesIO]:
    # convert ledgers
    token_dfs = {r.token: _ledger_to_equity_df(r) for r in sim_results if r.ledger}

    # common time-axis (outer join)
    all_times = sorted(set(itertools.chain.from_iterable(df.index for df in token_dfs.values())))
    aligned = {tok: df.reindex(all_times).ffill() for tok, df in token_dfs.items()}

    # ── per-token plot ───────────────────────────────────────────────────
    per_png = BytesIO()
    fig1, ax1 = plt.subplots(figsize=(12, 6))
    for tok, df in aligned.items():
        ax1.plot(df.index, df["equity"], label=tok, linewidth=1)
        ax1.scatter(df.index, df["sell_marker"], marker="s", s=20, color="red")  # red "S"
    ax1.set_title("Position equity per token (red S = sell)")
    ax1.set_ylabel("USD")
    ax1.set_xlabel("Time")
    
    # Improve time formatting
    if len(all_times) > 0:
        ax1.xaxis.set_major_formatter(DateFormatter('%m-%d %H:%M'))
        ax1.xaxis.set_major_locator(plt.MaxNLocator(8))  # Limit number of ticks
        plt.setp(ax1.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    ax1.legend(fontsize="small")
    ax1.grid(True, alpha=0.3)
    fig1.tight_layout()
    fig1.savefig(per_png, format="png", dpi=120, bbox_inches='tight')
    plt.close(fig1)
    per_png.seek(0)

    # ── cumulative plot ──────────────────────────────────────────────────
    cum_df = sum(df["equity"] for df in aligned.values())
    cum_png = BytesIO()
    fig2, ax2 = plt.subplots(figsize=(12, 6))
    ax2.plot(cum_df.index, cum_df.values, linewidth=2, color='green')
    ax2.set_title("Cumulative account equity")
    ax2.set_ylabel("USD")
    ax2.set_xlabel("Time")
    
    # Improve time formatting
    if len(all_times) > 0:
        ax2.xaxis.set_major_formatter(DateFormatter('%m-%d %H:%M'))
        ax2.xaxis.set_major_locator(plt.MaxNLocator(8))  # Limit number of ticks
        plt.setp(ax2.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    ax2.grid(True, alpha=0.3)
    fig2.tight_layout()
    fig2.savefig(cum_png, format="png", dpi=120, bbox_inches='tight')
    plt.close(fig2)
    cum_png.seek(0)

    return per_png, cum_png


def calculate_optimal_timeframe(start_ts: int, end_ts: int, max_data_points: int = 716) -> int:
    """
    Calculate the optimal timeframe in minutes based on the duration and max data points.
    Returns timeframe in minutes that will fit within the max_data_points limit.
    """
    duration_hours = (end_ts - start_ts) / 3600
    duration_days = duration_hours / 24
    
    # Available timeframes in minutes
    timeframes = [1, 3, 5, 15, 30, 60, 240, 480, 1440]  # 1m, 3m, 5m, 15m, 30m, 1h, 4h, 8h, 1d
    
    for tf in timeframes:
        # Calculate how many data points this timeframe would produce
        tf_hours = tf / 60
        estimated_points = duration_hours / tf_hours
        
        if estimated_points <= max_data_points:
            return tf
    
    # If no timeframe fits, return daily (1440 minutes)
    return 1440

def _parse_ladder(raw: List[str]) -> Tuple[List[float], List[float]]:
    ratios, sells = [], []
    for item in raw:
        try:
            r, s = item.split(":")
            r, s = float(r), float(s)
            # Allow 0:0 as a way to disable a level
            if r == 0 and s == 0:
                continue
            # For non-zero values, validate as before
            if r <= 0 or s <= 0 or s > 1:
                raise ValueError
            ratios.append(r)
            sells.append(s)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid ladder value '{item}' (want 'ratio:sell' or '0:0' to disable)")
    if sum(sells) > 1 + 1e-9:
        raise HTTPException(status_code=400, detail="Sum of sell fractions exceeds 1.0")
    return ratios, sells

def run_simulation_with_ledger(
    df_ohlc: pd.DataFrame,
    start_cash_usd: float,
    current_price: float,
    tp_ratios: List[float], tp_sizes: List[float],
    sl_ratios: List[float], sl_sizes: List[float],
) -> Dict[str, Any]:
    """
    Parameters
    ----------
    df_ohlc
        Index must be unix time (int) or datetime. Needs at least a 'close' col.
    start_cash_usd
        Size of the *initial* position in USD (whole amount is deployed at bar-0).
    current_price
        Last known price from Birdeye (used only for an optional equity point).
    tp_ratios / sl_ratios
        Ladder percentages in *return* terms   (e.g. 0.10 == +10 %).
    tp_sizes / sl_sizes
        Matching list of *fractions* of the starting position to close
        (e.g. 0.25 means "sell 25 % of original coins").
    """
    if df_ohlc.empty:
        raise ValueError("Empty OHLC dataframe")

    # -- constants ---------------------------------------------------------- #
    entry_price = float(df_ohlc["close"].iloc[0])
    entry_coins = start_cash_usd / entry_price

    # Build absolute price levels once
    tp_levels = [entry_price * (1 + r) for r in tp_ratios]
    sl_levels = [entry_price * (1 - r) for r in sl_ratios]

    # Internal state
    coins = entry_coins
    realized = 0.0
    tp_fired: set[int] = set()   # indices of ladder levels already filled
    sl_fired: set[int] = set()

    ledger: List[PositionPoint] = []

    # ---------------------------------------------------------------------- #
    # loop over bars
    # ---------------------------------------------------------------------- #
    for _, row in df_ohlc.iterrows():
        ts     = int(row["t"].timestamp())           # <-- real unix seconds
        price  = float(row["close"])

        tp_hit = sl_hit = None

        # --- check TP ladder ------------------------------------------------
        for i, (px, sz) in enumerate(zip(tp_levels, tp_sizes)):
            if i in tp_fired or coins <= 0:
                continue
            if price >= px:                 # hit!
                sell_qty = entry_coins * sz
                sell_qty = min(sell_qty, coins)   # do not short
                coins -= sell_qty
                realized += sell_qty * px
                tp_fired.add(i)
                tp_hit = px

        # --- check SL ladder ------------------------------------------------
        for i, (px, sz) in enumerate(zip(sl_levels, sl_sizes)):
            if i in sl_fired or coins <= 0:
                continue
            if price <= px:                 # hit!
                sell_qty = entry_coins * sz
                sell_qty = min(sell_qty, coins)
                coins -= sell_qty
                realized += sell_qty * px
                sl_fired.add(i)
                sl_hit = px

        # --- book keeping ---------------------------------------------------
        equity = coins * price
        unrealized = equity + realized - start_cash_usd

        ledger.append(
            PositionPoint(
                ts=int(ts),
                value=float(equity),
                coins_held=float(coins),
                unrealized=float(unrealized),
                realized=float(realized),
            )
        )

        # early exit – no position left
        if coins <= 0:
            break

    # Final point with the *live* Birdeye price if newer than last bar --------

    equity     = coins * current_price
    unrealized = equity + realized - start_cash_usd

    # record it only if the live price is newer or different
    if not math.isclose(current_price, df_ohlc["close"].iloc[-1]):
        ledger.append(
            PositionPoint(
                ts=int(datetime.utcnow().timestamp()),
                value=float(equity),
                coins_held=float(coins),
                unrealized=float(unrealized),
                realized=float(realized),
            )
        )

    # realised P/L = sale proceeds – cost basis of coins sold
    realised_pl = realized - (entry_coins - coins) * entry_price   # works for both full/partial exits

    return {
        "ledger":            [pt.dict() for pt in ledger],
        "realized_profit":   round(realised_pl, 6),
        "unrealized_profit": round(unrealized,   6),
        "coins_left":        round(coins,        6),
        "tps_hit":           [tp_levels[i] for i in sorted(tp_fired)],
        "sls_hit":           [sl_levels[i] for i in sorted(sl_fired)],
    }

def _price_chart_png(df_ohlc: pd.DataFrame) -> BytesIO:
    """
    Return a PNG line chart (with dot markers) of 5-minute CLOSE prices.
    """
    # df_ohlc already has a 't' column in datetime64[ns] after build_ohlc()
    df = df_ohlc.copy().assign(t=lambda d: pd.to_datetime(d["t"]))

    fig, ax = plt.subplots(figsize=(8, 3))
    ax.plot(df["t"], df["close"], marker="o", markersize=3, linewidth=1)

    ax.set_xlabel("Time (UTC)")
    ax.set_ylabel("Close price")
    ax.set_title("5-minute price chart")
    fig.autofmt_xdate()          # nicer x-labels
    fig.tight_layout()

    buf = BytesIO()
    fig.savefig(buf, format="png", dpi=120)
    plt.close(fig)
    buf.seek(0)
    return buf

    # ---------------------------------------------------------------------- #
    # package for the API response
    # ---------------------------------------------------------------------- #


# ---------------------------------------------------------------------------
# Routes – only /api/simulate changed to support ladders & new engine
# ---------------------------------------------------------------------------

history_cache: dict[tuple[str, int, int], list[dict]] = {}

async def _cached_history(
    session: aiohttp.ClientSession,
    mint: str,
    start_ts: int,
    tf: int,
    end_ts: int,
) -> tuple[str, list[dict]] | None:
    """
    Tiny in-memory cache so we don't hammer Birdeye if the same request
    is repeated during one server run.
    """
    key = (mint, start_ts, tf)
    logger.info(f"Checking cache for key: {key}")
    if key in history_cache:
        logger.info(f"Cache hit for {mint}, returning {len(history_cache[key])} items")
        return mint, history_cache[key]

    logger.info(f"Cache miss for {mint}, fetching from API...")
    res = await fetch_history_price(session, mint, start_ts, tf, end_ts)
    if res is None:         # already logged inside fetch_history_price
        logger.error(f"fetch_history_price returned None for {mint}")
        return None
    mint, items = res
    logger.info(f"Fetched {len(items)} items for {mint}, caching...")
    history_cache[key] = items
    return mint, items
from fastapi.responses import StreamingResponse, Response
from starlette.responses import JSONResponse
from zipfile import ZipFile, ZIP_DEFLATED

@app.post("/api/value_charts")
async def value_charts(req: SimulationRequest):
    """
    Returns two PNGs zipped together:
      value_per_token.png   – separate line for each token
      cumulative_value.png  – sum of all tokens
    """
    sims = await simulate(req)                       # reuse existing logic
    errors = [s.error for s in sims if s.error]
    if errors:
        return JSONResponse({"errors": errors}, status_code=400)

    per_png, cum_png = _ledger_charts_png(sims)

    # One neat ZIP so Swagger lets you download a single file
    buf = BytesIO()
    with ZipFile(buf, "w", ZIP_DEFLATED) as z:
        z.writestr("value_per_token.png", per_png.getvalue())
        z.writestr("cumulative_value.png", cum_png.getvalue())
    buf.seek(0)
    headers = {"Content-Disposition": "attachment; filename=value_charts.zip"}
    return Response(content=buf.getvalue(),
                    media_type="application/zip",
                    headers=headers)

@app.post("/api/price_chart", response_class=StreamingResponse)
async def price_chart(req: SimulationRequest):
    # 1) run simulate() just to validate inputs and (usually) fill the cache
    await simulate(req)

    mint     = req.tokens[0]
    start_ts = start_timestamp(req)
    tf       = req.timeframe_minutes

    # 2) guarantee we have the OHLC source data
    key = (mint, start_ts, tf)
    if key not in history_cache:
        async with aiohttp.ClientSession() as sess:
            _, items = await _cached_history(sess, mint, start_ts, tf, int(datetime.now().timestamp()))
    else:
        items = history_cache[key]

    if not items:
        raise HTTPException(500, "no price history")

    df_ohlc = build_ohlc(items, tf)
    png     = _price_chart_png(df_ohlc)   # <- line+dots helper from previous reply
    return StreamingResponse(png, media_type="image/png")

@app.post("/api/value_chart/per_token", response_class=StreamingResponse)
async def chart_per_token(req: SimulationRequest):
    sims = await simulate(req)
    if any(s.error for s in sims):
        raise HTTPException(400, {"errors": [s.error for s in sims if s.error]})
    per_png, _ = _build_value_pngs(sims)
    return StreamingResponse(per_png, media_type="image/png")


@app.post("/api/value_chart/cumulative", response_class=StreamingResponse)
async def chart_cumulative(req: SimulationRequest):
    sims = await simulate(req)
    if any(s.error for s in sims):
        raise HTTPException(400, {"errors": [s.error for s in sims if s.error]})
    _, cum_png = _build_value_pngs(sims)
    return StreamingResponse(cum_png, media_type="image/png")
@app.get("/ping")
async def ping():
    return {"status": "ok"}

@app.get("/api/validate-keys")
async def validate_api_keys():
    """Test API keys to see if they're working."""
    logger.info("=== VALIDATING API KEYS ===")
    
    results = {}
    
    # Test Birdeye API keys
    try:
        logger.info("Testing Birdeye API keys...")
        url = "https://public-api.birdeye.so/public/token_price?address=So11111111111111111111111111111111111111112"  # SOL token
        headers = {
            "accept": "application/json",
        }
        
        async with aiohttp.ClientSession() as session:
            success, data, used_key = await try_all_birdeye_keys(session, url, headers=headers, timeout=10)
            
            if success:
                results["birdeye"] = {
                    "status": "valid",
                    "message": f"API key is working (used key: {used_key[:10]}...{used_key[-4:]})",
                    "sample_data": data.get("data", {}),
                    "keys_tested": len(BIRDEYE_API_KEYS)
                }
                logger.info(f"Birdeye API key validation successful with key: {used_key[:10]}...{used_key[-4:]}")
            else:
                results["birdeye"] = {
                    "status": "invalid",
                    "message": "All API keys failed",
                    "keys_tested": len(BIRDEYE_API_KEYS)
                }
                logger.error("All Birdeye API keys failed validation")
    except Exception as e:
        results["birdeye"] = {
            "status": "error",
            "message": f"Exception occurred: {str(e)}",
            "keys_tested": len(BIRDEYE_API_KEYS)
        }
        logger.error(f"Error testing Birdeye API: {e}")
    
    # Test CoinGecko API key
    try:
        logger.info("Testing CoinGecko API key...")
        url = "https://api.coingecko.com/api/v3/ping"
        headers = {
            "accept": "application/json",
            "x-cg-demo-api-key": COINGECKO_API_KEY
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    results["coingecko"] = {
                        "status": "valid",
                        "message": "API key is working",
                        "sample_data": data
                    }
                    logger.info("CoinGecko API key is valid")
                elif response.status == 401:
                    results["coingecko"] = {
                        "status": "invalid",
                        "message": "API key is invalid or expired",
                        "status_code": response.status
                    }
                    logger.error("CoinGecko API key is invalid")
                else:
                    results["coingecko"] = {
                        "status": "error",
                        "message": f"Unexpected status code: {response.status}",
                        "status_code": response.status
                    }
                    logger.error(f"CoinGecko API returned status {response.status}")
    except Exception as e:
        results["coingecko"] = {
            "status": "error",
            "message": f"Exception occurred: {str(e)}"
        }
        logger.error(f"Error testing CoinGecko API: {e}")
    
    logger.info("=== API KEY VALIDATION COMPLETE ===")
    return results
    
@app.post("/api/simulate", response_model=list[SimulationResult])
async def simulate(req: SimulationRequest) -> list[SimulationResult]:
    """
    Fast(er) simulation endpoint that

    1. fetches history / current-price in parallel;
    2. produces a full position-ledger for charting;
    3. returns TP / SL ladders that actually triggered.
    """
    
    logger.info("=== SIMULATION REQUEST START ===")
    logger.info(f"Request tokens: {req.tokens}")
    logger.info(f"Request amount_usd: {req.amount_usd}")
    logger.info(f"Request timeframe_minutes: {req.timeframe_minutes}")
    logger.info(f"Request days_back: {req.days_back}")
    logger.info(f"Request start_unix: {req.start_unix}")
    logger.info(f"Request end_unix: {req.end_unix}")
    logger.info(f"Request tp: {req.tp}")
    logger.info(f"Request sl: {req.sl}")

    if not BIRDEYE_API_KEYS:
        logger.error("BIRDEYE_API_KEY not set")
        raise HTTPException(500, "BIRDEYE_API_KEY not set")

    bad = [t for t in req.tokens if not is_valid_solana_address(t)]
    if bad:
        logger.error(f"Invalid Solana address(es): {', '.join(bad)}")
        raise HTTPException(400, f"Invalid Solana address(es): {', '.join(bad)}")

    logger.info("Parsing ladder levels...")
    tp_r, tp_s = _parse_ladder(req.tp)
    sl_r, sl_s = _parse_ladder(req.sl)
    logger.info(f"TP ratios: {tp_r}, TP sizes: {tp_s}")
    logger.info(f"SL ratios: {sl_r}, SL sizes: {sl_s}")

    now_ts = int(datetime.utcnow().timestamp())
    if req.start_unix:
        start_ts = int(req.start_unix)
        if start_ts >= now_ts:
            logger.error(f"start_unix {start_ts} must be < now {now_ts}")
            raise HTTPException(400, "start_unix must be < now")
    else:
        start_ts = int((datetime.utcnow() - timedelta(days=req.days_back)).timestamp())

    # Set end timestamp
    if req.end_unix:
        end_ts = int(req.end_unix)
        if end_ts <= start_ts:
            logger.error(f"end_unix {end_ts} must be > start_unix {start_ts}")
            raise HTTPException(400, "end_unix must be > start_unix")
    else:
        end_ts = now_ts

    logger.info(f"Time range: {start_ts} ({datetime.fromtimestamp(start_ts)}) to {end_ts} ({datetime.fromtimestamp(end_ts)})")
    logger.info(f"Duration: {(end_ts - start_ts) / 3600:.2f} hours")

    out: list[SimulationResult] = []

    # Create session first, then create tasks
    session = aiohttp.ClientSession()
    try:
        # ------------------------------------------------------------------ #
        # 1) pull *all* history in parallel (limited only by aiohttp connector)
        # ------------------------------------------------------------------ #
        logger.info("Creating history fetch tasks...")
        hist_tasks: dict[str, asyncio.Task] = {
            m: asyncio.create_task(
                _cached_history(session, m, start_ts, req.timeframe_minutes, end_ts)
            )
            for m in req.tokens
        }

        # 2) We'll use the most recent close price from the ledger instead of making current price requests
        logger.info("Will use most recent close price from ledger data")

        # 3) assemble results
        logger.info("Processing results for each token...")
        for mint in req.tokens:
            logger.info(f"=== Processing token: {mint} ===")
            try:
                logger.info(f"Fetching history for {mint}...")
                res_hist = await hist_tasks[mint]
                if res_hist is None:
                    logger.error(f"History fetch failed for {mint}")
                    out.append(SimulationResult(token=mint, error="price fetch failed"))
                    continue

                mint, items = res_hist
                logger.info(f"Got {len(items)} history items for {mint}")
                if len(items) < 10:
                    logger.warning(f"Not enough data for {mint}: {len(items)} items (need >= 10)")
                    out.append(SimulationResult(token=mint, error="not enough data"))
                    continue

                logger.info(f"Building OHLC for {mint} with timeframe {req.timeframe_minutes} minutes...")
                df = build_ohlc(items, req.timeframe_minutes)
                logger.info(f"OHLC shape for {mint}: {df.shape}")
                if df.empty:
                    logger.error(f"Empty OHLC for {mint}")
                    out.append(SimulationResult(token=mint, error="empty ohlc"))
                    continue

                # Use the most recent close price from the OHLC data
                most_recent_close = float(df["close"].iloc[-1])
                logger.info(f"Using most recent close price for {mint}: ${most_recent_close}")

                logger.info(f"Running simulation for {mint}...")
                sim = run_simulation_with_ledger(
                    df,
                    req.amount_usd,
                    most_recent_close,
                    tp_r,
                    tp_s,
                    sl_r,
                    sl_s,
                )
                logger.info(f"Simulation result for {mint}: {sim}")
                out.append(SimulationResult(token=mint, **sim))

            except HTTPException:      # propagate 4xx back to caller
                logger.error(f"HTTPException for {mint}")
                raise
            except Exception as exc:   # everything else is logged + returned
                logger.exception(f"Simulation for {mint} failed")
                out.append(SimulationResult(token=mint, error=str(exc)))
    finally:
        # Ensure session is closed
        await session.close()

    logger.info(f"=== SIMULATION COMPLETE === Returning {len(out)} results")
    successful_tokens = 0
    failed_tokens = 0
    for result in out:
        if result.error:
            logger.error(f"Token {result.token}: {result.error}")
            failed_tokens += 1
        else:
            logger.info(f"Token {result.token}: Success - ledger points: {len(result.ledger) if result.ledger else 0}")
            successful_tokens += 1
    
    logger.info(f"Summary: {successful_tokens} successful, {failed_tokens} failed out of {len(req.tokens)} total tokens")
    return out


# ---------------------------------------------------------------------------
# Everything else – token info, trades, etc. – UNCHANGED (import from orig)
# ---------------------------------------------------------------------------

# ... (place the unchanged endpoints / helper functions here)

# ---------------------------------------------------------------------------
# CoinGecko Bulk Price Endpoint
# ---------------------------------------------------------------------------

class BulkPriceRequest(BaseModel):
    tokens: List[str]

class TokenPriceResult(BaseModel):
    token: str
    price: float
    market_cap: float
    error: Optional[str] = None

class TokenBreakdown(BaseModel):
    token: str
    trade_id: str = ""  # Unique identifier for this specific trade
    time_called: str = ""  # ISO string of when the trade was called
    entry_price: float = 0.0
    final_price: float = 0.0
    ath_price: float = 0.0
    ath_percentage: float = 0.0
    total_pnl: float = 0.0
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    coins_left: float = 0.0
    max_drawdown: float = 0.0
    roi_to_date: float = 0.0
    tps_hit: List[float] = []
    sls_hit: List[float] = []
    error: Optional[str] = None

async def try_birdeye_fallback(session: aiohttp.ClientSession, token: str) -> Optional[TokenPriceResult]:
    """
    Try to get token price and market cap from Birdeye as the ultimate fallback.
    """
    try:
        url = f"https://public-api.birdeye.so/public/token_price?address={token}"
        headers = {
            'accept': 'application/json',
        }
        
        # Try all API keys
        success, data, used_key = await try_all_birdeye_keys(session, url, headers=headers)
        
        if not success:
            logger.warning(f"All Birdeye API keys failed for {token}")
            return None
            
        price = data.get('data', {}).get('value', 0)
        if not price or price == 0:
            logger.warning(f"No price data from Birdeye for {token}")
            return None
            
        # Try to get supply for market cap calculation
        supply = 1e9
        try:
            supply_url = f"{os.environ.get('NEXT_PUBLIC_API_URL', 'http://localhost:8000')}/api/token-supply?address={token}"
            async with session.get(supply_url, timeout=aiohttp.ClientTimeout(total=HTTP_TIMEOUT)) as supply_response:
                if supply_response.ok:
                    supply_data = await supply_response.json()
                    supply = supply_data.get('circulating_supply') or supply_data.get('total_supply') or 1e9
        except Exception as e:
            logger.warning(f"Could not fetch supply for {token} from API in Birdeye fallback: {e}")
            
        market_cap = price * supply
        logger.info(f"Birdeye fallback success for {token}: price=${price}, market_cap=${market_cap} (using key: {used_key[:10]}...{used_key[-4:]})")
        return TokenPriceResult(
            token=token,
            price=price,
            market_cap=market_cap
        )
    except Exception as e:
        logger.error(f"Error in Birdeye fallback for {token}: {e}")
        return None

@app.post("/api/bulk-token-prices", response_model=List[TokenPriceResult])
async def bulk_token_prices(req: BulkPriceRequest):
    """
    Fetch current prices for multiple tokens using CoinGecko API with DexScreener and Birdeye fallback.
    """
    if not req.tokens:
        raise HTTPException(400, "No tokens provided")
    
    BATCH_SIZE = 100
    results = []
    for i in range(0, len(req.tokens), BATCH_SIZE):
        batch = req.tokens[i:i + BATCH_SIZE]
        contract_addresses = ",".join(batch)
        try:
            # Add rate limiting delay
            await asyncio.sleep(REQUEST_DELAY_SECONDS)
            
            url = f"https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses={contract_addresses}&vs_currencies=usd"
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    headers={
                        "accept": "application/json",
                        "x-cg-demo-api-key": COINGECKO_API_KEY
                    },
                    timeout=aiohttp.ClientTimeout(total=HTTP_TIMEOUT)
                ) as response:
                    if not response.ok:
                        logger.error(f"CoinGecko API error: {response.status}")
                        for token in batch:
                            results.append(TokenPriceResult(
                                token=token,
                                price=0,
                                market_cap=0,
                                error=f"CoinGecko API error: {response.status}"
                            ))
                        continue
                    price_data = await response.json()
                    for token in batch:
                        if token in price_data and "usd" in price_data[token]:
                            price = price_data[token]["usd"]
                            market_cap = price * 1e9
                            results.append(TokenPriceResult(
                                token=token,
                                price=price,
                                market_cap=market_cap
                            ))
                        else:
                            logger.info(f"CoinGecko no data for {token}, trying DexScreener...")
                            dexscreener_result = await try_dexscreener_fallback(session, token)
                            if dexscreener_result:
                                results.append(dexscreener_result)
                            else:
                                logger.info(f"DexScreener no data for {token}, trying Birdeye...")
                                birdeye_result = await try_birdeye_fallback(session, token)
                                if birdeye_result:
                                    results.append(birdeye_result)
                                else:
                                    results.append(TokenPriceResult(
                                        token=token,
                                        price=0,
                                        market_cap=0,
                                        error="Price not available from CoinGecko, DexScreener, or Birdeye"
                                    ))
            if i + BATCH_SIZE < len(req.tokens):
                await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"Error processing batch {i}-{i + BATCH_SIZE}: {e}")
            for token in batch:
                results.append(TokenPriceResult(
                    token=token,
                    price=0,
                    market_cap=0,
                    error=f"Batch processing failed: {str(e)}"
                ))
    return results

@app.post("/api/simulate/breakdown", response_model=List[TokenBreakdown])
async def simulate_with_breakdown(req: SimulationRequest) -> List[TokenBreakdown]:
    """
    Enhanced simulation endpoint that provides detailed token-by-token breakdown
    including entry price, ATH percentage, and detailed PnL analysis.
    """
    
    logger.info("=== SIMULATION BREAKDOWN REQUEST START ===")
    logger.info(f"Request tokens: {req.tokens}")
    logger.info(f"Request amount_usd: {req.amount_usd}")
    logger.info(f"Request timeframe_minutes: {req.timeframe_minutes}")
    logger.info(f"Request days_back: {req.days_back}")
    logger.info(f"Request tp: {req.tp}")
    logger.info(f"Request sl: {req.sl}")

    if not BIRDEYE_API_KEYS:
        logger.error("BIRDEYE_API_KEY not set")
        raise HTTPException(500, "BIRDEYE_API_KEY not set")

    bad = [t for t in req.tokens if not is_valid_solana_address(t)]
    if bad:
        logger.error(f"Invalid Solana address(es): {', '.join(bad)}")
        raise HTTPException(400, f"Invalid Solana address(es): {', '.join(bad)}")

    logger.info("Parsing ladder levels...")
    tp_r, tp_s = _parse_ladder(req.tp)
    sl_r, sl_s = _parse_ladder(req.sl)
    logger.info(f"TP ratios: {tp_r}, TP sizes: {tp_s}")
    logger.info(f"SL ratios: {sl_r}, SL sizes: {sl_s}")

    now_ts = int(datetime.utcnow().timestamp())
    if req.start_unix:
        start_ts = int(req.start_unix)
        if start_ts >= now_ts:
            logger.error(f"start_unix {start_ts} must be < now {now_ts}")
            raise HTTPException(400, "start_unix must be < now")
    else:
        start_ts = int((datetime.utcnow() - timedelta(days=req.days_back)).timestamp())

    # Set end timestamp
    if req.end_unix:
        end_ts = int(req.end_unix)
        if end_ts <= start_ts:
            logger.error(f"end_unix {end_ts} must be > start_unix {start_ts}")
            raise HTTPException(400, "end_unix must be > start_unix")
    else:
        end_ts = now_ts

    logger.info(f"Time range: {start_ts} ({datetime.fromtimestamp(start_ts)}) to {end_ts} ({datetime.fromtimestamp(end_ts)})")
    logger.info(f"Duration: {(end_ts - start_ts) / 3600:.2f} hours")

    out: list[TokenBreakdown] = []

    # Create session first, then create tasks
    session = aiohttp.ClientSession()
    try:
        # Pull all history in parallel
        logger.info("Creating history fetch tasks...")
        hist_tasks: dict[str, asyncio.Task] = {
            m: asyncio.create_task(
                _cached_history(session, m, start_ts, req.timeframe_minutes, end_ts)
            )
            for m in req.tokens
        }

        # Process results for each token
        logger.info("Processing results for each token...")
        for mint in req.tokens:
            logger.info(f"=== Processing token: {mint} ===")
            try:
                logger.info(f"Fetching history for {mint}...")
                res_hist = await hist_tasks[mint]
                if res_hist is None:
                    logger.error(f"History fetch failed for {mint}")
                    out.append(TokenBreakdown(token=mint, error="Price data fetch failed"))
                    continue

                mint, items = res_hist
                logger.info(f"Got {len(items)} history items for {mint}")
                if len(items) < 10:
                    logger.warning(f"Not enough data for {mint}: {len(items)} items (need >= 10)")
                    out.append(TokenBreakdown(token=mint, error="Insufficient price data (need at least 10 data points)"))
                    continue

                logger.info(f"Building OHLC for {mint} with timeframe {req.timeframe_minutes} minutes...")
                try:
                    df = build_ohlc(items, req.timeframe_minutes)
                    logger.info(f"OHLC shape for {mint}: {df.shape}")
                    if df.empty:
                        logger.error(f"Empty OHLC for {mint}")
                        out.append(TokenBreakdown(token=mint, error="No OHLC data available"))
                        continue
                except Exception as ohlc_exc:
                    logger.error(f"OHLC building failed for {mint}: {ohlc_exc}")
                    out.append(TokenBreakdown(token=mint, error=f"OHLC building failed: {str(ohlc_exc)}"))
                    continue

                # Calculate key metrics using the original price data from API
                try:
                    # Get the original price data from the API response
                    original_prices = [item["value"] for item in items if item.get("value", 0) > 0]
                    
                    if not original_prices:
                        logger.error(f"No valid prices found for {mint}")
                        out.append(TokenBreakdown(token=mint, error="No valid price data"))
                        continue
                    
                    entry_price = float(original_prices[0])  # First price from API
                    final_price = float(original_prices[-1])  # Last price from API
                    ath_price = float(max(original_prices))  # Highest price from API
                    
                    # Validate prices
                    if entry_price <= 0 or final_price <= 0 or ath_price <= 0:
                        logger.error(f"Invalid prices for {mint}: entry=${entry_price}, final=${final_price}, ath=${ath_price}")
                        out.append(TokenBreakdown(token=mint, error="Invalid price data"))
                        continue
                    
                    ath_percentage = ((ath_price - entry_price) / entry_price) * 100
                except Exception as price_exc:
                    logger.error(f"Price calculation failed for {mint}: {price_exc}")
                    out.append(TokenBreakdown(token=mint, error=f"Price calculation failed: {str(price_exc)}"))
                    continue
                
                logger.info(f"Price analysis for {mint}: Entry=${entry_price:.6f}, Final=${final_price:.6f}, ATH=${ath_price:.6f} ({ath_percentage:.2f}%)")
                logger.info(f"Price data points for {mint}: {len(original_prices)} points, range: ${min(original_prices):.6f} - ${max(original_prices):.6f}")

                # Use the actual final price from the API data
                most_recent_close = final_price  # This is already the final price from API
                if most_recent_close <= 0:
                    logger.error(f"Invalid most recent close price for {mint}: ${most_recent_close}")
                    out.append(TokenBreakdown(token=mint, error="Invalid most recent price"))
                    continue
                logger.info(f"Using final price from API for {mint}: ${most_recent_close}")

                logger.info(f"Running simulation for {mint}...")
                try:
                    sim = run_simulation_with_ledger(
                        df,
                        req.amount_usd,
                        most_recent_close,
                        tp_r,
                        tp_s,
                        sl_r,
                        sl_s,
                    )
                    
                    # Validate simulation results
                    if not sim or not isinstance(sim, dict):
                        logger.error(f"Invalid simulation result for {mint}: {sim}")
                        out.append(TokenBreakdown(token=mint, error="Invalid simulation result"))
                        continue
                    
                    # Calculate total PnL
                    realized_profit = sim.get("realized_profit", 0.0)
                    unrealized_profit = sim.get("unrealized_profit", 0.0)
                    total_pnl = realized_profit + unrealized_profit
                    
                    breakdown = TokenBreakdown(
                        token=mint,
                        entry_price=round(entry_price, 6),
                        final_price=round(final_price, 6),
                        ath_price=round(ath_price, 6),
                        ath_percentage=round(ath_percentage, 2),
                        total_pnl=round(total_pnl, 2),
                        realized_pnl=round(realized_profit, 2),
                        unrealized_pnl=round(unrealized_profit, 2),
                        coins_left=sim.get("coins_left", 0.0),
                        tps_hit=sim.get("tps_hit", []),
                        sls_hit=sim.get("sls_hit", [])
                    )
                    
                    logger.info(f"Breakdown for {mint}: Entry=${entry_price}, Final=${final_price}, ATH=${ath_price} ({ath_percentage:.2f}%), Total PnL=${total_pnl}")
                    out.append(breakdown)
                except Exception as sim_exc:
                    logger.error(f"Simulation failed for {mint}: {sim_exc}")
                    out.append(TokenBreakdown(token=mint, error=f"Simulation failed: {str(sim_exc)}"))

            except HTTPException:      # propagate 4xx back to caller
                logger.error(f"HTTPException for {mint}")
                raise
            except Exception as exc:   # everything else is logged + returned
                logger.exception(f"Simulation for {mint} failed")
                out.append(TokenBreakdown(token=mint, error=str(exc)))
    finally:
        # Ensure session is closed
        await session.close()

    logger.info(f"=== SIMULATION BREAKDOWN COMPLETE === Returning {len(out)} results")
    for result in out:
        if result.error:
            logger.error(f"Token {result.token}: {result.error}")
        else:
            logger.info(f"Token {result.token}: Success - Total PnL: ${result.total_pnl}")
    
    return out

@app.post("/api/simulate/breakdown/trades", response_model=List[TokenBreakdown])
async def simulate_with_breakdown_trades(req: TradeBasedSimulationRequest) -> List[TokenBreakdown]:
    """
    Enhanced simulation endpoint that uses individual trade dates for each token.
    Each trade starts at its specific date_called and runs until today.
    """
    
    logger.info("=== TRADE-BASED SIMULATION BREAKDOWN REQUEST START ===")
    logger.info(f"Request trades: {len(req.trades)}")
    logger.info(f"Request amount_usd: {req.amount_usd}")
    logger.info(f"Request timeframe_minutes: {req.timeframe_minutes}")
    logger.info(f"Request tp: {req.tp}")
    logger.info(f"Request sl: {req.sl}")

    if not BIRDEYE_API_KEYS:
        logger.error("BIRDEYE_API_KEY not set")
        raise HTTPException(500, "BIRDEYE_API_KEY not set")

    # Validate all tokens
    bad = [t.token for t in req.trades if not is_valid_solana_address(t.token)]
    if bad:
        logger.error(f"Invalid Solana address(es): {', '.join(bad)}")
        raise HTTPException(400, f"Invalid Solana address(es): {', '.join(bad)}")

    logger.info("Parsing ladder levels...")
    tp_r, tp_s = _parse_ladder(req.tp)
    sl_r, sl_s = _parse_ladder(req.sl)
    logger.info(f"TP ratios: {tp_r}, TP sizes: {tp_s}")
    logger.info(f"SL ratios: {sl_r}, SL sizes: {sl_s}")

    now_ts = int(datetime.utcnow().timestamp())
    out: list[TokenBreakdown] = []

    # Create session first, then create tasks
    session = aiohttp.ClientSession()
    try:
        # Process each trade individually with its own start date
        logger.info("Processing each trade with individual start dates...")
        for trade in req.trades:
            mint = trade.token
            logger.info(f"=== Processing trade: {mint} ===")
            
            try:
                # Parse the date_called string to get start timestamp
                try:
                    # Try parsing as ISO format first
                    start_dt = datetime.fromisoformat(trade.date_called.replace('Z', '+00:00'))
                    start_ts = int(start_dt.timestamp())
                except ValueError:
                    # Fallback to other common formats
                    for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']:
                        try:
                            start_dt = datetime.strptime(trade.date_called, fmt)
                            start_ts = int(start_dt.timestamp())
                            break
                        except ValueError:
                            continue
                    else:
                        logger.error(f"Could not parse date_called for {mint}: {trade.date_called}")
                        out.append(TokenBreakdown(token=mint, error=f"Invalid date format: {trade.date_called}"))
                        continue

                if start_ts >= now_ts:
                    logger.error(f"start_ts {start_ts} must be < now {now_ts} for {mint}")
                    out.append(TokenBreakdown(token=mint, error="Trade date must be in the past"))
                    continue

                logger.info(f"Trade {mint}: Start time {start_ts} ({datetime.fromtimestamp(start_ts)}) to {now_ts} ({datetime.fromtimestamp(now_ts)})")
                logger.info(f"Duration: {(now_ts - start_ts) / 3600:.2f} hours")

                # Calculate optimal timeframe for this trade duration
                if req.use_auto_timeframe:
                    optimal_timeframe = calculate_optimal_timeframe(start_ts, now_ts)
                    logger.info(f"Using auto-calculated optimal timeframe: {optimal_timeframe} minutes for {mint}")
                else:
                    optimal_timeframe = req.timeframe_minutes
                    logger.info(f"Using manual timeframe: {optimal_timeframe} minutes for {mint}")

                # Fetch history for this specific trade with optimal timeframe
                logger.info(f"Fetching history for {mint} from {start_ts} to {now_ts} with {optimal_timeframe}m timeframe...")
                res_hist = await _cached_history(session, mint, start_ts, optimal_timeframe, now_ts)
                if res_hist is None:
                    logger.error(f"History fetch failed for {mint}")
                    out.append(TokenBreakdown(token=mint, error="Price data fetch failed"))
                    continue

                mint, items = res_hist
                logger.info(f"Got {len(items)} history items for {mint}")
                if len(items) < 10:
                    logger.warning(f"Not enough data for {mint}: {len(items)} items (need >= 10)")
                    out.append(TokenBreakdown(token=mint, error="Insufficient price data (need at least 10 data points)"))
                    continue

                logger.info(f"Building OHLC for {mint} with timeframe {optimal_timeframe} minutes...")
                try:
                    df = build_ohlc(items, optimal_timeframe)
                    logger.info(f"OHLC shape for {mint}: {df.shape}")
                    if df.empty:
                        logger.error(f"Empty OHLC for {mint}")
                        out.append(TokenBreakdown(token=mint, error="No OHLC data available"))
                        continue
                except Exception as ohlc_exc:
                    logger.error(f"OHLC building failed for {mint}: {ohlc_exc}")
                    out.append(TokenBreakdown(token=mint, error=f"OHLC building failed: {str(ohlc_exc)}"))
                    continue

                # Calculate key metrics using the original price data from API
                try:
                    # Get the original price data from the API response
                    original_prices = [item['value'] for item in items if 'value' in item and item['value'] > 0]
                    if not original_prices:
                        logger.error(f"No valid prices in API response for {mint}")
                        out.append(TokenBreakdown(token=mint, error="No valid price data in API response"))
                        continue

                    entry_price = original_prices[0]  # First price in the series
                    final_price = original_prices[-1]  # Last price in the series
                    ath_price = max(original_prices)  # Highest price reached
                    ath_percentage = ((ath_price - entry_price) / entry_price) * 100 if entry_price > 0 else 0

                    # Run simulation
                    logger.info(f"Running simulation for {mint}...")
                    sim = run_simulation_with_ledger(
                        df, req.amount_usd, final_price, tp_r, tp_s, sl_r, sl_s
                    )

                    # Extract results
                    realized_pnl = sim.get("realized_profit", 0.0)
                    unrealized_pnl = sim.get("unrealized_profit", 0.0)
                    total_pnl = realized_pnl + unrealized_pnl
                    coins_left = sim.get("coins_left", 0.0)
                    
                    # Calculate max drawdown and ROI
                    ledger = sim.get("ledger", [])
                    max_drawdown = 0.0
                    roi_to_date = 0.0
                    
                    if ledger:
                        # Calculate max drawdown from ledger
                        peak_value = req.amount_usd  # Start with initial investment
                        max_drawdown = 0.0
                        
                        for entry in ledger:
                            current_value = entry.get("value", 0.0) + entry.get("realized", 0.0)
                            if current_value > peak_value:
                                peak_value = current_value
                            else:
                                drawdown = (peak_value - current_value) / peak_value if peak_value > 0 else 0
                                max_drawdown = max(max_drawdown, drawdown)
                        
                        # Calculate ROI to date
                        final_value = ledger[-1].get("value", 0.0) + ledger[-1].get("realized", 0.0)
                        roi_to_date = ((final_value - req.amount_usd) / req.amount_usd) * 100 if req.amount_usd > 0 else 0

                    # Validate prices are positive
                    if entry_price <= 0 or final_price <= 0 or ath_price <= 0:
                        logger.error(f"Invalid prices for {mint}: entry={entry_price}, final={final_price}, ath={ath_price}")
                        out.append(TokenBreakdown(token=mint, error="Invalid price data (non-positive values)"))
                        continue

                    # Create unique trade ID
                    trade_id = f"{mint}_{int(datetime.fromisoformat(trade.date_called.replace('Z', '+00:00')).timestamp())}"
                    
                    breakdown = TokenBreakdown(
                        token=mint,
                        trade_id=trade_id,
                        time_called=trade.date_called,
                        entry_price=entry_price,
                        final_price=final_price,
                        ath_price=ath_price,
                        ath_percentage=ath_percentage,
                        total_pnl=total_pnl,
                        realized_pnl=realized_pnl,
                        unrealized_pnl=unrealized_pnl,
                        coins_left=coins_left,
                        max_drawdown=max_drawdown * 100,  # Convert to percentage
                        roi_to_date=roi_to_date,
                        tps_hit=sim.get("tps_hit", []),
                        sls_hit=sim.get("sls_hit", [])
                    )
                    
                    logger.info(f"Breakdown for {mint}: Entry=${entry_price}, Final=${final_price}, ATH=${ath_price} ({ath_percentage:.2f}%), Total PnL=${total_pnl}")
                    out.append(breakdown)
                except Exception as sim_exc:
                    logger.error(f"Simulation failed for {mint}: {sim_exc}")
                    out.append(TokenBreakdown(token=mint, error=f"Simulation failed: {str(sim_exc)}"))

            except HTTPException:      # propagate 4xx back to caller
                logger.error(f"HTTPException for {mint}")
                raise
            except Exception as exc:   # everything else is logged + returned
                logger.exception(f"Simulation for {mint} failed")
                out.append(TokenBreakdown(token=mint, error=str(exc)))
    finally:
        # Ensure session is closed
        await session.close()

    logger.info(f"=== TRADE-BASED SIMULATION BREAKDOWN COMPLETE === Returning {len(out)} results")
    for result in out:
        if result.error:
            logger.error(f"Token {result.token}: {result.error}")
        else:
            logger.info(f"Token {result.token}: Success - Total PnL: ${result.total_pnl}")
    
    return out

@app.post("/api/simulate/trades", response_model=list[SimulationResult])
async def simulate_trades(req: TradeBasedSimulationRequest) -> list[SimulationResult]:
    """
    Trade-based simulation endpoint that uses individual trade dates for each token.
    Each trade starts at its specific date_called and runs until today.
    Returns simulation results with ledgers for charting.
    """
    
    logger.info("=== TRADE-BASED SIMULATION REQUEST START ===")
    logger.info(f"Request trades: {len(req.trades)}")
    logger.info(f"Request amount_usd: {req.amount_usd}")
    logger.info(f"Request timeframe_minutes: {req.timeframe_minutes}")
    logger.info(f"Request tp: {req.tp}")
    logger.info(f"Request sl: {req.sl}")

    if not BIRDEYE_API_KEYS:
        logger.error("BIRDEYE_API_KEY not set")
        raise HTTPException(500, "BIRDEYE_API_KEY not set")

    # Validate all tokens
    bad = [t.token for t in req.trades if not is_valid_solana_address(t.token)]
    if bad:
        logger.error(f"Invalid Solana address(es): {', '.join(bad)}")
        raise HTTPException(400, f"Invalid Solana address(es): {', '.join(bad)}")

    logger.info("Parsing ladder levels...")
    tp_r, tp_s = _parse_ladder(req.tp)
    sl_r, sl_s = _parse_ladder(req.sl)
    logger.info(f"TP ratios: {tp_r}, TP sizes: {tp_s}")
    logger.info(f"SL ratios: {sl_r}, SL sizes: {sl_s}")

    now_ts = int(datetime.utcnow().timestamp())
    out: list[SimulationResult] = []

    # Create session first, then create tasks
    session = aiohttp.ClientSession()
    try:
        # Process each trade individually with its own start date
        logger.info("Processing each trade with individual start dates...")
        for trade in req.trades:
            mint = trade.token
            logger.info(f"=== Processing trade: {mint} ===")
            
            try:
                # Parse the date_called string to get start timestamp
                try:
                    # Try parsing as ISO format first
                    start_dt = datetime.fromisoformat(trade.date_called.replace('Z', '+00:00'))
                    start_ts = int(start_dt.timestamp())
                except ValueError:
                    # Fallback to other common formats
                    for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']:
                        try:
                            start_dt = datetime.strptime(trade.date_called, fmt)
                            start_ts = int(start_dt.timestamp())
                            break
                        except ValueError:
                            continue
                    else:
                        logger.error(f"Could not parse date_called for {mint}: {trade.date_called}")
                        out.append(SimulationResult(token=mint, error=f"Invalid date format: {trade.date_called}"))
                        continue

                if start_ts >= now_ts:
                    logger.error(f"start_ts {start_ts} must be < now {now_ts} for {mint}")
                    out.append(SimulationResult(token=mint, error="Trade date must be in the past"))
                    continue

                logger.info(f"Trade {mint}: Start time {start_ts} ({datetime.fromtimestamp(start_ts)}) to {now_ts} ({datetime.fromtimestamp(now_ts)})")
                logger.info(f"Duration: {(now_ts - start_ts) / 3600:.2f} hours")

                # Calculate optimal timeframe for this trade duration
                if req.use_auto_timeframe:
                    optimal_timeframe = calculate_optimal_timeframe(start_ts, now_ts)
                    logger.info(f"Using auto-calculated optimal timeframe: {optimal_timeframe} minutes for {mint}")
                else:
                    optimal_timeframe = req.timeframe_minutes
                    logger.info(f"Using manual timeframe: {optimal_timeframe} minutes for {mint}")

                # Fetch history for this specific trade with optimal timeframe
                logger.info(f"Fetching history for {mint} from {start_ts} to {now_ts} with {optimal_timeframe}m timeframe...")
                res_hist = await _cached_history(session, mint, start_ts, optimal_timeframe, now_ts)
                if res_hist is None:
                    logger.error(f"History fetch failed for {mint}")
                    out.append(SimulationResult(token=mint, error="Price data fetch failed"))
                    continue

                mint, items = res_hist
                logger.info(f"Got {len(items)} history items for {mint}")
                if len(items) < 10:
                    logger.warning(f"Not enough data for {mint}: {len(items)} items (need >= 10)")
                    out.append(SimulationResult(token=mint, error="Insufficient price data (need at least 10 data points)"))
                    continue

                logger.info(f"Building OHLC for {mint} with timeframe {optimal_timeframe} minutes...")
                try:
                    df = build_ohlc(items, optimal_timeframe)
                    logger.info(f"OHLC shape for {mint}: {df.shape}")
                    if df.empty:
                        logger.error(f"Empty OHLC for {mint}")
                        out.append(SimulationResult(token=mint, error="No OHLC data available"))
                        continue
                except Exception as ohlc_exc:
                    logger.error(f"OHLC building failed for {mint}: {ohlc_exc}")
                    out.append(SimulationResult(token=mint, error=f"OHLC building failed: {str(ohlc_exc)}"))
                    continue

                # Get entry price (first price in the data) and current price for mark-to-market
                entry_price = items[0]['value'] if items else 0.0
                current_price = items[-1]['value'] if items else 0.0

                # Run simulation with ledger
                logger.info(f"Running simulation for {mint}...")
                logger.info(f"Entry price: ${entry_price}, Final price: ${current_price}")
                logger.info(f"TP levels: {[entry_price * (1 + r) for r in tp_r]}")
                logger.info(f"SL levels: {[entry_price * (1 - r) for r in sl_r]}")
                
                sim = run_simulation_with_ledger(
                    df, req.amount_usd, current_price, tp_r, tp_s, sl_r, sl_s
                )

                # Extract results
                realized_pnl = sim.get("realized_pnl", 0.0)
                unrealized_pnl = sim.get("unrealized_pnl", 0.0)
                coins_left = sim.get("coins_left", 0.0)
                ledger = sim.get("ledger", [])
                tps_hit = sim.get("tps_hit", [])
                sls_hit = sim.get("sls_hit", [])
                
                logger.info(f"TPs hit: {tps_hit}, SLs hit: {sls_hit}")
                logger.info(f"Realized: ${realized_pnl}, Unrealized: ${unrealized_pnl}, Coins left: {coins_left}")

                # Convert ledger to PositionPoint objects
                position_points = []
                for pt in ledger:
                    position_points.append(PositionPoint(
                        ts=pt["ts"],
                        value=pt["value"],
                        coins_held=pt["coins_held"],
                        unrealized=pt["unrealized"],
                        realized=pt["realized"]
                    ))

                result = SimulationResult(
                    token=mint,
                    ledger=position_points,
                    realized_profit=realized_pnl,
                    unrealized_profit=unrealized_pnl,
                    coins_left=coins_left,
                    tps_hit=sim.get("tps_hit", []),
                    sls_hit=sim.get("sls_hit", [])
                )
                
                logger.info(f"Simulation for {mint}: Realized=${realized_pnl}, Unrealized=${unrealized_pnl}, Coins left={coins_left}")
                out.append(result)

            except HTTPException:      # propagate 4xx back to caller
                logger.error(f"HTTPException for {mint}")
                raise
            except Exception as exc:   # everything else is logged + returned
                logger.exception(f"Simulation for {mint} failed")
                out.append(SimulationResult(token=mint, error=str(exc)))
    finally:
        # Ensure session is closed
        await session.close()

    logger.info(f"=== TRADE-BASED SIMULATION COMPLETE === Returning {len(out)} results")
    for result in out:
        if result.error:
            logger.error(f"Token {result.token}: {result.error}")
        else:
            logger.info(f"Token {result.token}: Success - Realized: ${result.realized_profit}, Unrealized: ${result.unrealized_profit}")
    
    return out

async def try_dexscreener_fallback(session: aiohttp.ClientSession, token: str) -> Optional[TokenPriceResult]:
    """
    Try to get token price and market cap from DexScreener as fallback.
    """
    try:
        # Add rate limiting delay
        await asyncio.sleep(REQUEST_DELAY_SECONDS)
        
        url = f"https://api.dexscreener.com/latest/dex/tokens/{token}"
        async with session.get(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                'Referer': 'https://dexscreener.com/',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://dexscreener.com',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
            },
            timeout=aiohttp.ClientTimeout(total=HTTP_TIMEOUT)
        ) as response:
            if not response.ok:
                logger.warning(f"DexScreener API error for {token}: {response.status}")
                return None
            
            data = await response.json()
            pairs = data.get('pairs', [])
            
            if not pairs or len(pairs) == 0:
                logger.warning(f"No trading pairs found in DexScreener for {token}")
                return None
            
            # Get the first pair with valid market cap data
            for pair in pairs:
                market_cap = pair.get('marketCap', 0)
                fdv = pair.get('fdv', 0)
                price_usd = pair.get('priceUsd', '0')
                
                # Use the first valid market cap or FDV
                if market_cap and market_cap > 0:
                    price = float(price_usd) if price_usd and price_usd != '0' else 0
                    logger.info(f"DexScreener fallback success for {token}: price=${price}, market_cap=${market_cap}")
                    return TokenPriceResult(
                        token=token,
                        price=price,
                        market_cap=market_cap
                    )
                elif fdv and fdv > 0:
                    price = float(price_usd) if price_usd and price_usd != '0' else 0
                    logger.info(f"DexScreener fallback success for {token}: price=${price}, fdv=${fdv}")
                    return TokenPriceResult(
                        token=token,
                        price=price,
                        market_cap=fdv
                    )
            
            logger.warning(f"No valid market cap data in DexScreener for {token}")
            return None
            
    except Exception as e:
        logger.error(f"Error in DexScreener fallback for {token}: {e}")
        return None

# ---------------------------------------------------------------------------
# Dev entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

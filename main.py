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
from datetime import datetime, timedelta, timezone
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
import base58

import aiohttp
import async_timeout
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError, NoCredentialsError

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
if not os.path.exists("logs"):
    os.makedirs("logs")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("logs/log.log", mode="a"),
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
# DynamoDB Setup
# ---------------------------------------------------------------------------
# Initialize DynamoDB client with proper credential handling and table verification
traders_table = None
trades_table = None

try:
    # Get AWS configuration from environment (falls back to default boto3 credential chain)
    aws_region = os.getenv('AWS_REGION', 'us-east-1')
    aws_access_key_id = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_access_key = os.getenv('AWS_SECRET_ACCESS_KEY')

    # Build kwargs for boto3.resource - only include credentials if provided
    dynamodb_kwargs = {'region_name': aws_region}
    if aws_access_key_id and aws_secret_access_key:
        dynamodb_kwargs['aws_access_key_id'] = aws_access_key_id
        dynamodb_kwargs['aws_secret_access_key'] = aws_secret_access_key
        logger.info(f"Using explicit AWS credentials from environment variables")
    else:
        logger.info(f"Using default AWS credential chain (env vars, ~/.aws/credentials, or IAM role)")

    dynamodb = boto3.resource('dynamodb', **dynamodb_kwargs)

    TRADERS_TABLE = os.getenv('DYNAMODB_TRADER_STATISTICS', 'officialStats')
    TRADES_TABLE = os.getenv('DYNAMODB_TRADES_TABLE', 'officialCalls')

    # Verify tables exist before using them
    client = boto3.client('dynamodb', **dynamodb_kwargs)

    try:
        client.describe_table(TableName=TRADERS_TABLE)
        traders_table = dynamodb.Table(TRADERS_TABLE)
        
        logger.info(f"✓ DynamoDB table '{TRADERS_TABLE}' verified and ready")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            logger.warning(f"✗ DynamoDB table '{TRADERS_TABLE}' does not exist. Trader endpoints will return empty data.")
        else:
            logger.warning(f"✗ Cannot access table '{TRADERS_TABLE}': {e}. Trader endpoints will return empty data.")

    try:
        client.describe_table(TableName=TRADES_TABLE)
        trades_table = dynamodb.Table(TRADES_TABLE)
        logger.info(f"✓ DynamoDB table '{TRADES_TABLE}' verified and ready")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            logger.warning(f"✗ DynamoDB table '{TRADES_TABLE}' does not exist. Trade endpoints will return empty data.")
        else:
            logger.warning(f"✗ Cannot access table '{TRADES_TABLE}': {e}. Trade endpoints will return empty data.")

except NoCredentialsError:
    logger.error(
        f"✗ AWS credentials not found. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY "
        f"environment variables, configure ~/.aws/credentials, or use an IAM role. "
        f"Region: {aws_region if 'aws_region' in locals() else 'us-east-1'}"
    )
except ClientError as e:
    logger.error(f"✗ DynamoDB client error: {e}. Check credentials and region. API will return empty data.")
except Exception as e:
    logger.warning(f"✗ DynamoDB initialization failed: {e}. API will return empty data.")

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

        return len(base58.b58decode(address)) == 32
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Trade Validation (Comprehensive)
# ---------------------------------------------------------------------------

class TradeValidationResult:
    """Result of trade validation."""
    def __init__(self):
        self.is_valid = True
        self.errors: List[str] = []

    def add_error(self, error: str):
        self.is_valid = False
        self.errors.append(error)


def validate_trade_data(
    token: str,
    date_called: str,
    entry_price: Optional[float] = None,
    current_price: Optional[float] = None,
    tokens_quantity: Optional[float] = None,
) -> TradeValidationResult:
    """
    Comprehensive trade validation. A trade is invalid if ANY of the following:
    - Missing/invalid token address
    - Missing or invalid timestamps
    - Missing price data for mark-to-market valuation
    - Zero or NaN token quantities
    - Missing entry price

    Invalid trades must be excluded from:
    - Trade tables
    - Summary metrics
    - Win-rate calculations
    - ROI calculations

    Returns TradeValidationResult with is_valid flag and list of errors.
    """
    result = TradeValidationResult()

    # Validate token address
    if not token or not isinstance(token, str):
        result.add_error("Missing token address")
    elif not is_valid_solana_address(token):
        result.add_error(f"Invalid Solana address format: {token[:20]}...")

    # Validate timestamp/date_called
    if not date_called or not isinstance(date_called, str):
        result.add_error("Missing or invalid date_called timestamp")
    else:
        try:
            # Try parsing various formats
            parsed = False
            for fmt in ['%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%dT%H:%M:%S.%f+00:00',
                        '%Y-%m-%dT%H:%M:%S+00:00', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']:
                try:
                    datetime.strptime(date_called.replace('Z', '').replace('+00:00', ''), fmt.replace('Z', '').replace('+00:00', ''))
                    parsed = True
                    break
                except ValueError:
                    continue
            if not parsed:
                # Try ISO format
                try:
                    datetime.fromisoformat(date_called.replace('Z', '+00:00'))
                    parsed = True
                except ValueError:
                    pass
            if not parsed:
                result.add_error(f"Cannot parse date_called: {date_called}")
        except Exception as e:
            result.add_error(f"Date validation error: {str(e)}")

    # Validate entry price (if provided)
    if entry_price is not None:
        if math.isnan(entry_price) or math.isinf(entry_price):
            result.add_error("Entry price is NaN or infinite")
        elif entry_price <= 0:
            result.add_error(f"Entry price must be positive, got: {entry_price}")

    # Validate current price for mark-to-market (if provided)
    if current_price is not None:
        if math.isnan(current_price) or math.isinf(current_price):
            result.add_error("Current price is NaN or infinite")
        elif current_price <= 0:
            result.add_error(f"Current price must be positive for mark-to-market, got: {current_price}")

    # Validate token quantity (if provided)
    if tokens_quantity is not None:
        if math.isnan(tokens_quantity) or math.isinf(tokens_quantity):
            result.add_error("Token quantity is NaN or infinite")
        elif tokens_quantity <= 0:
            result.add_error(f"Token quantity must be positive, got: {tokens_quantity}")

    return result


def validate_price_data(prices: List[float]) -> TradeValidationResult:
    """
    Validate a list of price data points.
    Returns TradeValidationResult with is_valid flag and list of errors.
    """
    result = TradeValidationResult()

    if not prices or len(prices) == 0:
        result.add_error("No price data available")
        return result

    # Check for NaN or invalid values
    valid_prices = []
    for i, price in enumerate(prices):
        if price is None:
            continue
        if math.isnan(price) or math.isinf(price):
            continue
        if price <= 0:
            continue
        valid_prices.append(price)

    if len(valid_prices) == 0:
        result.add_error("All price data points are invalid (NaN, infinite, or non-positive)")
    elif len(valid_prices) < 10:
        result.add_error(f"Insufficient valid price data: {len(valid_prices)} points (need at least 10)")

    return result


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

    @njit(cache=True, fastmath=True)
    def _ledger_core(
        timestamps: np.ndarray,     # int64 unix timestamps
        prices: np.ndarray,         # float64 close prices
        entry_coins: float,       # initial coin position
        start_cash_usd: float,    # initial USD invested
        tp_levels: np.ndarray,      # float64 TP price levels
        tp_sizes: np.ndarray,       # float64 TP sell fractions
        sl_levels: np.ndarray,      # float64 SL price levels
        sl_sizes: np.ndarray,       # float64 SL sell fractions
    ):
        """
        Numba-accelerated ledger building.
        Returns arrays for: (ts, value, coins_held, unrealized, realized, n_valid, tp_fired_mask, sl_fired_mask)
        """
        n_candles = prices.shape[0]
        n_tp = tp_levels.shape[0]
        n_sl = sl_levels.shape[0]

        # Pre-allocate output arrays (maximum size = n_candles)
        out_ts = np.empty(n_candles, dtype=np.int64)
        out_value = np.empty(n_candles, dtype=np.float64)
        out_coins = np.empty(n_candles, dtype=np.float64)
        out_unrealized = np.empty(n_candles, dtype=np.float64)
        out_realized = np.empty(n_candles, dtype=np.float64)

        # State tracking
        coins = entry_coins
        realized = 0.0
        tp_fired = np.zeros(n_tp, dtype=boolean)
        sl_fired = np.zeros(n_sl, dtype=boolean)

        valid_count = 0

        for j in range(n_candles):
            ts = timestamps[j]
            price = prices[j]

            # Check TP ladder
            for k in range(n_tp):
                if tp_fired[k] or coins <= 1e-12:
                    continue
                if price >= tp_levels[k]:
                    sell_qty = entry_coins * tp_sizes[k]
                    sell_qty = min(sell_qty, coins)
                    coins -= sell_qty
                    realized += sell_qty * tp_levels[k]
                    tp_fired[k] = True

            # Check SL ladder
            for k in range(n_sl):
                if sl_fired[k] or coins <= 1e-12:
                    continue
                if price <= sl_levels[k]:
                    sell_qty = entry_coins * sl_sizes[k]
                    sell_qty = min(sell_qty, coins)
                    coins -= sell_qty
                    realized += sl_levels[k] * sell_qty
                    sl_fired[k] = True

            # Record ledger point
            equity = coins * price
            unrealized = equity + realized - start_cash_usd

            out_ts[valid_count] = ts
            out_value[valid_count] = equity
            out_coins[valid_count] = coins
            out_unrealized[valid_count] = unrealized
            out_realized[valid_count] = realized
            valid_count += 1

            # Early exit if no position left
            if coins <= 1e-12:
                break

        return (out_ts[:valid_count], out_value[:valid_count],
                out_coins[:valid_count], out_unrealized[:valid_count],
                out_realized[:valid_count], valid_count, tp_fired, sl_fired)

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


def _ledger_core_py(
    timestamps: np.ndarray,
    prices: np.ndarray,
    entry_coins: float,
    start_cash_usd: float,
    tp_levels: np.ndarray,
    tp_sizes: np.ndarray,
    sl_levels: np.ndarray,
    sl_sizes: np.ndarray,
):
    """Pure-Python fallback for ledger building."""
    n_candles = len(prices)
    n_tp = len(tp_levels)
    n_sl = len(sl_levels)

    # Pre-allocate output arrays
    out_ts = np.empty(n_candles, dtype=np.int64)
    out_value = np.empty(n_candles, dtype=np.float64)
    out_coins = np.empty(n_candles, dtype=np.float64)
    out_unrealized = np.empty(n_candles, dtype=np.float64)
    out_realized = np.empty(n_candles, dtype=np.float64)

    coins = entry_coins
    realized = 0.0
    tp_fired = np.zeros(n_tp, dtype=bool)
    sl_fired = np.zeros(n_sl, dtype=bool)

    valid_count = 0

    for j in range(n_candles):
        ts = timestamps[j]
        price = prices[j]

        # Check TP ladder
        for k in range(n_tp):
            if tp_fired[k] or coins <= 1e-12:
                continue
            if price >= tp_levels[k]:
                sell_qty = min(entry_coins * tp_sizes[k], coins)
                coins -= sell_qty
                realized += sell_qty * tp_levels[k]
                tp_fired[k] = True

        # Check SL ladder
        for k in range(n_sl):
            if sl_fired[k] or coins <= 1e-12:
                continue
            if price <= sl_levels[k]:
                sell_qty = min(entry_coins * sl_sizes[k], coins)
                coins -= sell_qty
                realized += sl_levels[k] * sell_qty
                sl_fired[k] = True

        # Record ledger point
        equity = coins * price
        unrealized = equity + realized - start_cash_usd

        out_ts[valid_count] = ts
        out_value[valid_count] = equity
        out_coins[valid_count] = coins
        out_unrealized[valid_count] = unrealized
        out_realized[valid_count] = realized
        valid_count += 1

        if coins <= 1e-12:
            break

    return (out_ts[:valid_count], out_value[:valid_count],
            out_coins[:valid_count], out_unrealized[:valid_count],
            out_realized[:valid_count], valid_count, tp_fired, sl_fired)


# convenience aliases
_bt_engine = _bt_core if JIT_READY else _bt_core_py
_ledger_engine = _ledger_core if JIT_READY else _ledger_core_py

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
    """Convert API data points → OHLC DataFrame. The API already provides data at the requested interval.

    Optimized: Uses vectorized pandas operations instead of iterrows() for 10-100x speedup.
    """
    if not items:
        logger.error("No items provided to build_ohlc")
        return pd.DataFrame()

    try:
        # The API already returns data at the requested interval, so we just need to format it
        df = (
            pd.DataFrame(items)
            .rename(columns={"unixTime": "t", "value": "close"})
            .assign(t=lambda d: pd.to_datetime(d["t"], unit="s"))
        )

        if df.empty:
            logger.error("Empty DataFrame after initial processing")
            return pd.DataFrame()

        # Sort by timestamp to ensure proper order
        df = df.sort_values("t")

        # Vectorized OHLC construction - no iterrows() needed
        # Since the API returns data at requested intervals, use close for all OHLC values
        result = pd.DataFrame({
            "t": df["t"].values,
            "open": df["close"].values,
            "high": df["close"].values,
            "low": df["close"].values,
            "close": df["close"].values,
            "volume": np.nan
        })

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

    @field_validator("tp", "sl", mode="before")
    @classmethod
    def _default_ladders(cls, v, info):
        if v is None:
            return ["0.05:1.0"] if info.field_name == "tp" else []
        return v

# ---------------------------------------------------------------------------
# Trader/Trade API Models
# ---------------------------------------------------------------------------
class SparklineData(BaseModel):
    price: List[float] = Field(default_factory=list)

class Trade(BaseModel):
    ca: str
    caller: str
    date_called: str = ""
    high_time: str = ""
    low_time: str = ""
    initial_mc: float = 0.0
    current_mc: float = 0.0
    high_mc: float = 0.0
    low_mc: float = 0.0
    high_price: float = 0.0
    low_price: float = 0.0
    price_change_24h: float = 0
    volume_24h: float = 0
    liquidity: float = 0
    holders: int = 0
    market_cap_rank: int = 0
    market_cap_change_24h: float = 0
    market_cap_change_percentage_24h: float = 0
    market_cap_dominance: float = 0
    fully_diluted_valuation: float = 0
    total_volume: float = 0
    high_24h: float = 0
    low_24h: float = 0
    price_change_percentage_24h: float = 0
    price_change_percentage_7d: float = 0
    price_change_percentage_14d: float = 0
    price_change_percentage_30d: float = 0
    price_change_percentage_60d: float = 0
    price_change_percentage_200d: float = 0
    price_change_percentage_1y: float = 0
    market_cap_change_24h_in_currency: float = 0
    market_cap_change_percentage_24h_in_currency: float = 0
    total_supply: float = 0
    max_supply: float = 0
    circulating_supply: float = 0
    last_updated: str = ""
    sparkline_in_7d: SparklineData = Field(default_factory=SparklineData)
    price_change_percentage_1h_in_currency: float = 0
    price_change_percentage_24h_in_currency: float = 0
    price_change_percentage_7d_in_currency: float = 0
    price_change_percentage_14d_in_currency: float = 0
    price_change_percentage_30d_in_currency: float = 0
    price_change_percentage_60d_in_currency: float = 0
    price_change_percentage_200d_in_currency: float = 0
    price_change_percentage_1y_in_currency: float = 0
    roi: float = 0
    roi_at_high: float = 0
    roi_at_low: float = 0
    profit_at_high: float = 0
    profit_at_low: float = 0
    profit: float = 0
    is_winner: bool = False

class TraderStats(BaseModel):
    caller: str
    # Core stats (mapped from DynamoDB fields for backwards compatibility)
    win_rate: float = 0  # Mapped from win_rate_pct / 100
    total_calls: int = 0  # Mapped from n_calls
    winning_calls: int = 0  # Calculated from win_rate_pct * n_calls
    average_roi: float = 0  # Mapped from mean_ath_roi_pct / 100
    # New fields from officialStats table
    n_calls: int = 0
    win_rate_pct: float = 0
    mean_ath_roi_pct: float = 0
    median_ath_roi_pct: float = 0
    std_ath_roi_pct: float = 0
    mean_atl_roi_pct: float = 0
    best_roi_pct: float = 0
    worst_roi_pct: float = 0
    win_threshold_pct: float = 25
    win_rate_mc_p5: float = 0
    win_rate_mc_p50: float = 0
    win_rate_mc_p95: float = 0
    hit_2x_pct: float = 0
    hit_3x_pct: float = 0
    hit_5x_pct: float = 0
    hit_10x_pct: float = 0
    hit_20x_pct: float = 0
    hit_50x_pct: float = 0
    hit_100x_pct: float = 0
    sharpe_ratio: float = 0
    sortino_ratio: float = 0
    max_drawdown_pct: float = 0
    ev: float = 0
    ev_weighted: float = 0
    avg_days_to_ath: float = 0
    median_days_to_ath: float = 0
    avg_correlation_with_others: float = 0
    risk_score: float = 0
    consistency_score: float = 0
    first_call_date: str = ""
    last_call_date: str = ""
    computed_at: str = ""
    # Legacy fields for backwards compatibility
    micro_cap_roi: float = 0
    micro_cap_winrate: float = 0
    small_cap_roi: float = 0
    small_cap_winrate: float = 0
    mid_cap_roi: float = 0
    mid_cap_winrate: float = 0
    large_cap_roi: float = 0
    large_cap_winrate: float = 0
    mega_cap_roi: float = 0
    mega_cap_winrate: float = 0

class DeleteTradeRequest(BaseModel):
    caller: str
    ca: str
    date_called: str

# ---------------------------------------------------------------------------
# Helper function to convert DynamoDB items to Trade objects
# ---------------------------------------------------------------------------
def dynamodb_item_to_trade(item: dict) -> Trade:
    """
    Convert a DynamoDB item to a Trade object.
    If date_called is missing or empty but timestamp exists, convert timestamp to ISO string.
    Maps 'username' field to 'caller' if present for DynamoDB compatibility.
    """
    # Make a copy to avoid modifying the original
    trade_dict = dict(item)

    # Map username to caller if it exists
    if 'username' in trade_dict:
        trade_dict['caller'] = trade_dict.pop('username')

    # Check if date_called is missing or empty
    if not trade_dict.get('date_called') and trade_dict.get('timestamp'):
        try:
            # Convert Unix timestamp to ISO string
            timestamp_val = trade_dict['timestamp']
            # Handle Decimal type from DynamoDB
            if isinstance(timestamp_val, (int, float)):
                timestamp_int = int(timestamp_val)
            else:
                # Try to convert from Decimal or string
                timestamp_int = int(timestamp_val)

            # Convert to datetime and format as ISO string
            dt = datetime.fromtimestamp(timestamp_int)
            trade_dict['date_called'] = dt.isoformat()
            logger.debug(f"Converted timestamp {timestamp_int} to date_called {trade_dict['date_called']}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to convert timestamp to date_called: {e}")
            # Keep date_called empty if conversion fails

    return Trade(**trade_dict)

# ---------------------------------------------------------------------------
# FastAPI app & CORS
# ---------------------------------------------------------------------------
app = FastAPI(title="Solana Backtester API", version="0.3.0 (ladder)")

# ---------------------------------------------------------------------------
# Phantom Wallet Authentication Routes
# ---------------------------------------------------------------------------
# Import and include wallet authentication routes
try:
    from services.auth_api import router as wallet_auth_router
    app.include_router(wallet_auth_router)
    logger.info("Wallet authentication routes loaded successfully")
except Exception as e:
    logger.warning(f"Failed to load wallet authentication routes: {e}")
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
    Numba-accelerated ledger simulation.

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

    Optimization: Uses Numba JIT-compiled _ledger_engine for 10-50x speedup.
    """
    if df_ohlc.empty:
        raise ValueError("Empty OHLC dataframe")

    # -- constants ---------------------------------------------------------- #
    entry_price = float(df_ohlc["close"].iloc[0])
    entry_coins = start_cash_usd / entry_price

    # Build absolute price levels as numpy arrays for Numba
    tp_levels_arr = np.array([entry_price * (1 + r) for r in tp_ratios], dtype=np.float64)
    sl_levels_arr = np.array([entry_price * (1 - r) for r in sl_ratios], dtype=np.float64)
    tp_sizes_arr = np.array(tp_sizes, dtype=np.float64)
    sl_sizes_arr = np.array(sl_sizes, dtype=np.float64)

    # ---------------------------------------------------------------------- #
    # Extract arrays from DataFrame for Numba (avoiding iterrows)
    # ---------------------------------------------------------------------- #
    # Convert timestamps to unix seconds
    timestamps = df_ohlc["t"].apply(lambda x: int(x.timestamp())).values.astype(np.int64)
    prices = df_ohlc["close"].values.astype(np.float64)

    # ---------------------------------------------------------------------- #
    # Call Numba-accelerated ledger engine
    # ---------------------------------------------------------------------- #
    (out_ts, out_value, out_coins, out_unrealized, out_realized,
     n_valid, tp_fired_mask, sl_fired_mask) = _ledger_engine(
        timestamps, prices, entry_coins, start_cash_usd,
        tp_levels_arr, tp_sizes_arr, sl_levels_arr, sl_sizes_arr
    )

    # ---------------------------------------------------------------------- #
    # Build ledger list from Numba output arrays
    # ---------------------------------------------------------------------- #
    ledger: List[PositionPoint] = [
        PositionPoint(
            ts=int(out_ts[i]),
            value=float(out_value[i]),
            coins_held=float(out_coins[i]),
            unrealized=float(out_unrealized[i]),
            realized=float(out_realized[i]),
        )
        for i in range(n_valid)
    ]

    # Get final state from last ledger entry
    coins = float(out_coins[n_valid - 1]) if n_valid > 0 else entry_coins
    realized_proceeds = float(out_realized[n_valid - 1]) if n_valid > 0 else 0.0

    # ---------------------------------------------------------------------- #
    # CRITICAL: Proper PnL Calculations (per specification)
    # ---------------------------------------------------------------------- #
    # Tokens sold = entry_coins - coins (remaining)
    tokens_sold = entry_coins - coins
    # Cost basis of sold tokens
    cost_basis_sold = tokens_sold * entry_price

    # Realized PnL = sale proceeds - cost basis of coins sold
    # realized_pnl = sum((sell_price - avg_entry_price) * tokens_sold)
    realised_pl = realized_proceeds - cost_basis_sold

    # Mark-to-market: Value of remaining tokens at current price
    # Unrealized PnL = (current_price - avg_entry_price) * remaining_tokens
    mark_to_market_value = coins * current_price
    unrealized_pl = (current_price - entry_price) * coins

    # Final equity = cash from realized sales + mark-to-market value of remaining tokens
    # This equals: start_cash + total_pnl
    final_equity = realized_proceeds + mark_to_market_value

    # Total PnL = realized + unrealized
    total_pnl = realised_pl + unrealized_pl

    # Verify invariant: starting_equity + total_pnl = final_equity
    # start_cash_usd + total_pnl should equal final_equity
    invariant_check = abs((start_cash_usd + total_pnl) - final_equity)
    if invariant_check > 0.01:  # Allow small floating point errors
        logger.warning(f"PnL invariant violated: start={start_cash_usd}, total_pnl={total_pnl}, final={final_equity}, diff={invariant_check}")

    # Record final point with live price if different from last bar
    if not math.isclose(current_price, df_ohlc["close"].iloc[-1]):
        ledger.append(
            PositionPoint(
                ts=int(datetime.utcnow().timestamp()),
                value=float(mark_to_market_value),
                coins_held=float(coins),
                unrealized=float(unrealized_pl),
                realized=float(realised_pl),
            )
        )

    # Convert mask arrays to hit level lists
    tp_levels_list = tp_levels_arr.tolist()
    sl_levels_list = sl_levels_arr.tolist()
    tps_hit = [tp_levels_list[i] for i in range(len(tp_fired_mask)) if tp_fired_mask[i]]
    sls_hit = [sl_levels_list[i] for i in range(len(sl_fired_mask)) if sl_fired_mask[i]]

    return {
        "ledger":            [pt.dict() for pt in ledger],
        "realized_profit":   round(realised_pl, 6),
        "unrealized_profit": round(unrealized_pl, 6),
        "total_pnl":         round(total_pnl, 6),
        "coins_left":        round(coins, 6),
        "coins_initial":     round(entry_coins, 6),
        "entry_price":       round(entry_price, 10),
        "final_price":       round(current_price, 10),
        "final_equity":      round(final_equity, 6),
        "trade_capital":     round(start_cash_usd, 6),
        "tps_hit":           tps_hit,
        "sls_hit":           sls_hit,
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

    # Filter out invalid tokens instead of rejecting the whole request
    valid_tokens = [t for t in req.tokens if is_valid_solana_address(t)]
    invalid_tokens = [t for t in req.tokens if not is_valid_solana_address(t)]
    if invalid_tokens:
        logger.warning(f"Filtered out {len(invalid_tokens)} invalid Solana address(es): {', '.join(invalid_tokens[:5])}{'...' if len(invalid_tokens) > 5 else ''}")

    if not valid_tokens:
        raise HTTPException(400, "No valid Solana addresses provided")

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
        logger.info(f"Creating history fetch tasks for {len(valid_tokens)} valid tokens...")
        hist_tasks: dict[str, asyncio.Task] = {
            m: asyncio.create_task(
                _cached_history(session, m, start_ts, req.timeframe_minutes, end_ts)
            )
            for m in valid_tokens
        }

        # 2) We'll use the most recent close price from the ledger instead of making current price requests
        logger.info("Will use most recent close price from ledger data")

        # 3) assemble results
        logger.info("Processing results for each token...")
        for mint in valid_tokens:
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
    """
    Detailed breakdown of a single trade's performance.

    ROI Definitions:
    - trade_roi: Trade-specific ROI = total_pnl / trade_capital_allocated
      This is calculated per individual trade and does NOT depend on total account balance.
    - roi_to_date: Same as trade_roi (kept for backwards compatibility)

    PnL Definitions:
    - realized_pnl: Profit/loss from actual sells = sum((sell_price - avg_entry_price) * tokens_sold)
    - unrealized_pnl: Mark-to-market PnL from remaining tokens = (current_price - avg_entry_price) * remaining_tokens
    - total_pnl: realized_pnl + unrealized_pnl

    Final Value:
    - final_value: cash_balance + (remaining_tokens * current_market_price)

    Note: ATH price is for analytics/display ONLY, never used in PnL/ROI calculations.
    """
    token: str
    trade_id: str = ""  # Unique identifier for this specific trade
    time_called: str = ""  # ISO string of when the trade was called
    entry_price: float = 0.0
    final_price: float = 0.0  # Current market price (mark-to-market)
    ath_price: float = 0.0  # All-time high price (for display only, NOT used in calculations)
    ath_percentage: float = 0.0  # For display only
    total_pnl: float = 0.0  # realized_pnl + unrealized_pnl
    realized_pnl: float = 0.0  # From actual sells
    unrealized_pnl: float = 0.0  # Mark-to-market from remaining tokens
    coins_left: float = 0.0  # Remaining tokens
    coins_initial: float = 0.0  # Initial tokens purchased
    trade_capital: float = 0.0  # USD spent on entries for this trade
    final_value: float = 0.0  # Cash from sells + remaining tokens * current price
    max_drawdown: float = 0.0
    trade_roi: float = 0.0  # Trade ROI = total_pnl / trade_capital (NOT dependent on account balance)
    roi_to_date: float = 0.0  # Same as trade_roi (backwards compatibility)
    is_valid: bool = True  # Whether this trade has valid data
    validation_errors: List[str] = []  # List of validation issues if any
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

async def try_dexscreener_bulk(session: aiohttp.ClientSession, tokens: List[str]) -> Dict[str, TokenPriceResult]:
    """
    Try to get token prices and market caps from DexScreener v1 API in bulk.
    Uses the new /tokens/v1/{chainId}/{tokenAddresses} endpoint which supports
    up to 30 comma-separated addresses with a rate limit of 300 requests/minute.
    Returns a dict mapping token address to TokenPriceResult.
    """
    if not tokens:
        return {}

    try:
        # DexScreener v1 API supports up to 30 tokens per request
        MAX_TOKENS_PER_REQUEST = 30
        results = {}

        for i in range(0, len(tokens), MAX_TOKENS_PER_REQUEST):
            batch = tokens[i:i + MAX_TOKENS_PER_REQUEST]
            addresses = ",".join(batch)

            # Use smaller delay since rate limit is 300/min (5 requests/sec)
            await asyncio.sleep(0.5)

            # Use the new v1 API endpoint for Solana tokens
            url = f"https://api.dexscreener.com/tokens/v1/solana/{addresses}"

            async with session.get(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                },
                timeout=aiohttp.ClientTimeout(total=HTTP_TIMEOUT)
            ) as response:
                if not response.ok:
                    logger.warning(f"DexScreener v1 bulk API error: {response.status}")
                    continue

                data = await response.json()

                # v1 API returns array of pairs directly (not wrapped in 'pairs' key)
                pairs = data if isinstance(data, list) else data.get('pairs', [])

                if not pairs:
                    logger.warning(f"No pairs found in DexScreener v1 bulk response")
                    continue

                # Group pairs by base token address and select the best one (highest liquidity)
                token_pairs = {}
                for pair in pairs:
                    base_token = pair.get('baseToken', {})
                    token_address = base_token.get('address')

                    if token_address and token_address in batch:
                        if token_address not in token_pairs:
                            token_pairs[token_address] = []
                        token_pairs[token_address].append(pair)

                # Extract best pair for each token (prefer highest liquidity)
                for token_address, token_pair_list in token_pairs.items():
                    # Sort by liquidity (highest first)
                    sorted_pairs = sorted(
                        token_pair_list,
                        key=lambda p: p.get('liquidity', {}).get('usd', 0) or 0,
                        reverse=True
                    )

                    for pair in sorted_pairs:
                        market_cap = pair.get('marketCap', 0)
                        fdv = pair.get('fdv', 0)
                        price_usd = pair.get('priceUsd', '0')

                        if market_cap and market_cap > 0:
                            price = float(price_usd) if price_usd and price_usd != '0' else 0
                            results[token_address] = TokenPriceResult(
                                token=token_address,
                                price=price,
                                market_cap=market_cap
                            )
                            break
                        elif fdv and fdv > 0:
                            price = float(price_usd) if price_usd and price_usd != '0' else 0
                            results[token_address] = TokenPriceResult(
                                token=token_address,
                                price=price,
                                market_cap=fdv
                            )
                            break

        logger.info(f"DexScreener v1 bulk: found {len(results)}/{len(tokens)} tokens")
        return results

    except Exception as e:
        logger.error(f"Error in DexScreener v1 bulk request: {e}")
        return {}

async def try_birdeye_bulk(session: aiohttp.ClientSession, tokens: List[str]) -> Dict[str, TokenPriceResult]:
    """
    Try to get token prices from Birdeye multi_price endpoint in bulk.
    Returns a dict mapping token address to TokenPriceResult.
    """
    if not tokens:
        return {}

    try:
        # Birdeye multi_price supports up to 100 tokens per request
        MAX_TOKENS_PER_REQUEST = 100
        results = {}

        for i in range(0, len(tokens), MAX_TOKENS_PER_REQUEST):
            batch = tokens[i:i + MAX_TOKENS_PER_REQUEST]

            await asyncio.sleep(REQUEST_DELAY_SECONDS)

            # Use the defi/multi_price endpoint
            url = "https://public-api.birdeye.so/defi/multi_price"
            params = {
                "list_address": ",".join(batch)
            }

            # Try first API key only for bulk requests to avoid spamming
            if not BIRDEYE_API_KEYS:
                logger.warning("No Birdeye API keys available")
                return {}

            api_key = BIRDEYE_API_KEYS[0]
            headers = {
                'accept': 'application/json',
                'X-API-KEY': api_key,
            }

            async with session.get(
                url,
                params=params,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=HTTP_TIMEOUT)
            ) as response:
                if not response.ok:
                    logger.warning(f"Birdeye bulk API error: {response.status}")
                    # If rate limited, try next key
                    if response.status == 429 and len(BIRDEYE_API_KEYS) > 1:
                        logger.info("Trying next Birdeye API key...")
                        api_key = BIRDEYE_API_KEYS[1]
                        headers['X-API-KEY'] = api_key
                        await asyncio.sleep(2)

                        async with session.get(
                            url,
                            params=params,
                            headers=headers,
                            timeout=aiohttp.ClientTimeout(total=HTTP_TIMEOUT)
                        ) as retry_response:
                            if not retry_response.ok:
                                logger.warning(f"Birdeye bulk retry failed: {retry_response.status}")
                                continue
                            response = retry_response
                    else:
                        continue

                data = await response.json()
                price_data = data.get('data', {})

                if not price_data:
                    logger.warning("No data in Birdeye bulk response")
                    continue

                # Extract prices for each token
                for token_address in batch:
                    token_price_info = price_data.get(token_address)

                    if token_price_info:
                        price = token_price_info.get('value', 0)

                        if price and price > 0:
                            # Use default supply for market cap calculation
                            supply = 1e9
                            market_cap = price * supply

                            results[token_address] = TokenPriceResult(
                                token=token_address,
                                price=price,
                                market_cap=market_cap
                            )

        logger.info(f"Birdeye bulk: found {len(results)}/{len(tokens)} tokens")
        return results

    except Exception as e:
        logger.error(f"Error in Birdeye bulk request: {e}")
        return {}

@app.post("/api/bulk-token-prices", response_model=List[TokenPriceResult])
async def bulk_token_prices(req: BulkPriceRequest):
    """
    Fetch current prices for multiple tokens using DexScreener v1 API bulk.
    Optimized for speed - uses only DexScreener which has the best coverage for Solana tokens.
    """
    if not req.tokens:
        raise HTTPException(400, "No tokens provided")

    import time
    start_time = time.time()
    logger.info(f"📊 Bulk price request for {len(req.tokens)} tokens")

    # Track results by token address
    results_map: Dict[str, TokenPriceResult] = {}

    async with aiohttp.ClientSession() as session:
        # Use DexScreener v1 API bulk (best for Solana DEX tokens)
        dexscreener_results = await try_dexscreener_bulk(session, req.tokens)
        results_map.update(dexscreener_results)

        # For any tokens not found, return error results
        for token in req.tokens:
            if token not in results_map:
                results_map[token] = TokenPriceResult(
                    token=token,
                    price=0,
                    market_cap=0,
                    error="Price not available from DexScreener"
                )

    # Convert results_map to list in the same order as input tokens
    results = [results_map[token] for token in req.tokens]

    success_count = len([r for r in results if r.price > 0])
    total_time = time.time() - start_time
    logger.info(f"✅ Bulk API complete: {success_count}/{len(req.tokens)} tokens with prices in {total_time:.2f}s")

    return results


# ---------------------------------------------------------------------------
# DexScreener Token Info Models and Endpoints
# ---------------------------------------------------------------------------
class DexScreenerTokenInfo(BaseModel):
    """Token info from DexScreener v1 API"""
    address: str
    name: str
    symbol: str
    priceUsd: float
    priceNative: Optional[str] = None
    marketCap: Optional[float] = None
    fdv: Optional[float] = None
    volume24h: Optional[float] = None
    volume6h: Optional[float] = None
    volume1h: Optional[float] = None
    priceChange24h: Optional[float] = None
    priceChange6h: Optional[float] = None
    priceChange1h: Optional[float] = None
    liquidity: Optional[float] = None
    pairCreatedAt: Optional[int] = None
    txns24h: Optional[Dict[str, int]] = None


class DexScreenerPair(BaseModel):
    """Full pair info from DexScreener v1 API"""
    pairAddress: str
    dexId: str
    chainId: str
    baseToken: Dict[str, str]
    quoteToken: Dict[str, str]
    priceUsd: Optional[str] = None
    priceNative: Optional[str] = None
    marketCap: Optional[float] = None
    fdv: Optional[float] = None
    volume: Optional[Dict[str, float]] = None
    priceChange: Optional[Dict[str, float]] = None
    liquidity: Optional[Dict[str, float]] = None
    txns: Optional[Dict[str, Dict[str, int]]] = None
    pairCreatedAt: Optional[int] = None
    url: Optional[str] = None
    info: Optional[Dict[str, Any]] = None


@app.get("/api/dexscreener/token/{token_address}")
async def get_dexscreener_token_info(token_address: str) -> Dict[str, Any]:
    """
    Get token information from DexScreener v1 API.
    Uses the /tokens/v1/solana/{tokenAddress} endpoint.
    Rate limit: 300 requests per minute.

    Returns all pools/pairs for the token with full market data.
    """
    if not is_valid_solana_address(token_address):
        raise HTTPException(400, f"Invalid Solana address: {token_address}")

    try:
        async with aiohttp.ClientSession() as session:
            url = f"https://api.dexscreener.com/tokens/v1/solana/{token_address}"

            async with session.get(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                },
                timeout=aiohttp.ClientTimeout(total=HTTP_TIMEOUT)
            ) as response:
                if not response.ok:
                    logger.warning(f"DexScreener v1 API error for {token_address}: {response.status}")
                    raise HTTPException(response.status, f"DexScreener API error: {response.status}")

                data = await response.json()

                # v1 API returns array of pairs directly
                pairs = data if isinstance(data, list) else data.get('pairs', [])

                if not pairs:
                    return {
                        "success": False,
                        "token": token_address,
                        "message": "No trading pairs found for this token",
                        "pairs": []
                    }

                # Sort pairs by liquidity (highest first)
                sorted_pairs = sorted(
                    pairs,
                    key=lambda p: p.get('liquidity', {}).get('usd', 0) or 0,
                    reverse=True
                )

                # Get best pair info for summary
                best_pair = sorted_pairs[0]
                base_token = best_pair.get('baseToken', {})

                return {
                    "success": True,
                    "token": token_address,
                    "name": base_token.get('name', 'Unknown'),
                    "symbol": base_token.get('symbol', 'UNKNOWN'),
                    "priceUsd": float(best_pair.get('priceUsd', 0) or 0),
                    "marketCap": best_pair.get('marketCap', 0),
                    "fdv": best_pair.get('fdv', 0),
                    "volume": best_pair.get('volume', {}),
                    "priceChange": best_pair.get('priceChange', {}),
                    "liquidity": best_pair.get('liquidity', {}),
                    "txns": best_pair.get('txns', {}),
                    "pairCreatedAt": best_pair.get('pairCreatedAt'),
                    "totalPairs": len(sorted_pairs),
                    "pairs": sorted_pairs[:10]  # Return top 10 pairs by liquidity
                }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching DexScreener token info for {token_address}: {e}")
        raise HTTPException(500, f"Error fetching token info: {str(e)}")


@app.get("/api/dexscreener/pools/{token_address}")
async def get_dexscreener_token_pools(token_address: str) -> Dict[str, Any]:
    """
    Get token pools from DexScreener v1 API.
    Uses the /token-pairs/v1/solana/{tokenAddress} endpoint.
    Rate limit: 300 requests per minute.

    Returns all pools/pairs for the token.
    """
    if not is_valid_solana_address(token_address):
        raise HTTPException(400, f"Invalid Solana address: {token_address}")

    try:
        async with aiohttp.ClientSession() as session:
            url = f"https://api.dexscreener.com/token-pairs/v1/solana/{token_address}"

            async with session.get(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                },
                timeout=aiohttp.ClientTimeout(total=HTTP_TIMEOUT)
            ) as response:
                if not response.ok:
                    logger.warning(f"DexScreener pools API error for {token_address}: {response.status}")
                    raise HTTPException(response.status, f"DexScreener API error: {response.status}")

                data = await response.json()

                # v1 API returns array of pairs directly
                pairs = data if isinstance(data, list) else []

                if not pairs:
                    return {
                        "success": False,
                        "token": token_address,
                        "message": "No pools found for this token",
                        "pools": []
                    }

                # Sort pairs by liquidity (highest first)
                sorted_pairs = sorted(
                    pairs,
                    key=lambda p: p.get('liquidity', {}).get('usd', 0) or 0,
                    reverse=True
                )

                return {
                    "success": True,
                    "token": token_address,
                    "totalPools": len(sorted_pairs),
                    "pools": sorted_pairs
                }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching DexScreener pools for {token_address}: {e}")
        raise HTTPException(500, f"Error fetching token pools: {str(e)}")


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

    # Filter out invalid tokens instead of rejecting the whole request
    valid_tokens = [t for t in req.tokens if is_valid_solana_address(t)]
    invalid_tokens = [t for t in req.tokens if not is_valid_solana_address(t)]
    if invalid_tokens:
        logger.warning(f"Filtered out {len(invalid_tokens)} invalid Solana address(es): {', '.join(invalid_tokens[:5])}{'...' if len(invalid_tokens) > 5 else ''}")

    if not valid_tokens:
        raise HTTPException(400, "No valid Solana addresses provided")

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
        logger.info(f"Creating history fetch tasks for {len(valid_tokens)} valid tokens...")
        hist_tasks: dict[str, asyncio.Task] = {
            m: asyncio.create_task(
                _cached_history(session, m, start_ts, req.timeframe_minutes, end_ts)
            )
            for m in valid_tokens
        }

        # Process results for each token
        logger.info("Processing results for each token...")
        for mint in valid_tokens:
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

    ROI Definitions (STRICTLY SEPARATED):
    - Trade ROI: total_pnl / trade_capital_allocated (per individual trade, NOT dependent on account balance)
    - Account ROI: (final_account_equity - starting_account_equity) / starting_account_equity
      (calculated in summary statistics only)

    Final Equity Calculation:
    - final_equity = cash_balance + sum(remaining_tokens * current_market_price)

    Invalid Data Handling:
    - Trades with missing entry price, invalid timestamps, missing price data,
      or zero/NaN token quantities are marked as invalid
    - Invalid trades are excluded from summary metrics, win-rate, and ROI calculations
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
        logger.info(f"Processing {len(req.trades)} trades with individual start dates...")
        for trade in req.trades:
            mint = trade.token
            logger.info(f"=== Processing trade: {mint} ===")

            # Initialize validation errors list
            validation_errors: List[str] = []

            # Step 1: Comprehensive validation using validation function
            validation = validate_trade_data(
                token=mint,
                date_called=trade.date_called,
            )

            if not validation.is_valid:
                logger.warning(f"Trade validation failed for {mint}: {validation.errors}")
                # Create an invalid breakdown entry (excluded from metrics)
                out.append(TokenBreakdown(
                    token=mint,
                    time_called=trade.date_called,
                    is_valid=False,
                    validation_errors=validation.errors,
                    error="; ".join(validation.errors)
                ))
                continue

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
                        out.append(TokenBreakdown(
                            token=mint,
                            time_called=trade.date_called,
                            is_valid=False,
                            validation_errors=["Invalid date format"],
                            error=f"Invalid date format: {trade.date_called}"
                        ))
                        continue

                if start_ts >= now_ts:
                    logger.error(f"start_ts {start_ts} must be < now {now_ts} for {mint}")
                    out.append(TokenBreakdown(
                        token=mint,
                        time_called=trade.date_called,
                        is_valid=False,
                        validation_errors=["Trade date must be in the past"],
                        error="Trade date must be in the past"
                    ))
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
                    out.append(TokenBreakdown(
                        token=mint,
                        time_called=trade.date_called,
                        is_valid=False,
                        validation_errors=["Price data fetch failed"],
                        error="Price data fetch failed"
                    ))
                    continue

                mint, items = res_hist
                logger.info(f"Got {len(items)} history items for {mint}")

                # Validate price data
                original_prices = [item['value'] for item in items if 'value' in item and item.get('value', 0) > 0]
                price_validation = validate_price_data(original_prices)

                if not price_validation.is_valid:
                    logger.warning(f"Price validation failed for {mint}: {price_validation.errors}")
                    out.append(TokenBreakdown(
                        token=mint,
                        time_called=trade.date_called,
                        is_valid=False,
                        validation_errors=price_validation.errors,
                        error="; ".join(price_validation.errors)
                    ))
                    continue

                logger.info(f"Building OHLC for {mint} with timeframe {optimal_timeframe} minutes...")
                try:
                    df = build_ohlc(items, optimal_timeframe)
                    logger.info(f"OHLC shape for {mint}: {df.shape}")
                    if df.empty:
                        logger.error(f"Empty OHLC for {mint}")
                        out.append(TokenBreakdown(
                            token=mint,
                            time_called=trade.date_called,
                            is_valid=False,
                            validation_errors=["No OHLC data available"],
                            error="No OHLC data available"
                        ))
                        continue
                except Exception as ohlc_exc:
                    logger.error(f"OHLC building failed for {mint}: {ohlc_exc}")
                    out.append(TokenBreakdown(
                        token=mint,
                        time_called=trade.date_called,
                        is_valid=False,
                        validation_errors=[f"OHLC building failed: {str(ohlc_exc)}"],
                        error=f"OHLC building failed: {str(ohlc_exc)}"
                    ))
                    continue

                # Calculate key metrics using the original price data from API
                try:
                    entry_price = original_prices[0]  # First price in the series
                    final_price = original_prices[-1]  # Last price (current market price for mark-to-market)
                    ath_price = max(original_prices)  # Highest price reached (FOR DISPLAY ONLY)
                    ath_percentage = ((ath_price - entry_price) / entry_price) * 100 if entry_price > 0 else 0

                    # Final validation of prices
                    if entry_price <= 0 or final_price <= 0:
                        logger.error(f"Invalid prices for {mint}: entry={entry_price}, final={final_price}")
                        out.append(TokenBreakdown(
                            token=mint,
                            time_called=trade.date_called,
                            entry_price=entry_price,
                            final_price=final_price,
                            is_valid=False,
                            validation_errors=["Entry or final price is non-positive"],
                            error="Invalid price data (non-positive values)"
                        ))
                        continue

                    # Run simulation
                    logger.info(f"Running simulation for {mint}...")
                    sim = run_simulation_with_ledger(
                        df, req.amount_usd, final_price, tp_r, tp_s, sl_r, sl_s
                    )

                    # ------------------------------------------------------------------
                    # Extract results with PROPER CALCULATIONS
                    # ------------------------------------------------------------------
                    trade_capital = sim.get("trade_capital", req.amount_usd)
                    realized_pnl = sim.get("realized_profit", 0.0)
                    unrealized_pnl = sim.get("unrealized_profit", 0.0)
                    total_pnl = sim.get("total_pnl", realized_pnl + unrealized_pnl)
                    coins_left = sim.get("coins_left", 0.0)
                    coins_initial = sim.get("coins_initial", 0.0)
                    final_equity = sim.get("final_equity", 0.0)

                    # ------------------------------------------------------------------
                    # TRADE ROI CALCULATION (per specification)
                    # trade_roi = total_trade_pnl / trade_capital_allocated
                    # This is calculated per individual trade only, NOT dependent on account balance
                    # ------------------------------------------------------------------
                    trade_roi = (total_pnl / trade_capital * 100) if trade_capital > 0 else 0.0

                    # Calculate max drawdown from ledger
                    ledger = sim.get("ledger", [])
                    max_drawdown = 0.0

                    if ledger:
                        peak_value = trade_capital  # Start with initial investment
                        for entry in ledger:
                            # current_value = value of remaining tokens + realized cash
                            current_value = entry.get("value", 0.0) + entry.get("realized", 0.0)
                            if current_value > peak_value:
                                peak_value = current_value
                            else:
                                drawdown = (peak_value - current_value) / peak_value if peak_value > 0 else 0
                                max_drawdown = max(max_drawdown, drawdown)

                    # Create unique trade ID
                    trade_id = f"{mint}_{start_ts}"

                    # ------------------------------------------------------------------
                    # INVARIANT CHECK: realized_pnl + unrealized_pnl = total_pnl
                    # ------------------------------------------------------------------
                    invariant_diff = abs(total_pnl - (realized_pnl + unrealized_pnl))
                    if invariant_diff > 0.01:
                        logger.warning(f"PnL invariant warning for {mint}: total={total_pnl}, realized+unrealized={realized_pnl + unrealized_pnl}")

                    # ------------------------------------------------------------------
                    # INVARIANT CHECK: starting_equity + total_pnl = final_equity
                    # ------------------------------------------------------------------
                    equity_diff = abs((trade_capital + total_pnl) - final_equity)
                    if equity_diff > 0.01:
                        logger.warning(f"Equity invariant warning for {mint}: start+pnl={trade_capital + total_pnl}, final={final_equity}")

                    breakdown = TokenBreakdown(
                        token=mint,
                        trade_id=trade_id,
                        time_called=trade.date_called,
                        entry_price=round(entry_price, 10),
                        final_price=round(final_price, 10),  # Current market price (mark-to-market)
                        ath_price=round(ath_price, 10),  # FOR DISPLAY ONLY
                        ath_percentage=round(ath_percentage, 2),  # FOR DISPLAY ONLY
                        total_pnl=round(total_pnl, 6),
                        realized_pnl=round(realized_pnl, 6),
                        unrealized_pnl=round(unrealized_pnl, 6),
                        coins_left=round(coins_left, 10),
                        coins_initial=round(coins_initial, 10),
                        trade_capital=round(trade_capital, 6),
                        final_value=round(final_equity, 6),
                        max_drawdown=round(max_drawdown * 100, 2),  # Convert to percentage
                        trade_roi=round(trade_roi, 2),  # TRADE ROI (per specification)
                        roi_to_date=round(trade_roi, 2),  # Same as trade_roi (backwards compatibility)
                        is_valid=True,
                        validation_errors=[],
                        tps_hit=sim.get("tps_hit", []),
                        sls_hit=sim.get("sls_hit", [])
                    )

                    logger.info(f"Breakdown for {mint}: Entry=${entry_price:.10f}, Final=${final_price:.10f}, "
                               f"Trade ROI={trade_roi:.2f}%, Total PnL=${total_pnl:.2f}")
                    out.append(breakdown)

                except Exception as sim_exc:
                    logger.error(f"Simulation failed for {mint}: {sim_exc}")
                    out.append(TokenBreakdown(
                        token=mint,
                        time_called=trade.date_called,
                        is_valid=False,
                        validation_errors=[f"Simulation failed: {str(sim_exc)}"],
                        error=f"Simulation failed: {str(sim_exc)}"
                    ))

            except HTTPException:      # propagate 4xx back to caller
                logger.error(f"HTTPException for {mint}")
                raise
            except Exception as exc:   # everything else is logged + returned
                logger.exception(f"Simulation for {mint} failed")
                out.append(TokenBreakdown(
                    token=mint,
                    time_called=trade.date_called,
                    is_valid=False,
                    validation_errors=[str(exc)],
                    error=str(exc)
                ))
    finally:
        # Ensure session is closed
        await session.close()

    # Summary logging - count valid vs invalid trades
    valid_count = sum(1 for r in out if r.is_valid)
    invalid_count = sum(1 for r in out if not r.is_valid)

    logger.info(f"=== TRADE-BASED SIMULATION BREAKDOWN COMPLETE ===")
    logger.info(f"Total: {len(out)}, Valid: {valid_count}, Invalid: {invalid_count}")

    for result in out:
        if result.error or not result.is_valid:
            logger.error(f"Token {result.token}: INVALID - {result.error}")
        else:
            logger.info(f"Token {result.token}: VALID - Trade ROI: {result.trade_roi:.2f}%, Total PnL: ${result.total_pnl:.2f}")

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

    # Filter out invalid tokens instead of rejecting the whole request
    valid_trades = [t for t in req.trades if is_valid_solana_address(t.token)]
    invalid_trades = [t.token for t in req.trades if not is_valid_solana_address(t.token)]
    if invalid_trades:
        logger.warning(f"Filtered out {len(invalid_trades)} invalid Solana address(es): {', '.join(invalid_trades[:5])}{'...' if len(invalid_trades) > 5 else ''}")

    if not valid_trades:
        raise HTTPException(400, "No valid Solana addresses provided")

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
        logger.info(f"Processing {len(valid_trades)} valid trades with individual start dates...")
        for trade in valid_trades:
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
# Trader and Trade API Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/traders/stats")
async def get_trader_stats(
    winRateMin: Optional[float] = None,
    winRateMax: Optional[float] = None,
    totalCallsMin: Optional[int] = None,
    totalCallsMax: Optional[int] = None,
    roiMin: Optional[float] = None,
    roiMax: Optional[float] = None,
    search: Optional[str] = None
) -> List[TraderStats]:
    """
    Get trader statistics with optional filtering.
    """
    logger.info("GET /api/traders/stats")

    if traders_table is None:
        logger.warning("DynamoDB not available, returning empty list")
        return []

    try:
        # Scan with pagination to retrieve all items
        # Note: Using scan instead of query because filters are not on partition key
        # For production with large datasets, consider using FilterExpression on scan
        # or restructuring the table with GSI for better performance
        response = traders_table.scan()
        traders = response.get('Items', [])

        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = traders_table.scan(
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            traders.extend(response.get('Items', []))

        # Apply filters using DynamoDB field names
        def get_float(item, key, default=0):
            val = item.get(key, default)
            try:
                return float(val)
            except (TypeError, ValueError):
                return default

        def get_int(item, key, default=0):
            val = item.get(key, default)
            try:
                return int(val)
            except (TypeError, ValueError):
                return default

        if winRateMin is not None:
            traders = [t for t in traders if get_float(t, 'win_rate_pct', 0) >= winRateMin]
        if winRateMax is not None:
            traders = [t for t in traders if get_float(t, 'win_rate_pct', 0) <= winRateMax]
        if totalCallsMin is not None:
            traders = [t for t in traders if get_int(t, 'n_calls', 0) >= totalCallsMin]
        if totalCallsMax is not None:
            traders = [t for t in traders if get_int(t, 'n_calls', 0) <= totalCallsMax]
        if roiMin is not None:
            traders = [t for t in traders if get_float(t, 'mean_ath_roi_pct', 0) >= roiMin]
        if roiMax is not None:
            traders = [t for t in traders if get_float(t, 'mean_ath_roi_pct', 0) <= roiMax]
        if search:
            search_lower = search.lower()
            traders = [t for t in traders if search_lower in str(t.get('username', t.get('caller', ''))).lower()]

        if not traders:
            logger.warning("No traders found in DynamoDB")
            return []

        # Map DynamoDB fields to TraderStats model
        mapped_traders = []
        for t in traders:
            # Convert Decimal types to float/int and map field names
            def to_float(val):
                if val is None:
                    return 0.0
                try:
                    return float(val)
                except (TypeError, ValueError):
                    return 0.0

            def to_int(val):
                if val is None:
                    return 0
                try:
                    return int(val)
                except (TypeError, ValueError):
                    return 0

            # Get the caller name (from 'username' field in DynamoDB)
            caller = t.get('username', t.get('caller', ''))
            n_calls = to_int(t.get('n_calls', 0))
            win_rate_pct = to_float(t.get('win_rate_pct', 0))
            mean_ath_roi_pct = to_float(t.get('mean_ath_roi_pct', 0))

            trader_dict = {
                'caller': caller,
                # Legacy fields for backwards compatibility
                'win_rate': win_rate_pct / 100 if win_rate_pct else 0,
                'total_calls': n_calls,
                'winning_calls': int(n_calls * win_rate_pct / 100) if n_calls and win_rate_pct else 0,
                'average_roi': mean_ath_roi_pct / 100 if mean_ath_roi_pct else 0,
                # New fields from officialStats
                'n_calls': n_calls,
                'win_rate_pct': win_rate_pct,
                'mean_ath_roi_pct': mean_ath_roi_pct,
                'median_ath_roi_pct': to_float(t.get('median_ath_roi_pct', 0)),
                'std_ath_roi_pct': to_float(t.get('std_ath_roi_pct', 0)),
                'mean_atl_roi_pct': to_float(t.get('mean_atl_roi_pct', 0)),
                'best_roi_pct': to_float(t.get('best_roi_pct', 0)),
                'worst_roi_pct': to_float(t.get('worst_roi_pct', 0)),
                'win_threshold_pct': to_float(t.get('win_threshold_pct', 25)),
                'win_rate_mc_p5': to_float(t.get('win_rate_mc_p5', 0)),
                'win_rate_mc_p50': to_float(t.get('win_rate_mc_p50', 0)),
                'win_rate_mc_p95': to_float(t.get('win_rate_mc_p95', 0)),
                'hit_2x_pct': to_float(t.get('hit_2x_pct', 0)),
                'hit_3x_pct': to_float(t.get('hit_3x_pct', 0)),
                'hit_5x_pct': to_float(t.get('hit_5x_pct', 0)),
                'hit_10x_pct': to_float(t.get('hit_10x_pct', 0)),
                'hit_20x_pct': to_float(t.get('hit_20x_pct', 0)),
                'hit_50x_pct': to_float(t.get('hit_50x_pct', 0)),
                'hit_100x_pct': to_float(t.get('hit_100x_pct', 0)),
                'sharpe_ratio': to_float(t.get('sharpe_ratio', 0)),
                'sortino_ratio': to_float(t.get('sortino_ratio', 0)),
                'max_drawdown_pct': to_float(t.get('max_drawdown_pct', 0)),
                'ev': to_float(t.get('ev', 0)),
                'ev_weighted': to_float(t.get('ev_weighted', 0)),
                'avg_days_to_ath': to_float(t.get('avg_days_to_ath', 0)),
                'median_days_to_ath': to_float(t.get('median_days_to_ath', 0)),
                'avg_correlation_with_others': to_float(t.get('avg_correlation_with_others', 0)),
                'risk_score': to_float(t.get('risk_score', 0)),
                'consistency_score': to_float(t.get('consistency_score', 0)),
                'first_call_date': str(t.get('first_call_date', '')),
                'last_call_date': str(t.get('last_call_date', '')),
                'computed_at': str(t.get('computed_at', '')),
            }
            mapped_traders.append(TraderStats(**trader_dict))

        return mapped_traders
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            logger.error(f"Table not found: {e}")
        elif error_code == 'AccessDeniedException':
            logger.error(f"Access denied to DynamoDB table: {e}")
        else:
            logger.error(f"DynamoDB client error fetching trader stats: {e}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error fetching trader stats: {e}")
        return []

@app.get("/api/traders/{caller}/trades")
async def get_trader_trades(
    caller: str,
    limit: Optional[int] = None,
    offset: Optional[int] = None
) -> List[Trade]:
    """
    Get trades for a specific trader with optional pagination.

    Args:
        caller: The trader's identifier
        limit: Maximum number of trades to return (optional)
        offset: Number of trades to skip (optional)
    """
    logger.info(f"GET /api/traders/{caller}/trades - limit={limit}, offset={offset}")

    if trades_table is None:
        logger.warning("DynamoDB not available, returning empty list")
        return []

    try:
        from urllib.parse import unquote
        decoded_caller = unquote(caller)

        # Query with pagination (caller is the partition key in DynamoDB index)
        response = trades_table.query(
            IndexName='caller',
            KeyConditionExpression=Key('caller').eq(decoded_caller)
        )
        trades = response.get('Items', [])

        # Handle DynamoDB pagination to get all results
        while 'LastEvaluatedKey' in response:
            response = trades_table.query(
                IndexName='caller',
                KeyConditionExpression=Key('caller').eq(decoded_caller),
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            trades.extend(response.get('Items', []))

        if not trades:
            logger.warning(f"No trades found for caller: {decoded_caller}")
            return []

        # Sort by date_called descending (most recent first)
        def get_date_value(trade):
            date_val = trade.get('date_called', 0)
            if isinstance(date_val, str):
                try:
                    return float(date_val)
                except ValueError:
                    return 0
            return date_val

        trades.sort(key=get_date_value, reverse=True)

        # Apply offset and limit for pagination
        if offset is not None and offset > 0:
            trades = trades[offset:]
        if limit is not None and limit > 0:
            trades = trades[:limit]

        logger.info(f"Returning {len(trades)} trades for {decoded_caller}")
        return [dynamodb_item_to_trade(t) for t in trades]
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            logger.error(f"Table not found: {e}")
        elif error_code == 'AccessDeniedException':
            logger.error(f"Access denied to DynamoDB table: {e}")
        else:
            logger.error(f"DynamoDB client error fetching trades for {caller}: {e}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error fetching trades for {caller}: {e}")
        return []

@app.get("/api/trades")
async def get_all_trades() -> List[Trade]:
    """
    Get all trades (unfiltered).
    """
    logger.info("GET /api/trades")

    if trades_table is None:
        logger.warning("DynamoDB not available, returning empty list")
        return []

    try:
        # Scan with pagination to retrieve all trades
        response = trades_table.scan()
        trades = response.get('Items', [])

        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = trades_table.scan(
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            trades.extend(response.get('Items', []))

        if not trades:
            logger.warning("No trades found in DynamoDB")

        return [dynamodb_item_to_trade(t) for t in trades]
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            logger.error(f"Table not found: {e}")
        elif error_code == 'AccessDeniedException':
            logger.error(f"Access denied to DynamoDB table: {e}")
        else:
            logger.error(f"DynamoDB client error fetching all trades: {e}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error fetching all trades: {e}")
        return []

def parse_and_validate_date(date_str: Optional[str], param_name: str, default: Optional[datetime] = None) -> Optional[datetime]:
    """
    Parse and validate a date parameter with robust error handling.

    Args:
        date_str: The date string to parse (can be None)
        param_name: Name of the parameter (for logging)
        default: Default datetime to return if parsing fails

    Returns:
        Parsed datetime object or default value
    """
    if not date_str:
        return default

    # Log the raw parameter value
    logger.info(f"Parsing {param_name}: raw value = '{date_str}'")

    # Validate basic structure - must contain date part (YYYY-MM-DD or similar)
    if len(date_str) < 10:
        logger.warning(f"Invalid {param_name} - too short ('{date_str}'). Using default.")
        return default

    # Check if it starts with a digit (valid date should start with year)
    if not date_str[0].isdigit():
        logger.warning(f"Invalid {param_name} - doesn't start with digit ('{date_str}'). Using default.")
        return default

    try:
        # Normalize the date string - handle both Z and +00:00 formats
        normalized = date_str.replace('Z', '+00:00')
        parsed_dt = datetime.fromisoformat(normalized)
        logger.info(f"Successfully parsed {param_name}: {parsed_dt.isoformat()}")
        return parsed_dt
    except (ValueError, AttributeError) as e:
        logger.error(f"Failed to parse {param_name} '{date_str}': {e}. Using default.")
        return default

@app.get("/api/trades/filtered")
async def get_filtered_trades(
    roiMin: Optional[float] = None,
    roiMax: Optional[float] = None,
    mcMin: Optional[float] = None,
    mcMax: Optional[float] = None,
    dateFrom: Optional[int] = None,
    dateTo: Optional[int] = None,
    search: Optional[str] = None,
    trader: Optional[str] = None,
    timeframe: Optional[str] = None
) -> List[Trade]:
    """
    Get filtered trades based on various criteria.
    Dates are expected as Unix timestamps (seconds since epoch).
    """
    # Log all raw parameters for debugging
    logger.info(f"GET /api/trades/filtered - Raw params: roiMin={roiMin}, roiMax={roiMax}, "
                f"mcMin={mcMin}, mcMax={mcMax}, dateFrom={dateFrom}, dateTo={dateTo}, "
                f"search='{search}', trader='{trader}', timeframe='{timeframe}'")

    if trades_table is None:
        logger.warning("DynamoDB not available, returning empty list")
        return []

    try:
        # Scan with pagination to retrieve all trades
        response = trades_table.scan()
        trades = response.get('Items', [])

        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = trades_table.scan(
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            trades.extend(response.get('Items', []))

        # Apply filters
        if roiMin is not None or roiMax is not None:
            filtered_trades = []
            for trade in trades:
                roi = ((trade.get('current_mc', 0) - trade.get('initial_mc', 0)) / trade.get('initial_mc', 1)) * 100 if trade.get('initial_mc', 0) > 0 else 0
                if (roiMin is None or roi >= roiMin) and (roiMax is None or roi <= roiMax):
                    filtered_trades.append(trade)
            trades = filtered_trades

        if mcMin is not None:
            trades = [t for t in trades if t.get('initial_mc', 0) >= mcMin]
        if mcMax is not None:
            trades = [t for t in trades if t.get('initial_mc', 0) <= mcMax]

        # Apply date filtering using unix timestamp comparison
        if dateFrom is not None or dateTo is not None:
            logger.info(f"Applying date filter: from={dateFrom}, to={dateTo}")
            filtered_trades = []
            for t in trades:
                timestamp = t.get('timestamp')
                if timestamp:  # Skip trades with empty or missing timestamp
                    try:
                        # Convert timestamp to int (handles Decimal from DynamoDB or string)
                        timestamp_int = int(timestamp)
                        # Direct unix timestamp comparison
                        if (dateFrom is None or timestamp_int >= dateFrom) and \
                           (dateTo is None or timestamp_int <= dateTo):
                            filtered_trades.append(t)
                    except (ValueError, TypeError):
                        # Skip trades with invalid timestamp
                        logger.warning(f"Skipping trade with invalid timestamp type: {timestamp} (type: {type(timestamp)})")
            logger.info(f"After date filter: {len(filtered_trades)} trades (from {len(trades)})")
            trades = filtered_trades

        if search:
            search_lower = search.lower()
            trades = [t for t in trades if search_lower in t.get('ca', '').lower()]
        if trader:
            trades = [t for t in trades if t.get('caller') == trader]

        # Log final results
        logger.info(f"Returning {len(trades)} filtered trades")
        if not trades:
            logger.warning(f"No trades matched filters - dateFrom={dateFrom}, dateTo={dateTo}, "
                          f"roiMin={roiMin}, roiMax={roiMax}, mcMin={mcMin}, mcMax={mcMax}, "
                          f"search={search}, trader={trader}")

        return [dynamodb_item_to_trade(t) for t in trades]
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            logger.error(f"Table not found: {e}")
        elif error_code == 'AccessDeniedException':
            logger.error(f"Access denied to DynamoDB table: {e}")
        else:
            logger.error(f"DynamoDB client error fetching filtered trades: {e}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error fetching filtered trades: {e}")
        return []

@app.post("/api/traders")
async def create_or_update_trader(trader: TraderStats) -> Dict[str, Any]:
    """
    Create or update a trader.
    """
    logger.info(f"POST /api/traders for {trader.caller}")

    if traders_table is None:
        return {
            "success": False,
            "message": "DynamoDB not available"
        }

    if not trader.caller:
        return {
            "success": False,
            "message": "Trader caller is required"
        }

    try:
        traders_table.put_item(Item=trader.dict())
        return {
            "success": True,
            "message": f"Trader {trader.caller} saved successfully"
        }
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            logger.error(f"Table not found: {e}")
            return {"success": False, "message": "Table not found"}
        elif error_code == 'AccessDeniedException':
            logger.error(f"Access denied to DynamoDB table: {e}")
            return {"success": False, "message": "Access denied"}
        else:
            logger.error(f"DynamoDB client error saving trader: {e}")
            return {"success": False, "message": str(e)}
    except Exception as e:
        logger.error(f"Unexpected error saving trader: {e}")
        return {"success": False, "message": str(e)}

@app.post("/api/trades")
async def create_or_update_trade(trade: Trade) -> Dict[str, Any]:
    """
    Create or update a trade.
    """
    logger.info(f"POST /api/trades for {trade.caller}")

    if trades_table is None:
        return {
            "success": False,
            "message": "DynamoDB not available"
        }

    if not trade.caller or not trade.ca or not trade.date_called:
        return {
            "success": False,
            "message": "Trade caller, ca, and date_called are required"
        }

    try:
        trades_table.put_item(Item=trade.dict())
        return {
            "success": True,
            "message": f"Trade for {trade.caller} saved successfully"
        }
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            logger.error(f"Table not found: {e}")
            return {"success": False, "message": "Table not found"}
        elif error_code == 'AccessDeniedException':
            logger.error(f"Access denied to DynamoDB table: {e}")
            return {"success": False, "message": "Access denied"}
        else:
            logger.error(f"DynamoDB client error saving trade: {e}")
            return {"success": False, "message": str(e)}
    except Exception as e:
        logger.error(f"Unexpected error saving trade: {e}")
        return {"success": False, "message": str(e)}

@app.delete("/api/traders/{caller}")
async def delete_trader(caller: str) -> Dict[str, Any]:
    """
    Delete a trader.
    """
    logger.info(f"DELETE /api/traders/{caller}")

    if traders_table is None:
        return {
            "success": False,
            "message": "DynamoDB not available"
        }

    try:
        from urllib.parse import unquote
        decoded_caller = unquote(caller)

        traders_table.delete_item(Key={'caller': decoded_caller})
        return {
            "success": True,
            "message": f"Trader {caller} removed successfully"
        }
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            logger.error(f"Table not found: {e}")
            return {"success": False, "message": "Table not found"}
        elif error_code == 'AccessDeniedException':
            logger.error(f"Access denied to DynamoDB table: {e}")
            return {"success": False, "message": "Access denied"}
        else:
            logger.error(f"DynamoDB client error deleting trader: {e}")
            return {"success": False, "message": str(e)}
    except Exception as e:
        logger.error(f"Unexpected error deleting trader: {e}")
        return {"success": False, "message": str(e)}

@app.delete("/api/trades")
async def delete_trade(request: DeleteTradeRequest) -> Dict[str, Any]:
    """
    Delete a trade.
    """
    logger.info(f"DELETE /api/trades for {request.caller}")

    if trades_table is None:
        return {
            "success": False,
            "message": "DynamoDB not available"
        }

    if not request.caller or not request.ca or not request.date_called:
        return {
            "success": False,
            "message": "caller, ca, and date_called are required"
        }

    try:
        trades_table.delete_item(Key={
            'caller': request.caller,
            'ca': request.ca,
            'date_called': request.date_called
        })
        return {
            "success": True,
            "message": f"Trade for {request.caller} removed successfully"
        }
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            logger.error(f"Table not found: {e}")
            return {"success": False, "message": "Table not found"}
        elif error_code == 'AccessDeniedException':
            logger.error(f"Access denied to DynamoDB table: {e}")
            return {"success": False, "message": "Access denied"}
        else:
            logger.error(f"DynamoDB client error deleting trade: {e}")
            return {"success": False, "message": str(e)}
    except Exception as e:
        logger.error(f"Unexpected error deleting trade: {e}")
        return {"success": False, "message": str(e)}

# ---------------------------------------------------------------------------
# Dev entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

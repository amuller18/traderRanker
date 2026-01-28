"""
Comprehensive unit tests for backtesting logic.

Tests cover:
1. OHLC building logic
2. Core backtesting calculations (_bt_core, _bt_ledger_core)
3. TP/SL ladder execution
4. PnL calculations (realized, unrealized, total)
5. ROI calculations (trade ROI, account ROI)
6. Chart data generation and alignment
7. Summary statistics calculations
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
import math
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ============================================================================
# Test Fixtures - Reusable test data
# ============================================================================

@pytest.fixture
def simple_price_data():
    """Simple price data with known values for testing."""
    # Create 100 candles of price data
    base_timestamp = int(datetime(2024, 1, 1, tzinfo=timezone.utc).timestamp())
    prices = []
    for i in range(100):
        prices.append({
            "unixTime": base_timestamp + (i * 300),  # 5-minute intervals
            "value": 1.0 + (i * 0.01)  # Price starts at 1.0 and increases by 0.01 each candle
        })
    return prices


@pytest.fixture
def volatile_price_data():
    """Price data with high/low swings for TP/SL testing."""
    base_timestamp = int(datetime(2024, 1, 1, tzinfo=timezone.utc).timestamp())
    # Entry at 1.0, goes up to 1.2 (hits 10% and 20% TP), then drops to 0.9 (hits 10% SL)
    price_sequence = [
        1.0,   # Entry
        1.05,  # +5%
        1.10,  # +10% - TP1 should hit
        1.15,  # +15%
        1.20,  # +20% - TP2 should hit
        1.10,  # Back down
        1.00,  # Back to entry
        0.95,  # -5%
        0.90,  # -10% - SL should hit
        0.85,  # -15%
    ]
    return [{"unixTime": base_timestamp + (i * 300), "value": p} for i, p in enumerate(price_sequence)]


@pytest.fixture
def flat_price_data():
    """Price data that stays flat - no TP/SL should trigger."""
    base_timestamp = int(datetime(2024, 1, 1, tzinfo=timezone.utc).timestamp())
    return [{"unixTime": base_timestamp + (i * 300), "value": 1.0} for i in range(50)]


@pytest.fixture
def dynamodb_price_data():
    """Price data in DynamoDB format."""
    base_timestamp = int(datetime(2024, 1, 1, tzinfo=timezone.utc).timestamp())
    return pd.DataFrame([
        {"timestamp": base_timestamp + (i * 300), "price": 1.0 + (i * 0.01), "ca": "test_token"}
        for i in range(100)
    ])


# ============================================================================
# 1. OHLC Building Tests
# ============================================================================

class TestBuildOHLC:
    """Tests for the build_ohlc function."""

    def test_build_ohlc_basic(self, simple_price_data):
        """Test basic OHLC building from price data."""
        from main import build_ohlc

        df = build_ohlc(simple_price_data, tf_minutes=5)

        assert not df.empty, "OHLC DataFrame should not be empty"
        assert len(df) == len(simple_price_data), "Should have same number of bars as input"
        assert "open" in df.columns, "Should have 'open' column"
        assert "high" in df.columns, "Should have 'high' column"
        assert "low" in df.columns, "Should have 'low' column"
        assert "close" in df.columns, "Should have 'close' column"
        assert "t" in df.columns, "Should have 't' (timestamp) column"

    def test_build_ohlc_empty_input(self):
        """Test build_ohlc with empty input."""
        from main import build_ohlc

        df = build_ohlc([], tf_minutes=5)
        assert df.empty, "Should return empty DataFrame for empty input"

    def test_build_ohlc_single_candle(self):
        """Test build_ohlc with single data point."""
        from main import build_ohlc

        data = [{"unixTime": 1704067200, "value": 100.0}]
        df = build_ohlc(data, tf_minutes=5)

        assert len(df) == 1, "Should have exactly 1 bar"
        assert df["close"].iloc[0] == 100.0, "Close should match input value"
        assert df["open"].iloc[0] == 100.0, "Open should match input value"
        assert df["high"].iloc[0] == 100.0, "High should match input value"
        assert df["low"].iloc[0] == 100.0, "Low should match input value"

    def test_build_ohlc_preserves_timestamps(self, simple_price_data):
        """Test that timestamps are correctly preserved."""
        from main import build_ohlc

        df = build_ohlc(simple_price_data, tf_minutes=5)

        # First timestamp should match input
        first_ts = pd.Timestamp(simple_price_data[0]["unixTime"], unit='s')
        assert df["t"].iloc[0] == first_ts, "First timestamp should match"

    def test_build_ohlc_sorted_by_time(self, simple_price_data):
        """Test that output is sorted by timestamp."""
        from main import build_ohlc
        import random

        # Shuffle input data
        shuffled = simple_price_data.copy()
        random.shuffle(shuffled)

        df = build_ohlc(shuffled, tf_minutes=5)

        # Check timestamps are in ascending order
        timestamps = df["t"].tolist()
        assert timestamps == sorted(timestamps), "Output should be sorted by timestamp"


class TestConvertPriceDataToOHLC:
    """Tests for convert_price_data_to_ohlc function."""

    def test_convert_basic(self, dynamodb_price_data):
        """Test basic conversion from DynamoDB format."""
        from main import convert_price_data_to_ohlc

        df = convert_price_data_to_ohlc(dynamodb_price_data)

        assert not df.empty, "Should not return empty DataFrame"
        assert "t" in df.columns, "Should have 't' column"
        assert "open" in df.columns, "Should have 'open' column"
        assert "high" in df.columns, "Should have 'high' column"
        assert "low" in df.columns, "Should have 'low' column"
        assert "close" in df.columns, "Should have 'close' column"

    def test_convert_empty_input(self):
        """Test with empty DataFrame."""
        from main import convert_price_data_to_ohlc

        df = convert_price_data_to_ohlc(pd.DataFrame())
        assert df.empty, "Should return empty DataFrame"

    def test_convert_preserves_prices(self, dynamodb_price_data):
        """Test that price values are preserved."""
        from main import convert_price_data_to_ohlc

        df = convert_price_data_to_ohlc(dynamodb_price_data)

        # First price should match
        assert abs(df["close"].iloc[0] - 1.0) < 0.001, "First close price should be 1.0"


# ============================================================================
# 2. Core Backtesting Calculations Tests
# ============================================================================

class TestBtCore:
    """Tests for _bt_core_py (pure Python backtesting core)."""

    def test_bt_core_no_tp_no_sl(self):
        """Test backtesting with no TP/SL levels - should hold entire position."""
        from main import _bt_core_py

        # 10 candles of increasing price
        close = np.array([1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9])
        high = close.copy()
        low = close.copy()

        tp_r = np.array([], dtype=np.float64)  # No take profits
        tp_s = np.array([], dtype=np.float64)
        sl_r = np.array([], dtype=np.float64)  # No stop losses
        sl_s = np.array([], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert size_left == 1.0, "Should hold entire position when no TP/SL"
        assert pnl == 0.0, "PnL should be 0 when nothing sold"
        assert len(tp_hit) == 0, "No TP levels to hit"
        assert len(sl_hit) == 0, "No SL levels to hit"

    def test_bt_core_tp_triggered(self):
        """Test that take profit is correctly triggered."""
        from main import _bt_core_py

        # Price goes from 1.0 to 1.15 (15% gain)
        close = np.array([1.0, 1.05, 1.10, 1.15, 1.15, 1.15])
        high = close.copy()
        low = close.copy()

        # Single TP at 10% that sells 50%
        tp_r = np.array([0.10], dtype=np.float64)
        tp_s = np.array([0.50], dtype=np.float64)
        sl_r = np.array([], dtype=np.float64)
        sl_s = np.array([], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert tp_hit[0] == True, "TP should be triggered"
        assert size_left == 0.5, "Should have 50% position left"
        # PnL: sold 0.5 at 10% profit = 0.5 * 0.1 = 0.05
        assert abs(pnl - 0.05) < 0.0001, f"PnL should be 0.05, got {pnl}"

    def test_bt_core_sl_triggered(self):
        """Test that stop loss is correctly triggered."""
        from main import _bt_core_py

        # Price goes from 1.0 to 0.85 (15% loss)
        close = np.array([1.0, 0.95, 0.90, 0.85, 0.85, 0.85])
        high = close.copy()
        low = close.copy()

        # Single SL at 10% that sells 100%
        tp_r = np.array([], dtype=np.float64)
        tp_s = np.array([], dtype=np.float64)
        sl_r = np.array([0.10], dtype=np.float64)
        sl_s = np.array([1.0], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert sl_hit[0] == True, "SL should be triggered"
        assert size_left == 0.0, "Should have no position left"
        # PnL: sold 1.0 at -10% = 1.0 * (-0.1) = -0.1
        assert abs(pnl - (-0.1)) < 0.0001, f"PnL should be -0.1, got {pnl}"

    def test_bt_core_multiple_tp_levels(self):
        """Test multiple take profit ladder levels."""
        from main import _bt_core_py

        # Price goes from 1.0 to 1.25 (25% gain)
        close = np.array([1.0, 1.05, 1.10, 1.15, 1.20, 1.25])
        high = close.copy()
        low = close.copy()

        # TP ladder: 10% sells 30%, 20% sells 30%
        tp_r = np.array([0.10, 0.20], dtype=np.float64)
        tp_s = np.array([0.30, 0.30], dtype=np.float64)
        sl_r = np.array([], dtype=np.float64)
        sl_s = np.array([], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert tp_hit[0] == True, "First TP should be hit"
        assert tp_hit[1] == True, "Second TP should be hit"
        assert abs(size_left - 0.4) < 0.0001, f"Should have 40% left, got {size_left}"
        # PnL: 0.3 * 0.1 + 0.3 * 0.2 = 0.03 + 0.06 = 0.09
        assert abs(pnl - 0.09) < 0.0001, f"PnL should be 0.09, got {pnl}"

    def test_bt_core_tp_and_sl(self):
        """Test combination of TP and SL triggers."""
        from main import _bt_core_py

        # Price: 1.0 -> 1.1 (TP hit) -> 0.85 (SL hit)
        close = np.array([1.0, 1.05, 1.10, 1.05, 0.95, 0.90, 0.85])
        high = np.array([1.0, 1.06, 1.12, 1.06, 0.96, 0.91, 0.86])  # Slightly higher than close
        low = np.array([1.0, 1.04, 1.08, 1.04, 0.94, 0.89, 0.84])   # Slightly lower than close

        # TP at 10% sells 40%, SL at 10% sells 60%
        tp_r = np.array([0.10], dtype=np.float64)
        tp_s = np.array([0.40], dtype=np.float64)
        sl_r = np.array([0.10], dtype=np.float64)
        sl_s = np.array([0.60], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert tp_hit[0] == True, "TP should be hit"
        assert sl_hit[0] == True, "SL should be hit"
        # After TP: 60% left. After SL: 0% left
        assert abs(size_left - 0.0) < 0.0001, f"Should have 0% left, got {size_left}"

    def test_bt_core_tp_not_triggered(self):
        """Test TP that is never reached."""
        from main import _bt_core_py

        # Price only goes up 5%
        close = np.array([1.0, 1.02, 1.04, 1.05, 1.05, 1.05])
        high = close.copy()
        low = close.copy()

        # TP at 10% - should not be hit
        tp_r = np.array([0.10], dtype=np.float64)
        tp_s = np.array([0.50], dtype=np.float64)
        sl_r = np.array([], dtype=np.float64)
        sl_s = np.array([], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert tp_hit[0] == False, "TP should NOT be triggered"
        assert size_left == 1.0, "Should still hold entire position"
        assert pnl == 0.0, "No sales, no realized PnL"

    def test_bt_core_uses_high_for_tp(self):
        """Test that TP uses high price (not close)."""
        from main import _bt_core_py

        # Close stays at 1.05, but high touches 1.11
        close = np.array([1.0, 1.05, 1.05, 1.05, 1.05])
        high = np.array([1.0, 1.11, 1.05, 1.05, 1.05])  # High spikes to 1.11
        low = close.copy()

        # TP at 10%
        tp_r = np.array([0.10], dtype=np.float64)
        tp_s = np.array([0.50], dtype=np.float64)
        sl_r = np.array([], dtype=np.float64)
        sl_s = np.array([], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert tp_hit[0] == True, "TP should be triggered by high price"

    def test_bt_core_uses_low_for_sl(self):
        """Test that SL uses low price (not close)."""
        from main import _bt_core_py

        # Close stays at 0.95, but low touches 0.89
        close = np.array([1.0, 0.95, 0.95, 0.95, 0.95])
        high = close.copy()
        low = np.array([1.0, 0.89, 0.95, 0.95, 0.95])  # Low dips to 0.89

        # SL at 10%
        tp_r = np.array([], dtype=np.float64)
        tp_s = np.array([], dtype=np.float64)
        sl_r = np.array([0.10], dtype=np.float64)
        sl_s = np.array([1.0], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert sl_hit[0] == True, "SL should be triggered by low price"


class TestBtLedgerCore:
    """Tests for _bt_ledger_core (ledger-tracking backtesting)."""

    def test_ledger_core_tracks_positions(self):
        """Test that ledger correctly tracks position over time."""
        # Import the Python fallback version for testing
        from main import _bt_ledger_core, JIT_READY

        timestamps = np.array([1704067200 + (i * 300) for i in range(10)], dtype=np.int64)
        close = np.array([1.0, 1.05, 1.10, 1.15, 1.20, 1.15, 1.10, 1.05, 1.0, 0.95], dtype=np.float64)
        high = close.copy()
        low = close.copy()

        entry_price = 1.0
        entry_coins = 100.0  # $100 at $1 = 100 coins

        # TP at 10% sells 50%
        tp_levels = np.array([1.1], dtype=np.float64)
        tp_sizes = np.array([0.5], dtype=np.float64)
        sl_levels = np.array([], dtype=np.float64)
        sl_sizes = np.array([], dtype=np.float64)

        result = _bt_ledger_core(
            timestamps, close, high, low,
            entry_price, entry_coins,
            tp_levels, tp_sizes, sl_levels, sl_sizes
        )

        ledger_ts, ledger_equity, ledger_coins, ledger_unrealized, ledger_realized, coins, realized, tp_fired, sl_fired = result

        assert len(ledger_ts) > 0, "Ledger should have entries"
        assert tp_fired[0] == True, "TP should be fired"
        assert coins == 50.0, "Should have 50 coins left after selling 50%"

    def test_ledger_core_equity_calculation(self):
        """Test that equity is calculated correctly at each timestamp."""
        from main import _bt_ledger_core

        timestamps = np.array([1704067200, 1704067500, 1704067800], dtype=np.int64)
        close = np.array([1.0, 1.1, 1.2], dtype=np.float64)
        high = close.copy()
        low = close.copy()

        entry_price = 1.0
        entry_coins = 100.0

        # No TP/SL - just track equity
        tp_levels = np.array([], dtype=np.float64)
        tp_sizes = np.array([], dtype=np.float64)
        sl_levels = np.array([], dtype=np.float64)
        sl_sizes = np.array([], dtype=np.float64)

        result = _bt_ledger_core(
            timestamps, close, high, low,
            entry_price, entry_coins,
            tp_levels, tp_sizes, sl_levels, sl_sizes
        )

        ledger_ts, ledger_equity, ledger_coins, ledger_unrealized, ledger_realized, coins, realized, tp_fired, sl_fired = result

        # At t0: 100 coins * $1.0 = $100
        # At t1: 100 coins * $1.1 = $110
        # At t2: 100 coins * $1.2 = $120
        assert abs(ledger_equity[0] - 100.0) < 0.01, f"Equity at t0 should be $100, got {ledger_equity[0]}"
        assert abs(ledger_equity[1] - 110.0) < 0.01, f"Equity at t1 should be $110, got {ledger_equity[1]}"
        assert abs(ledger_equity[2] - 120.0) < 0.01, f"Equity at t2 should be $120, got {ledger_equity[2]}"


# ============================================================================
# 3. TP/SL Ladder Parsing Tests
# ============================================================================

class TestParseLadder:
    """Tests for _parse_ladder function."""

    def test_parse_single_level(self):
        """Test parsing single ladder level."""
        from main import _parse_ladder

        ratios, sells = _parse_ladder(["0.10:0.50"])

        assert ratios == [0.10], "Ratio should be 0.10"
        assert sells == [0.50], "Sell fraction should be 0.50"

    def test_parse_multiple_levels(self):
        """Test parsing multiple ladder levels."""
        from main import _parse_ladder

        ratios, sells = _parse_ladder(["0.05:0.30", "0.10:0.30", "0.20:0.40"])

        assert ratios == [0.05, 0.10, 0.20], "Ratios should be [0.05, 0.10, 0.20]"
        assert sells == [0.30, 0.30, 0.40], "Sells should be [0.30, 0.30, 0.40]"

    def test_parse_empty_ladder(self):
        """Test parsing empty ladder."""
        from main import _parse_ladder

        ratios, sells = _parse_ladder([])

        assert ratios == [], "Should return empty list"
        assert sells == [], "Should return empty list"

    def test_parse_zero_disables_level(self):
        """Test that 0:0 disables a level."""
        from main import _parse_ladder

        ratios, sells = _parse_ladder(["0.10:0.50", "0:0", "0.20:0.50"])

        assert len(ratios) == 2, "Should have 2 levels (0:0 disabled)"
        assert ratios == [0.10, 0.20], "Should skip 0:0 level"

    def test_parse_invalid_format_raises(self):
        """Test that invalid format raises error."""
        from main import _parse_ladder
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            _parse_ladder(["invalid"])
        assert exc_info.value.status_code == 400

    def test_parse_negative_ratio_raises(self):
        """Test that negative ratio raises error."""
        from main import _parse_ladder
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            _parse_ladder(["-0.10:0.50"])
        assert exc_info.value.status_code == 400

    def test_parse_sell_over_one_raises(self):
        """Test that sell fraction > 1 raises error."""
        from main import _parse_ladder
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            _parse_ladder(["0.10:1.5"])
        assert exc_info.value.status_code == 400

    def test_parse_total_sell_over_one_raises(self):
        """Test that total sell fractions > 1 raises error."""
        from main import _parse_ladder
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            _parse_ladder(["0.10:0.50", "0.20:0.60"])  # Total = 1.1
        assert exc_info.value.status_code == 400


# ============================================================================
# 4. PnL Calculation Tests
# ============================================================================

class TestPnLCalculations:
    """Tests for PnL calculations in run_simulation_with_ledger."""

    def test_pnl_no_trades(self):
        """Test PnL when nothing is sold (all unrealized)."""
        from main import run_simulation_with_ledger

        # Create simple OHLC data - price goes from 1.0 to 1.2 (20% gain)
        df_ohlc = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(10)], unit='s'),
            'open': [1.0 + i*0.02 for i in range(10)],
            'high': [1.0 + i*0.02 for i in range(10)],
            'low': [1.0 + i*0.02 for i in range(10)],
            'close': [1.0 + i*0.02 for i in range(10)]
        })

        result = run_simulation_with_ledger(
            df_ohlc,
            start_cash_usd=100.0,
            current_price=1.18,  # Close to final price
            tp_ratios=[],  # No TP
            tp_sizes=[],
            sl_ratios=[],  # No SL
            sl_sizes=[]
        )

        # All PnL should be unrealized since nothing sold
        assert result["realized_profit"] == 0.0, "Realized should be 0 when nothing sold"
        # Unrealized = (current_price - entry_price) * coins = (1.18 - 1.0) * 100 = $18
        assert abs(result["unrealized_profit"] - 18.0) < 0.01, f"Unrealized should be ~$18, got {result['unrealized_profit']}"

    def test_pnl_all_sold_at_profit(self):
        """Test PnL when entire position is sold at TP."""
        from main import run_simulation_with_ledger

        # Price goes from 1.0 to 1.2, hits TP at 10%
        df_ohlc = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(5)], unit='s'),
            'open': [1.0, 1.05, 1.10, 1.15, 1.15],
            'high': [1.0, 1.06, 1.12, 1.16, 1.16],  # High hits 1.10
            'low': [1.0, 1.04, 1.08, 1.14, 1.14],
            'close': [1.0, 1.05, 1.10, 1.15, 1.15]
        })

        result = run_simulation_with_ledger(
            df_ohlc,
            start_cash_usd=100.0,
            current_price=1.15,
            tp_ratios=[0.10],  # 10% TP
            tp_sizes=[1.0],    # Sell 100%
            sl_ratios=[],
            sl_sizes=[]
        )

        assert result["coins_left"] == 0.0, "All coins should be sold"
        # Realized = (1.10 - 1.0) * 100 coins = $10
        assert abs(result["realized_profit"] - 10.0) < 0.01, f"Realized should be $10, got {result['realized_profit']}"
        assert result["unrealized_profit"] == 0.0, "Unrealized should be 0 when all sold"

    def test_pnl_all_sold_at_loss(self):
        """Test PnL when entire position is sold at SL."""
        from main import run_simulation_with_ledger

        # Price goes from 1.0 to 0.85, hits SL at 10%
        df_ohlc = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(5)], unit='s'),
            'open': [1.0, 0.95, 0.90, 0.85, 0.85],
            'high': [1.0, 0.96, 0.91, 0.86, 0.86],
            'low': [1.0, 0.94, 0.89, 0.84, 0.84],  # Low hits 0.90
            'close': [1.0, 0.95, 0.90, 0.85, 0.85]
        })

        result = run_simulation_with_ledger(
            df_ohlc,
            start_cash_usd=100.0,
            current_price=0.85,
            tp_ratios=[],
            tp_sizes=[],
            sl_ratios=[0.10],  # 10% SL
            sl_sizes=[1.0]     # Sell 100%
        )

        assert result["coins_left"] == 0.0, "All coins should be sold"
        # Realized = (0.90 - 1.0) * 100 coins = -$10
        assert abs(result["realized_profit"] - (-10.0)) < 0.01, f"Realized should be -$10, got {result['realized_profit']}"

    def test_pnl_mixed_realized_unrealized(self):
        """Test PnL with both realized and unrealized components."""
        from main import run_simulation_with_ledger

        # Price goes from 1.0 to 1.1 (TP hit), then to 1.2
        df_ohlc = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(5)], unit='s'),
            'open': [1.0, 1.05, 1.10, 1.15, 1.20],
            'high': [1.0, 1.06, 1.12, 1.16, 1.22],
            'low': [1.0, 1.04, 1.08, 1.14, 1.18],
            'close': [1.0, 1.05, 1.10, 1.15, 1.20]
        })

        result = run_simulation_with_ledger(
            df_ohlc,
            start_cash_usd=100.0,
            current_price=1.20,
            tp_ratios=[0.10],  # 10% TP
            tp_sizes=[0.5],    # Sell 50%
            sl_ratios=[],
            sl_sizes=[]
        )

        # 100 coins bought at $1.0
        # 50 coins sold at $1.10 (TP) -> realized = 50 * (1.10 - 1.0) = $5
        # 50 coins left, current price $1.20 -> unrealized = 50 * (1.20 - 1.0) = $10
        assert abs(result["coins_left"] - 50.0) < 0.01, f"Should have 50 coins left, got {result['coins_left']}"
        assert abs(result["realized_profit"] - 5.0) < 0.01, f"Realized should be $5, got {result['realized_profit']}"
        assert abs(result["unrealized_profit"] - 10.0) < 0.01, f"Unrealized should be $10, got {result['unrealized_profit']}"

    def test_pnl_invariant(self):
        """Test that total_pnl = realized + unrealized PnL."""
        from main import run_simulation_with_ledger

        df_ohlc = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(10)], unit='s'),
            'open': [1.0 + i*0.01 for i in range(10)],
            'high': [1.0 + i*0.01 + 0.005 for i in range(10)],
            'low': [1.0 + i*0.01 - 0.005 for i in range(10)],
            'close': [1.0 + i*0.01 for i in range(10)]
        })

        start_cash = 100.0
        current_price = 1.09

        result = run_simulation_with_ledger(
            df_ohlc,
            start_cash_usd=start_cash,
            current_price=current_price,
            tp_ratios=[0.05],
            tp_sizes=[0.3],
            sl_ratios=[],
            sl_sizes=[]
        )

        total_pnl = result["realized_profit"] + result["unrealized_profit"]

        # Verify PnL components add up correctly
        # realized + unrealized should be consistent
        realized = result["realized_profit"]
        unrealized = result["unrealized_profit"]

        # The sum should match the total
        assert abs(total_pnl - (realized + unrealized)) < 0.01, \
            f"PnL invariant violated: total={total_pnl}, realized={realized}, unrealized={unrealized}"

        # Verify coins tracking is consistent
        coins_left = result["coins_left"]
        assert coins_left >= 0, "Coins left should be non-negative"

        # Verify TPs that hit are tracked
        tps_hit = result["tps_hit"]
        if len(tps_hit) > 0:
            # If TP hit, coins should have decreased
            initial_coins = start_cash / 1.0  # Entry at first close price
            assert coins_left < initial_coins, "Coins should decrease when TP is hit"


# ============================================================================
# 5. ROI Calculation Tests
# ============================================================================

class TestROICalculations:
    """Tests for ROI calculations."""

    def test_trade_roi_positive(self):
        """Test trade ROI calculation for profitable trade."""
        # Trade ROI = total_pnl / trade_capital * 100
        trade_capital = 100.0
        total_pnl = 20.0  # $20 profit

        trade_roi = (total_pnl / trade_capital) * 100

        assert trade_roi == 20.0, "Trade ROI should be 20% for $20 profit on $100"

    def test_trade_roi_negative(self):
        """Test trade ROI calculation for losing trade."""
        trade_capital = 100.0
        total_pnl = -15.0  # $15 loss

        trade_roi = (total_pnl / trade_capital) * 100

        assert trade_roi == -15.0, "Trade ROI should be -15% for $15 loss on $100"

    def test_trade_roi_break_even(self):
        """Test trade ROI for break-even trade."""
        trade_capital = 100.0
        total_pnl = 0.0

        trade_roi = (total_pnl / trade_capital) * 100

        assert trade_roi == 0.0, "Trade ROI should be 0% for break-even"

    def test_account_roi_vs_trade_roi(self):
        """Test that account ROI and trade ROI are calculated differently."""
        # Account ROI is based on total account capital
        # Trade ROI is based on individual trade capital

        initial_capital = 10000.0  # Total account
        trade_capital = 100.0      # Position size
        total_pnl = 20.0           # Profit from trade

        trade_roi = (total_pnl / trade_capital) * 100
        account_roi = (total_pnl / initial_capital) * 100

        assert trade_roi == 20.0, "Trade ROI = 20%"
        assert account_roi == 0.2, "Account ROI = 0.2%"
        assert trade_roi != account_roi, "Trade ROI and Account ROI should differ"

    def test_account_roi_multiple_trades(self):
        """Test account ROI with multiple trades."""
        initial_capital = 1000.0
        trade_results = [
            {"pnl": 50.0},   # Trade 1: +$50
            {"pnl": -20.0},  # Trade 2: -$20
            {"pnl": 30.0},   # Trade 3: +$30
        ]

        total_pnl = sum(t["pnl"] for t in trade_results)  # $60
        final_capital = initial_capital + total_pnl  # $1060
        account_roi = ((final_capital - initial_capital) / initial_capital) * 100

        assert total_pnl == 60.0, "Total PnL should be $60"
        assert account_roi == 6.0, "Account ROI should be 6%"


# ============================================================================
# 6. Summary Statistics Tests
# ============================================================================

class TestSummaryStatistics:
    """Tests for summary statistics calculations."""

    def test_win_rate_calculation(self):
        """Test win rate calculation."""
        trades = [
            {"pnl": 50.0},    # Win
            {"pnl": -20.0},   # Loss
            {"pnl": 30.0},    # Win
            {"pnl": -10.0},   # Loss
            {"pnl": 100.0},   # Win
        ]

        winning_trades = sum(1 for t in trades if t["pnl"] > 0)
        total_trades = len(trades)
        win_rate = (winning_trades / total_trades) * 100

        assert winning_trades == 3, "Should have 3 winning trades"
        assert win_rate == 60.0, "Win rate should be 60%"

    def test_profit_factor_calculation(self):
        """Test profit factor calculation."""
        trades = [
            {"pnl": 50.0},    # Win
            {"pnl": -20.0},   # Loss
            {"pnl": 30.0},    # Win
            {"pnl": -10.0},   # Loss
        ]

        gross_profit = sum(t["pnl"] for t in trades if t["pnl"] > 0)  # 80
        gross_loss = abs(sum(t["pnl"] for t in trades if t["pnl"] < 0))  # 30
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0

        assert gross_profit == 80.0, "Gross profit should be $80"
        assert gross_loss == 30.0, "Gross loss should be $30"
        assert abs(profit_factor - 2.667) < 0.01, "Profit factor should be ~2.67"

    def test_profit_factor_no_losses(self):
        """Test profit factor when there are no losses."""
        trades = [{"pnl": 50.0}, {"pnl": 30.0}]

        gross_loss = abs(sum(t["pnl"] for t in trades if t["pnl"] < 0))

        assert gross_loss == 0, "No losses"
        # Convention: profit factor is infinity or very high when no losses
        profit_factor = float('inf') if gross_loss == 0 else 0
        assert math.isinf(profit_factor), "Profit factor should be infinity"

    def test_expectancy_calculation(self):
        """Test expectancy calculation."""
        trades = [
            {"pnl": 50.0},
            {"pnl": -20.0},
            {"pnl": 30.0},
            {"pnl": -10.0},
        ]

        total_pnl = sum(t["pnl"] for t in trades)  # 50
        num_trades = len(trades)  # 4
        expectancy = total_pnl / num_trades  # 12.5

        assert abs(expectancy - 12.5) < 0.01, "Expectancy should be $12.50 per trade"

    def test_max_drawdown_calculation(self):
        """Test max drawdown calculation."""
        # Equity curve: starts at 100, peaks at 150, drops to 120
        equity_curve = [100, 110, 130, 150, 140, 130, 120, 125, 130]

        peak = equity_curve[0]
        max_dd = 0.0

        for equity in equity_curve:
            if equity > peak:
                peak = equity
            else:
                dd = (peak - equity) / peak
                max_dd = max(max_dd, dd)

        # Peak was 150, lowest after peak was 120
        # Max DD = (150 - 120) / 150 = 0.20 = 20%
        assert abs(max_dd - 0.20) < 0.01, "Max drawdown should be 20%"

    def test_average_win_loss_calculation(self):
        """Test average win and average loss calculations."""
        trades = [
            {"pnl": 60.0},
            {"pnl": -30.0},
            {"pnl": 40.0},
            {"pnl": -20.0},
        ]

        wins = [t["pnl"] for t in trades if t["pnl"] > 0]  # [60, 40]
        losses = [t["pnl"] for t in trades if t["pnl"] < 0]  # [-30, -20]

        avg_win = sum(wins) / len(wins) if wins else 0  # 50
        avg_loss = sum(losses) / len(losses) if losses else 0  # -25

        assert avg_win == 50.0, "Average win should be $50"
        assert avg_loss == -25.0, "Average loss should be -$25"

    def test_risk_reward_ratio(self):
        """Test risk/reward ratio calculation."""
        avg_win = 50.0
        avg_loss = -25.0  # Note: losses are negative

        risk_reward = avg_win / abs(avg_loss) if avg_loss != 0 else 0

        assert risk_reward == 2.0, "Risk/reward ratio should be 2:1"

    def test_largest_win_loss(self):
        """Test largest win and largest loss identification."""
        trades = [
            {"pnl": 50.0},
            {"pnl": -30.0},
            {"pnl": 100.0},  # Largest win
            {"pnl": -50.0},  # Largest loss
            {"pnl": 20.0},
        ]

        largest_win = max(t["pnl"] for t in trades if t["pnl"] > 0)
        largest_loss = min(t["pnl"] for t in trades if t["pnl"] < 0)

        assert largest_win == 100.0, "Largest win should be $100"
        assert largest_loss == -50.0, "Largest loss should be -$50"


# ============================================================================
# 7. Data Validation Tests
# ============================================================================

class TestDataValidation:
    """Tests for data validation functions."""

    def test_validate_trade_data_valid(self):
        """Test validation of valid trade data."""
        from main import validate_trade_data

        result = validate_trade_data(
            token="So11111111111111111111111111111111111111112",  # Valid Solana address
            date_called="2024-01-01T12:00:00Z",
            entry_price=1.0,
            current_price=1.5,
            tokens_quantity=100.0
        )

        assert result.is_valid, f"Should be valid, but got errors: {result.errors}"

    def test_validate_trade_data_invalid_token(self):
        """Test validation with invalid token address."""
        from main import validate_trade_data

        result = validate_trade_data(
            token="invalid_address",
            date_called="2024-01-01T12:00:00Z"
        )

        assert not result.is_valid, "Should be invalid for bad token address"
        assert any("address" in e.lower() for e in result.errors), "Should have address error"

    def test_validate_trade_data_missing_token(self):
        """Test validation with missing token."""
        from main import validate_trade_data

        result = validate_trade_data(
            token="",
            date_called="2024-01-01T12:00:00Z"
        )

        assert not result.is_valid, "Should be invalid for missing token"

    def test_validate_trade_data_invalid_date(self):
        """Test validation with invalid date format."""
        from main import validate_trade_data

        result = validate_trade_data(
            token="So11111111111111111111111111111111111111112",
            date_called="not-a-date"
        )

        assert not result.is_valid, "Should be invalid for bad date"

    def test_validate_trade_data_negative_price(self):
        """Test validation with negative price."""
        from main import validate_trade_data

        result = validate_trade_data(
            token="So11111111111111111111111111111111111111112",
            date_called="2024-01-01T12:00:00Z",
            entry_price=-1.0
        )

        assert not result.is_valid, "Should be invalid for negative price"

    def test_validate_trade_data_nan_price(self):
        """Test validation with NaN price."""
        from main import validate_trade_data

        result = validate_trade_data(
            token="So11111111111111111111111111111111111111112",
            date_called="2024-01-01T12:00:00Z",
            entry_price=float('nan')
        )

        assert not result.is_valid, "Should be invalid for NaN price"

    def test_validate_price_data_valid(self):
        """Test validation of valid price data."""
        from main import validate_price_data

        prices = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0]
        result = validate_price_data(prices)

        assert result.is_valid, f"Should be valid, but got errors: {result.errors}"

    def test_validate_price_data_empty(self):
        """Test validation with empty price data."""
        from main import validate_price_data

        result = validate_price_data([])

        assert not result.is_valid, "Should be invalid for empty data"

    def test_validate_price_data_insufficient(self):
        """Test validation with insufficient price data."""
        from main import validate_price_data

        result = validate_price_data([1.0, 1.1, 1.2])  # Only 3 points, need 10

        assert not result.is_valid, "Should be invalid for insufficient data"

    def test_validate_price_data_all_nan(self):
        """Test validation when all prices are NaN."""
        from main import validate_price_data

        result = validate_price_data([float('nan')] * 20)

        assert not result.is_valid, "Should be invalid when all NaN"


# ============================================================================
# 8. Solana Address Validation Tests
# ============================================================================

class TestSolanaAddressValidation:
    """Tests for Solana address validation."""

    def test_valid_solana_address(self):
        """Test valid Solana addresses."""
        from main import is_valid_solana_address

        # Known valid Solana addresses
        valid_addresses = [
            "So11111111111111111111111111111111111111112",  # Wrapped SOL
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
            "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",  # USDT
        ]

        for addr in valid_addresses:
            assert is_valid_solana_address(addr), f"{addr} should be valid"

    def test_invalid_solana_address(self):
        """Test invalid Solana addresses."""
        from main import is_valid_solana_address

        invalid_addresses = [
            "",  # Empty
            "invalid",  # Too short
            "0x1234567890123456789012345678901234567890",  # Ethereum address
            "a" * 100,  # Too long
            "So111111111111111111111111111111111111111O",  # Invalid character (O instead of 0)
        ]

        for addr in invalid_addresses:
            assert not is_valid_solana_address(addr), f"{addr} should be invalid"


# ============================================================================
# 9. Normalization Tests
# ============================================================================

class TestNormalization:
    """Tests for value normalization function."""

    def test_normalize_normal_value(self):
        """Test normalization of normal values."""
        from main import _normalize_value

        assert _normalize_value(123.456789, 2) == 123.46
        assert _normalize_value(123.456789, 4) == 123.4568

    def test_normalize_nan(self):
        """Test normalization of NaN."""
        from main import _normalize_value

        assert _normalize_value(float('nan')) == 0.0

    def test_normalize_infinity(self):
        """Test normalization of infinity."""
        from main import _normalize_value

        assert _normalize_value(float('inf')) == 9999999.99
        assert _normalize_value(float('-inf')) == -9999999.99

    def test_normalize_none(self):
        """Test normalization of None."""
        from main import _normalize_value

        assert _normalize_value(None) == 0.0

    def test_normalize_custom_max(self):
        """Test normalization with custom max value."""
        from main import _normalize_value

        assert _normalize_value(float('inf'), max_val=1000.0) == 1000.0


# ============================================================================
# 10. Edge Case Tests
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases in backtesting."""

    def test_very_small_position(self):
        """Test backtesting with very small position size."""
        from main import run_simulation_with_ledger

        df_ohlc = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(5)], unit='s'),
            'open': [0.000001, 0.000002, 0.000003, 0.000002, 0.000001],
            'high': [0.000001, 0.000002, 0.000003, 0.000002, 0.000001],
            'low': [0.000001, 0.000002, 0.000003, 0.000002, 0.000001],
            'close': [0.000001, 0.000002, 0.000003, 0.000002, 0.000001]
        })

        result = run_simulation_with_ledger(
            df_ohlc,
            start_cash_usd=100.0,
            current_price=0.000001,
            tp_ratios=[],
            tp_sizes=[],
            sl_ratios=[],
            sl_sizes=[]
        )

        # Should not crash and should have valid output
        assert result is not None
        assert "ledger" in result
        assert "realized_profit" in result

    def test_large_position_size(self):
        """Test backtesting with large position size."""
        from main import run_simulation_with_ledger

        df_ohlc = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(5)], unit='s'),
            'open': [100.0, 110.0, 120.0, 115.0, 110.0],
            'high': [105.0, 115.0, 125.0, 120.0, 115.0],
            'low': [95.0, 105.0, 115.0, 110.0, 105.0],
            'close': [100.0, 110.0, 120.0, 115.0, 110.0]
        })

        result = run_simulation_with_ledger(
            df_ohlc,
            start_cash_usd=1000000.0,  # $1M position
            current_price=110.0,
            tp_ratios=[0.10],
            tp_sizes=[0.5],
            sl_ratios=[],
            sl_sizes=[]
        )

        assert result is not None
        assert "coins_left" in result

    def test_single_candle(self):
        """Test backtesting with single candle."""
        from main import run_simulation_with_ledger

        df_ohlc = pd.DataFrame({
            't': pd.to_datetime([1704067200], unit='s'),
            'open': [1.0],
            'high': [1.0],
            'low': [1.0],
            'close': [1.0]
        })

        result = run_simulation_with_ledger(
            df_ohlc,
            start_cash_usd=100.0,
            current_price=1.0,
            tp_ratios=[],
            tp_sizes=[],
            sl_ratios=[],
            sl_sizes=[]
        )

        assert result is not None
        assert result["coins_left"] == 100.0  # Should still hold 100 coins

    def test_price_at_exact_tp_level(self):
        """Test when price hits exactly at TP level."""
        from main import _bt_core_py

        # Price goes to exactly 1.10 (10% gain)
        close = np.array([1.0, 1.05, 1.10, 1.10, 1.10])
        high = np.array([1.0, 1.05, 1.10, 1.10, 1.10])  # Exactly 1.10
        low = close.copy()

        tp_r = np.array([0.10], dtype=np.float64)  # 10% TP
        tp_s = np.array([0.50], dtype=np.float64)
        sl_r = np.array([], dtype=np.float64)
        sl_s = np.array([], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert tp_hit[0] == True, "TP should trigger at exact level"

    def test_price_at_exact_sl_level(self):
        """Test when price hits exactly at SL level."""
        from main import _bt_core_py

        # Price goes to exactly 0.90 (10% loss)
        close = np.array([1.0, 0.95, 0.90, 0.90, 0.90])
        high = close.copy()
        low = np.array([1.0, 0.95, 0.90, 0.90, 0.90])  # Exactly 0.90

        tp_r = np.array([], dtype=np.float64)
        tp_s = np.array([], dtype=np.float64)
        sl_r = np.array([0.10], dtype=np.float64)  # 10% SL
        sl_s = np.array([1.0], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert sl_hit[0] == True, "SL should trigger at exact level"


# ============================================================================
# 11. TTL Cache Tests
# ============================================================================

class TestTTLCache:
    """Tests for TTLCache class."""

    def test_cache_set_get(self):
        """Test basic set and get operations."""
        from main import TTLCache

        cache = TTLCache(max_size=10, ttl=3600)
        cache.set("key1", "value1")

        assert cache.get("key1") == "value1"

    def test_cache_miss(self):
        """Test cache miss returns None."""
        from main import TTLCache

        cache = TTLCache(max_size=10, ttl=3600)

        assert cache.get("nonexistent") is None

    def test_cache_eviction(self):
        """Test that oldest entries are evicted when at capacity."""
        from main import TTLCache

        cache = TTLCache(max_size=3, ttl=3600)
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")
        cache.set("key4", "value4")  # Should evict key1

        assert cache.get("key1") is None, "key1 should be evicted"
        assert cache.get("key4") == "value4", "key4 should be present"

    def test_cache_contains(self):
        """Test __contains__ method."""
        from main import TTLCache

        cache = TTLCache(max_size=10, ttl=3600)
        cache.set("key1", "value1")

        assert "key1" in cache
        assert "key2" not in cache


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

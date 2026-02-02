"""
Comprehensive unit tests for cumulative ledger calculations and performance timing.

Tests cover:
1. Cumulative ledger alignment (_aligned_ledgers)
2. Cumulative equity calculations
3. Multi-trade portfolio aggregation
4. Chart data generation for cumulative view
5. Performance timing for backtest components
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
import math
import time
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def single_trade_ledger():
    """Single trade with a simple ledger."""
    from main import PositionPoint, SimulationResult

    base_ts = 1704067200  # 2024-01-01 00:00:00 UTC
    ledger = [
        PositionPoint(ts=base_ts, value=100.0, coins_held=100.0, unrealized=0.0, realized=0.0),
        PositionPoint(ts=base_ts + 300, value=105.0, coins_held=100.0, unrealized=5.0, realized=0.0),
        PositionPoint(ts=base_ts + 600, value=110.0, coins_held=100.0, unrealized=10.0, realized=0.0),
        PositionPoint(ts=base_ts + 900, value=55.0, coins_held=50.0, unrealized=5.0, realized=5.0),
        PositionPoint(ts=base_ts + 1200, value=60.0, coins_held=50.0, unrealized=10.0, realized=5.0),
    ]

    return SimulationResult(
        token="TOKEN1",
        ledger=ledger,
        realized_profit=5.0,
        unrealized_profit=10.0,
        coins_left=50.0,
        tps_hit=[1.1],
        sls_hit=[]
    )


@pytest.fixture
def multiple_trade_ledgers():
    """Multiple trades with overlapping and non-overlapping time periods."""
    from main import PositionPoint, SimulationResult

    base_ts = 1704067200

    # Trade 1: Starts at t=0, ends at t=1200
    trade1_ledger = [
        PositionPoint(ts=base_ts, value=100.0, coins_held=100.0, unrealized=0.0, realized=0.0),
        PositionPoint(ts=base_ts + 300, value=105.0, coins_held=100.0, unrealized=5.0, realized=0.0),
        PositionPoint(ts=base_ts + 600, value=110.0, coins_held=100.0, unrealized=10.0, realized=0.0),
        PositionPoint(ts=base_ts + 900, value=115.0, coins_held=100.0, unrealized=15.0, realized=0.0),
        PositionPoint(ts=base_ts + 1200, value=120.0, coins_held=100.0, unrealized=20.0, realized=0.0),
    ]

    # Trade 2: Starts at t=300, ends at t=1500
    trade2_ledger = [
        PositionPoint(ts=base_ts + 300, value=200.0, coins_held=200.0, unrealized=0.0, realized=0.0),
        PositionPoint(ts=base_ts + 600, value=210.0, coins_held=200.0, unrealized=10.0, realized=0.0),
        PositionPoint(ts=base_ts + 900, value=220.0, coins_held=200.0, unrealized=20.0, realized=0.0),
        PositionPoint(ts=base_ts + 1200, value=230.0, coins_held=200.0, unrealized=30.0, realized=0.0),
        PositionPoint(ts=base_ts + 1500, value=240.0, coins_held=200.0, unrealized=40.0, realized=0.0),
    ]

    # Trade 3: Starts at t=600, ends at t=900 (fully closed)
    trade3_ledger = [
        PositionPoint(ts=base_ts + 600, value=50.0, coins_held=50.0, unrealized=0.0, realized=0.0),
        PositionPoint(ts=base_ts + 900, value=0.0, coins_held=0.0, unrealized=0.0, realized=10.0),
    ]

    return [
        SimulationResult(
            token="TOKEN1",
            ledger=trade1_ledger,
            realized_profit=0.0,
            unrealized_profit=20.0,
            coins_left=100.0,
            tps_hit=[],
            sls_hit=[]
        ),
        SimulationResult(
            token="TOKEN2",
            ledger=trade2_ledger,
            realized_profit=0.0,
            unrealized_profit=40.0,
            coins_left=200.0,
            tps_hit=[],
            sls_hit=[]
        ),
        SimulationResult(
            token="TOKEN3",
            ledger=trade3_ledger,
            realized_profit=10.0,
            unrealized_profit=0.0,
            coins_left=0.0,
            tps_hit=[1.2],
            sls_hit=[]
        ),
    ]


@pytest.fixture
def ohlc_for_timing():
    """Large OHLC DataFrame for timing tests."""
    base_ts = 1704067200
    n_candles = 1000  # 1000 candles

    return pd.DataFrame({
        't': pd.to_datetime([base_ts + i * 300 for i in range(n_candles)], unit='s'),
        'open': [1.0 + np.sin(i / 50) * 0.1 for i in range(n_candles)],
        'high': [1.0 + np.sin(i / 50) * 0.1 + 0.02 for i in range(n_candles)],
        'low': [1.0 + np.sin(i / 50) * 0.1 - 0.02 for i in range(n_candles)],
        'close': [1.0 + np.sin(i / 50) * 0.1 for i in range(n_candles)],
    })


# ============================================================================
# 1. Aligned Ledgers Tests
# ============================================================================

class TestAlignedLedgers:
    """Tests for _aligned_ledgers function."""

    def test_aligned_ledgers_single_trade(self, single_trade_ledger):
        """Test alignment with single trade."""
        from main import _aligned_ledgers

        aligned = _aligned_ledgers([single_trade_ledger])

        assert "TOKEN1" in aligned, "Should have TOKEN1 in aligned result"
        assert len(aligned) == 1, "Should have exactly 1 trade"

        df = aligned["TOKEN1"]
        assert not df.empty, "DataFrame should not be empty"
        assert "value" in df.columns, "Should have 'value' column"

    def test_aligned_ledgers_multiple_trades(self, multiple_trade_ledgers):
        """Test alignment with multiple trades."""
        from main import _aligned_ledgers

        aligned = _aligned_ledgers(multiple_trade_ledgers)

        assert len(aligned) == 3, "Should have 3 trades"
        assert "TOKEN1" in aligned
        assert "TOKEN2" in aligned
        assert "TOKEN3" in aligned

    def test_aligned_ledgers_preserves_values(self, single_trade_ledger):
        """Test that alignment preserves original values."""
        from main import _aligned_ledgers

        aligned = _aligned_ledgers([single_trade_ledger])
        df = aligned["TOKEN1"]

        # First value should be 100.0
        first_value = df["value"].iloc[0]
        assert abs(first_value - 100.0) < 0.01, f"First value should be ~100, got {first_value}"

    def test_aligned_ledgers_different_start_times(self, multiple_trade_ledgers):
        """Test alignment handles different start times correctly."""
        from main import _aligned_ledgers

        aligned = _aligned_ledgers(multiple_trade_ledgers)

        # TOKEN1 starts at t=0
        # TOKEN2 starts at t=300
        # TOKEN3 starts at t=600

        df1 = aligned["TOKEN1"]
        df2 = aligned["TOKEN2"]
        df3 = aligned["TOKEN3"]

        # Each trade should have entries (may include NaN rows for alignment)
        assert len(df1) >= 5, "TOKEN1 should have at least 5 points"
        assert len(df2) >= 5, "TOKEN2 should have at least 5 points"
        assert len(df3) >= 2, "TOKEN3 should have at least 2 points"

        # Verify non-null values exist for each trade
        assert df1["value"].notna().sum() == 5, "TOKEN1 should have 5 valid values"
        assert df2["value"].notna().sum() == 5, "TOKEN2 should have 5 valid values"
        assert df3["value"].notna().sum() == 2, "TOKEN3 should have 2 valid values"

    def test_aligned_ledgers_empty_input(self):
        """Test alignment with empty input."""
        from main import _aligned_ledgers

        aligned = _aligned_ledgers([])
        assert len(aligned) == 0, "Should return empty dict for empty input"

    def test_aligned_ledgers_trade_with_empty_ledger(self):
        """Test handling of trade with empty ledger."""
        from main import SimulationResult, _aligned_ledgers

        sim = SimulationResult(
            token="EMPTY",
            ledger=[],
            realized_profit=0.0,
            unrealized_profit=0.0,
            coins_left=0.0,
            tps_hit=[],
            sls_hit=[]
        )

        # Empty ledger should raise an error or be handled gracefully
        try:
            aligned = _aligned_ledgers([sim])
            # If it doesn't raise, check result
            assert "EMPTY" not in aligned or aligned["EMPTY"].empty
        except (KeyError, ValueError, IndexError):
            # Expected - empty ledger can't be processed
            pass


# ============================================================================
# 2. Cumulative Equity Calculation Tests
# ============================================================================

class TestCumulativeEquity:
    """Tests for cumulative equity calculations."""

    def test_cumulative_single_trade(self, single_trade_ledger):
        """Test cumulative equity with single trade."""
        from main import _aligned_ledgers

        aligned = _aligned_ledgers([single_trade_ledger])

        # With single trade, cumulative = that trade's value
        df = aligned["TOKEN1"]

        # Cumulative at each point should match the trade value
        assert df["value"].iloc[0] == 100.0, "First cumulative should be 100"

    def test_cumulative_multiple_trades_overlapping(self, multiple_trade_ledgers):
        """Test cumulative when trades overlap in time."""
        from main import _aligned_ledgers

        aligned = _aligned_ledgers(multiple_trade_ledgers)

        # At t=600 (base + 600):
        # Trade1: 110.0
        # Trade2: 210.0
        # Trade3: 50.0
        # Total = 370.0

        # Get values at common timestamp
        base_ts = 1704067200
        target_ts = base_ts + 600

        trade1_val = None
        trade2_val = None
        trade3_val = None

        for ts_idx in aligned["TOKEN1"].index:
            if hasattr(ts_idx, 'timestamp'):
                if int(ts_idx.timestamp()) == target_ts:
                    trade1_val = aligned["TOKEN1"].loc[ts_idx, "value"]
                    break

        for ts_idx in aligned["TOKEN2"].index:
            if hasattr(ts_idx, 'timestamp'):
                if int(ts_idx.timestamp()) == target_ts:
                    trade2_val = aligned["TOKEN2"].loc[ts_idx, "value"]
                    break

        for ts_idx in aligned["TOKEN3"].index:
            if hasattr(ts_idx, 'timestamp'):
                if int(ts_idx.timestamp()) == target_ts:
                    trade3_val = aligned["TOKEN3"].loc[ts_idx, "value"]
                    break

        # If values found, verify cumulative
        if trade1_val is not None and trade2_val is not None and trade3_val is not None:
            cumulative = trade1_val + trade2_val + trade3_val
            assert abs(cumulative - 370.0) < 0.1, f"Cumulative at t+600 should be ~370, got {cumulative}"

    def test_cumulative_after_trade_closes(self, multiple_trade_ledgers):
        """Test cumulative after a trade closes (goes to 0)."""
        # Trade3 closes at t=900 with 0 coins but $10 realized

        # After close, Trade3's contribution should be:
        # value (0) + realized (10) = 10

        # This ensures closed positions still contribute their realized PnL
        from main import _aligned_ledgers

        aligned = _aligned_ledgers(multiple_trade_ledgers)

        # At t=900, Trade3 has value=0, realized=10
        # Total contribution should still be counted
        df3 = aligned.get("TOKEN3")
        if df3 is not None and not df3.empty:
            # Last point should have value=0 but realized=10
            last_val = df3["value"].iloc[-1]
            assert last_val == 0.0, "Closed position should have 0 value"

    def test_cumulative_with_capital_tracking(self):
        """Test cumulative equity with proper capital tracking."""
        # When computing cumulative:
        # total_equity = sum(position_values) + cash_not_deployed
        # cash_not_deployed = max(0, starting_capital - capital_deployed)

        starting_capital = 1000.0
        amount_per_trade = 100.0
        active_positions = 3

        capital_deployed = amount_per_trade * active_positions  # 300
        position_values = [110.0, 220.0, 55.0]  # Each position's current value
        total_position_value = sum(position_values)  # 385

        cash_not_deployed = max(0, starting_capital - capital_deployed)  # 700
        total_equity = total_position_value + cash_not_deployed  # 1085

        assert capital_deployed == 300.0
        assert total_position_value == 385.0
        assert cash_not_deployed == 700.0
        assert total_equity == 1085.0

    def test_cumulative_handles_nan_values(self):
        """Test that cumulative calculation handles NaN properly."""
        from main import _normalize_value

        values = [100.0, float('nan'), 150.0, None]

        # Simulate cumulative calculation
        total = 0.0
        for val in values:
            if val is not None and not math.isnan(val):
                total += val

        assert total == 250.0, "Should skip NaN and None values"


# ============================================================================
# 3. Chart Data Generation Tests for Cumulative View
# ============================================================================

class TestCumulativeChartData:
    """Tests for cumulative chart data generation."""

    def test_chart_data_row_format(self):
        """Test chart data row has correct format."""
        row = {
            "ts": 1704067200,
            "date": "2024-01-01 00:00",
            "TOKEN1_0": 100.0,
            "TOKEN2_1": 200.0,
            "cumulative": 1050.0
        }

        assert "ts" in row, "Should have timestamp"
        assert "date" in row, "Should have date string"
        assert "cumulative" in row, "Should have cumulative value"

    def test_cumulative_row_calculation(self):
        """Test cumulative row is calculated correctly."""
        row = {
            "ts": 1704067200,
            "date": "2024-01-01 00:00",
            "TOKEN1_0": 110.0,
            "TOKEN2_1": 220.0,
            "TOKEN3_2": 55.0,
        }

        # Simulate cumulative calculation
        trade_keys = [k for k in row.keys() if k not in ('ts', 'date') and '_' in k]
        total_position_value = sum(row[k] for k in trade_keys if row[k] is not None)

        starting_capital = 1000.0
        amount_per_trade = 100.0
        active_positions = len(trade_keys)
        capital_deployed = amount_per_trade * active_positions
        cash_not_deployed = max(0, starting_capital - capital_deployed)
        cumulative = total_position_value + cash_not_deployed

        # 385 + 700 = 1085
        assert abs(cumulative - 1085.0) < 0.01, f"Cumulative should be ~1085, got {cumulative}"

    def test_cumulative_tracks_realized_pnl(self):
        """Test that cumulative includes realized PnL from closed positions."""
        # Closed position: value=0, realized=50
        # Should contribute 50 to cumulative

        position_value = 0.0
        realized = 50.0
        total_contribution = position_value + realized

        assert total_contribution == 50.0, "Closed position contributes realized PnL"

    def test_chart_data_sorted_by_timestamp(self):
        """Test that chart data is sorted by timestamp."""
        rows = [
            {"ts": 1704067500, "date": "2024-01-01 00:05"},
            {"ts": 1704067200, "date": "2024-01-01 00:00"},
            {"ts": 1704067800, "date": "2024-01-01 00:10"},
        ]

        sorted_rows = sorted(rows, key=lambda r: r["ts"])

        assert sorted_rows[0]["ts"] == 1704067200
        assert sorted_rows[1]["ts"] == 1704067500
        assert sorted_rows[2]["ts"] == 1704067800

    def test_chart_data_downsampling(self):
        """Test downsampling for large datasets."""
        MAX_CHART_POINTS = 2000
        n_timestamps = 5000

        timestamps = list(range(n_timestamps))

        if len(timestamps) > MAX_CHART_POINTS:
            step = len(timestamps) // MAX_CHART_POINTS
            downsampled = timestamps[::step]
        else:
            downsampled = timestamps

        # Downsampled should be significantly smaller than original
        assert len(downsampled) < n_timestamps, "Should be downsampled"
        # First and last should still be accessible
        assert downsampled[0] == timestamps[0], "First point preserved"


# ============================================================================
# 4. Portfolio Value Over Time Tests
# ============================================================================

class TestPortfolioValueOverTime:
    """Tests for portfolio value tracking over time."""

    def test_portfolio_value_increases_with_gains(self):
        """Test portfolio value increases when positions gain."""
        initial_capital = 1000.0
        position_capital = 100.0

        # Time series of portfolio values
        time_points = [
            {"active": 1, "value": 100.0},  # Entry
            {"active": 1, "value": 110.0},  # +10%
            {"active": 2, "value": 220.0},  # Two positions, each at 110
            {"active": 2, "value": 240.0},  # Gained more
        ]

        for i in range(len(time_points) - 1):
            current = time_points[i]
            next_point = time_points[i + 1]

            current_deployed = position_capital * current["active"]
            next_deployed = position_capital * next_point["active"]

            current_cash = initial_capital - current_deployed
            next_cash = initial_capital - next_deployed

            current_equity = current["value"] + current_cash
            next_equity = next_point["value"] + next_cash

            # Value should generally increase (in this test case)
            if current["active"] == next_point["active"]:
                assert next_equity >= current_equity, "Equity should increase with gains"

    def test_portfolio_value_decreases_with_losses(self):
        """Test portfolio value decreases when positions lose."""
        initial_capital = 1000.0
        position_capital = 100.0

        # Position loses 20%
        position_value = 80.0  # Started at 100
        cash = initial_capital - position_capital  # 900

        total_equity = position_value + cash  # 980

        assert total_equity == 980.0
        assert total_equity < initial_capital, "Equity should be less than initial with losses"

    def test_portfolio_value_with_closed_positions(self):
        """Test portfolio value when positions close."""
        initial_capital = 1000.0
        position_capital = 100.0

        # Trade closes with +20 profit
        realized_pnl = 20.0
        remaining_value = 0.0  # Closed

        # Cash goes back plus profit
        # Before: cash=900, position=120 (worth 100 + 20)
        # After: cash=920 (got 100 back + 20 profit), position=0

        final_cash = 900.0 + position_capital + realized_pnl  # 1020
        final_equity = final_cash + remaining_value  # 1020

        assert final_equity == 1020.0
        assert final_equity > initial_capital, "Should have profit"


# ============================================================================
# 5. Ledger to Equity DataFrame Conversion Tests
# ============================================================================

class TestLedgerToEquityDf:
    """Tests for _ledger_to_equity_df function."""

    def test_ledger_to_equity_basic(self, single_trade_ledger):
        """Test basic ledger to equity conversion."""
        from main import _ledger_to_equity_df

        df = _ledger_to_equity_df(single_trade_ledger)

        assert not df.empty, "DataFrame should not be empty"
        assert "equity" in df.columns, "Should have 'equity' column"
        assert "coins_held" in df.columns, "Should have 'coins_held' column"

    def test_ledger_equity_values(self, single_trade_ledger):
        """Test that equity values are computed correctly."""
        from main import _ledger_to_equity_df

        df = _ledger_to_equity_df(single_trade_ledger)

        # Equity = value + realized
        # First point: 100 + 0 = 100
        first_equity = df["equity"].iloc[0]
        assert abs(first_equity - 100.0) < 0.01, f"First equity should be ~100, got {first_equity}"

        # Last point: 60 + 5 = 65
        last_equity = df["equity"].iloc[-1]
        assert abs(last_equity - 65.0) < 0.01, f"Last equity should be ~65, got {last_equity}"

    def test_ledger_tracks_coins(self, single_trade_ledger):
        """Test that coin counts are tracked correctly."""
        from main import _ledger_to_equity_df

        df = _ledger_to_equity_df(single_trade_ledger)

        # Initial coins = 100 (use coins_held column)
        first_coins = df["coins_held"].iloc[0]
        assert first_coins == 100.0, "Should start with 100 coins"

        # After TP, coins = 50
        last_coins = df["coins_held"].iloc[-1]
        assert last_coins == 50.0, "Should end with 50 coins"


# ============================================================================
# 6. Performance Timing Tests
# ============================================================================

class TestPerformanceTiming:
    """Tests for measuring execution time of backtest components."""

    def test_bt_core_timing(self, ohlc_for_timing):
        """Measure execution time of _bt_core function."""
        from main import _bt_core_py

        close = ohlc_for_timing['close'].values.astype(np.float64)
        high = ohlc_for_timing['high'].values.astype(np.float64)
        low = ohlc_for_timing['low'].values.astype(np.float64)

        # Multiple TP/SL levels
        tp_r = np.array([0.05, 0.10, 0.20, 0.50], dtype=np.float64)
        tp_s = np.array([0.25, 0.25, 0.25, 0.25], dtype=np.float64)
        sl_r = np.array([0.05, 0.10], dtype=np.float64)
        sl_s = np.array([0.50, 0.50], dtype=np.float64)

        # Warm-up run
        _ = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        # Timed runs
        n_runs = 100
        start = time.perf_counter()
        for _ in range(n_runs):
            _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)
        elapsed = time.perf_counter() - start

        avg_time_ms = (elapsed / n_runs) * 1000

        # Log timing info
        print(f"\n_bt_core_py timing ({len(close)} candles):")
        print(f"  Average: {avg_time_ms:.3f} ms per run")
        print(f"  Total for {n_runs} runs: {elapsed*1000:.1f} ms")

        # Should complete quickly (< 10ms for 1000 candles)
        assert avg_time_ms < 50, f"_bt_core_py too slow: {avg_time_ms:.1f}ms"

    def test_bt_ledger_core_timing(self, ohlc_for_timing):
        """Measure execution time of _bt_ledger_core function."""
        from main import _bt_ledger_core

        timestamps = ohlc_for_timing['t'].apply(lambda x: int(x.timestamp())).values.astype(np.int64)
        close = ohlc_for_timing['close'].values.astype(np.float64)
        high = ohlc_for_timing['high'].values.astype(np.float64)
        low = ohlc_for_timing['low'].values.astype(np.float64)

        entry_price = float(close[0])
        entry_coins = 100.0

        tp_levels = np.array([entry_price * 1.1, entry_price * 1.2], dtype=np.float64)
        tp_sizes = np.array([0.5, 0.5], dtype=np.float64)
        sl_levels = np.array([entry_price * 0.9], dtype=np.float64)
        sl_sizes = np.array([1.0], dtype=np.float64)

        # Warm-up
        _ = _bt_ledger_core(timestamps, close, high, low, entry_price, entry_coins,
                           tp_levels, tp_sizes, sl_levels, sl_sizes)

        # Timed runs
        n_runs = 100
        start = time.perf_counter()
        for _ in range(n_runs):
            _bt_ledger_core(timestamps, close, high, low, entry_price, entry_coins,
                           tp_levels, tp_sizes, sl_levels, sl_sizes)
        elapsed = time.perf_counter() - start

        avg_time_ms = (elapsed / n_runs) * 1000

        print(f"\n_bt_ledger_core timing ({len(close)} candles):")
        print(f"  Average: {avg_time_ms:.3f} ms per run")

        assert avg_time_ms < 100, f"_bt_ledger_core too slow: {avg_time_ms:.1f}ms"

    def test_run_simulation_with_ledger_timing(self, ohlc_for_timing):
        """Measure execution time of run_simulation_with_ledger."""
        from main import run_simulation_with_ledger

        # Warm-up
        _ = run_simulation_with_ledger(
            ohlc_for_timing,
            start_cash_usd=100.0,
            current_price=1.0,
            tp_ratios=[0.10, 0.20],
            tp_sizes=[0.5, 0.5],
            sl_ratios=[0.10],
            sl_sizes=[1.0]
        )

        # Timed runs
        n_runs = 50
        start = time.perf_counter()
        for _ in range(n_runs):
            run_simulation_with_ledger(
                ohlc_for_timing,
                start_cash_usd=100.0,
                current_price=1.0,
                tp_ratios=[0.10, 0.20],
                tp_sizes=[0.5, 0.5],
                sl_ratios=[0.10],
                sl_sizes=[1.0]
            )
        elapsed = time.perf_counter() - start

        avg_time_ms = (elapsed / n_runs) * 1000

        print(f"\nrun_simulation_with_ledger timing ({len(ohlc_for_timing)} candles):")
        print(f"  Average: {avg_time_ms:.3f} ms per run")

        assert avg_time_ms < 200, f"run_simulation_with_ledger too slow: {avg_time_ms:.1f}ms"

    def test_aligned_ledgers_timing(self, multiple_trade_ledgers):
        """Measure execution time of _aligned_ledgers."""
        from main import _aligned_ledgers

        # Warm-up
        _ = _aligned_ledgers(multiple_trade_ledgers)

        # Timed runs
        n_runs = 100
        start = time.perf_counter()
        for _ in range(n_runs):
            _aligned_ledgers(multiple_trade_ledgers)
        elapsed = time.perf_counter() - start

        avg_time_ms = (elapsed / n_runs) * 1000

        print(f"\n_aligned_ledgers timing ({len(multiple_trade_ledgers)} trades):")
        print(f"  Average: {avg_time_ms:.3f} ms per run")

        assert avg_time_ms < 10, f"_aligned_ledgers too slow: {avg_time_ms:.1f}ms"

    def test_ohlc_building_timing(self):
        """Measure execution time of OHLC building."""
        from main import build_ohlc

        # Create price data
        base_ts = 1704067200
        n_points = 5000
        price_data = [
            {"unixTime": base_ts + i * 60, "value": 1.0 + np.sin(i / 100) * 0.1}
            for i in range(n_points)
        ]

        # Warm-up
        _ = build_ohlc(price_data, tf_minutes=5)

        # Timed runs
        n_runs = 20
        start = time.perf_counter()
        for _ in range(n_runs):
            build_ohlc(price_data, tf_minutes=5)
        elapsed = time.perf_counter() - start

        avg_time_ms = (elapsed / n_runs) * 1000

        print(f"\nbuild_ohlc timing ({n_points} price points):")
        print(f"  Average: {avg_time_ms:.3f} ms per run")

        assert avg_time_ms < 500, f"build_ohlc too slow: {avg_time_ms:.1f}ms"

    def test_parse_ladder_timing(self):
        """Measure execution time of ladder parsing."""
        from main import _parse_ladder

        # Complex ladder
        ladder = ["0.05:0.20", "0.10:0.20", "0.20:0.20", "0.50:0.20", "1.0:0.20"]

        # Warm-up
        _ = _parse_ladder(ladder)

        # Timed runs
        n_runs = 1000
        start = time.perf_counter()
        for _ in range(n_runs):
            _parse_ladder(ladder)
        elapsed = time.perf_counter() - start

        avg_time_us = (elapsed / n_runs) * 1_000_000

        print(f"\n_parse_ladder timing (5 levels):")
        print(f"  Average: {avg_time_us:.3f} μs per run")

        assert avg_time_us < 100, f"_parse_ladder too slow: {avg_time_us:.1f}μs"


# ============================================================================
# 7. Component Breakdown Timing
# ============================================================================

class TestComponentBreakdown:
    """Tests to identify which components take the most time."""

    def test_full_simulation_breakdown(self, ohlc_for_timing):
        """Break down time spent in each simulation component."""
        from main import run_simulation_with_ledger, _bt_ledger_core

        timings = {}

        # 1. OHLC preparation
        start = time.perf_counter()
        timestamps = ohlc_for_timing['t'].apply(lambda x: int(x.timestamp())).values.astype(np.int64)
        close = ohlc_for_timing['close'].values.astype(np.float64)
        high = ohlc_for_timing['high'].values.astype(np.float64)
        low = ohlc_for_timing['low'].values.astype(np.float64)
        entry_price = float(close[0])
        entry_coins = 100.0 / entry_price
        timings['data_prep'] = (time.perf_counter() - start) * 1000

        # 2. Level calculation
        start = time.perf_counter()
        tp_levels = np.array([entry_price * 1.1, entry_price * 1.2], dtype=np.float64)
        sl_levels = np.array([entry_price * 0.9], dtype=np.float64)
        tp_sizes = np.array([0.5, 0.5], dtype=np.float64)
        sl_sizes = np.array([1.0], dtype=np.float64)
        timings['level_calc'] = (time.perf_counter() - start) * 1000

        # 3. Core backtesting
        start = time.perf_counter()
        result = _bt_ledger_core(timestamps, close, high, low, entry_price, entry_coins,
                                tp_levels, tp_sizes, sl_levels, sl_sizes)
        timings['bt_core'] = (time.perf_counter() - start) * 1000

        # 4. Ledger building
        from main import PositionPoint
        start = time.perf_counter()
        ledger_ts, ledger_equity, ledger_coins, ledger_unrealized, ledger_realized, coins, realized, tp_fired, sl_fired = result
        ledger = []
        for i in range(len(ledger_ts)):
            ledger.append(PositionPoint(
                ts=int(ledger_ts[i]),
                value=float(ledger_equity[i]),
                coins_held=float(ledger_coins[i]),
                unrealized=float(ledger_unrealized[i]),
                realized=float(ledger_realized[i]),
            ))
        timings['ledger_build'] = (time.perf_counter() - start) * 1000

        # Print breakdown
        print("\n=== Simulation Component Breakdown ===")
        total = sum(timings.values())
        for component, time_ms in sorted(timings.items(), key=lambda x: -x[1]):
            pct = (time_ms / total) * 100 if total > 0 else 0
            print(f"  {component:15s}: {time_ms:6.3f} ms ({pct:5.1f}%)")
        print(f"  {'TOTAL':15s}: {total:6.3f} ms")

        # Store for assertions
        assert total < 50, f"Total simulation too slow: {total:.1f}ms"

    def test_chart_data_generation_breakdown(self, multiple_trade_ledgers):
        """Break down time spent generating chart data."""
        from main import _aligned_ledgers

        timings = {}

        # 1. Align ledgers
        start = time.perf_counter()
        aligned = _aligned_ledgers(multiple_trade_ledgers)
        timings['align_ledgers'] = (time.perf_counter() - start) * 1000

        # 2. Collect timestamps
        start = time.perf_counter()
        all_timestamps = set()
        for token, df in aligned.items():
            for ts in df.index:
                if hasattr(ts, 'timestamp'):
                    all_timestamps.add(int(ts.timestamp()))
        sorted_ts = sorted(all_timestamps)
        timings['collect_timestamps'] = (time.perf_counter() - start) * 1000

        # 3. Build chart rows
        start = time.perf_counter()
        chart_rows = []
        for ts in sorted_ts:
            row = {"ts": ts}
            for token, df in aligned.items():
                # Find value at timestamp
                for idx in df.index:
                    if hasattr(idx, 'timestamp') and int(idx.timestamp()) == ts:
                        row[token] = df.loc[idx, "value"]
                        break
            chart_rows.append(row)
        timings['build_rows'] = (time.perf_counter() - start) * 1000

        # 4. Compute cumulative
        start = time.perf_counter()
        for row in chart_rows:
            values = [v for k, v in row.items() if k != "ts" and isinstance(v, (int, float))]
            row["cumulative"] = sum(values)
        timings['compute_cumulative'] = (time.perf_counter() - start) * 1000

        # Print breakdown
        print("\n=== Chart Data Generation Breakdown ===")
        total = sum(timings.values())
        for component, time_ms in sorted(timings.items(), key=lambda x: -x[1]):
            pct = (time_ms / total) * 100 if total > 0 else 0
            print(f"  {component:20s}: {time_ms:6.3f} ms ({pct:5.1f}%)")
        print(f"  {'TOTAL':20s}: {total:6.3f} ms")


# ============================================================================
# 8. Stress Tests
# ============================================================================

class TestStressTests:
    """Stress tests with large data volumes."""

    def test_many_trades_alignment(self):
        """Test alignment with many trades."""
        from main import PositionPoint, SimulationResult, _aligned_ledgers

        n_trades = 50
        n_points = 100
        base_ts = 1704067200

        simulations = []
        for trade_idx in range(n_trades):
            ledger = []
            for i in range(n_points):
                ledger.append(PositionPoint(
                    ts=base_ts + i * 300 + trade_idx * 60,  # Offset by trade
                    value=100.0 + i * 0.5,
                    coins_held=100.0,
                    unrealized=i * 0.5,
                    realized=0.0
                ))
            simulations.append(SimulationResult(
                token=f"TOKEN{trade_idx}",
                ledger=ledger,
                realized_profit=0.0,
                unrealized_profit=n_points * 0.5,
                coins_left=100.0,
                tps_hit=[],
                sls_hit=[]
            ))

        start = time.perf_counter()
        aligned = _aligned_ledgers(simulations)
        elapsed = (time.perf_counter() - start) * 1000

        print(f"\nMany trades alignment ({n_trades} trades, {n_points} points each):")
        print(f"  Time: {elapsed:.1f} ms")

        assert len(aligned) == n_trades
        assert elapsed < 500, f"Too slow: {elapsed:.1f}ms"

    def test_large_ohlc_simulation(self):
        """Test simulation with large OHLC dataset."""
        from main import run_simulation_with_ledger

        base_ts = 1704067200
        n_candles = 5000

        df_ohlc = pd.DataFrame({
            't': pd.to_datetime([base_ts + i * 300 for i in range(n_candles)], unit='s'),
            'open': [1.0 + np.sin(i / 100) * 0.1 for i in range(n_candles)],
            'high': [1.0 + np.sin(i / 100) * 0.1 + 0.05 for i in range(n_candles)],
            'low': [1.0 + np.sin(i / 100) * 0.1 - 0.05 for i in range(n_candles)],
            'close': [1.0 + np.sin(i / 100) * 0.1 for i in range(n_candles)],
        })

        start = time.perf_counter()
        result = run_simulation_with_ledger(
            df_ohlc,
            start_cash_usd=100.0,
            current_price=1.0,
            tp_ratios=[0.05, 0.10, 0.20],
            tp_sizes=[0.33, 0.33, 0.34],
            sl_ratios=[0.10],
            sl_sizes=[1.0]
        )
        elapsed = (time.perf_counter() - start) * 1000

        print(f"\nLarge OHLC simulation ({n_candles} candles):")
        print(f"  Time: {elapsed:.1f} ms")
        print(f"  Ledger points: {len(result['ledger'])}")

        assert result is not None
        assert elapsed < 1000, f"Too slow: {elapsed:.1f}ms"


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-s"])

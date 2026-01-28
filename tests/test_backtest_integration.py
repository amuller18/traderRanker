"""
Integration tests for backtesting API endpoints.

Tests cover:
1. API endpoint validation
2. Request/response format
3. Error handling
4. End-to-end backtest flow with mocked data
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
from unittest.mock import patch, MagicMock, AsyncMock
import json
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ============================================================================
# Mock Data Fixtures
# ============================================================================

@pytest.fixture
def mock_price_dataframe():
    """Create mock price data DataFrame."""
    base_ts = int(datetime(2024, 1, 1, tzinfo=timezone.utc).timestamp())
    return pd.DataFrame([
        {"timestamp": base_ts + i*300, "price": 1.0 + (i * 0.005), "ca": "test_token"}
        for i in range(200)  # 200 data points
    ])


@pytest.fixture
def mock_ohlc_dataframe():
    """Create mock OHLC DataFrame."""
    base_ts = int(datetime(2024, 1, 1, tzinfo=timezone.utc).timestamp())
    return pd.DataFrame({
        't': pd.to_datetime([base_ts + i*300 for i in range(100)], unit='s'),
        'open': [1.0 + i*0.005 for i in range(100)],
        'high': [1.0 + i*0.005 + 0.002 for i in range(100)],
        'low': [1.0 + i*0.005 - 0.002 for i in range(100)],
        'close': [1.0 + i*0.005 for i in range(100)]
    })


@pytest.fixture
def valid_backtest_request():
    """Create a valid backtest request."""
    return {
        "trades": [
            {
                "token": "So11111111111111111111111111111111111111112",
                "date_called": "2024-01-01T12:00:00Z",
                "caller": "TestCaller"
            }
        ],
        "amount_usd": 100.0,
        "initial_capital": 1000.0,
        "timeframe_minutes": 15,
        "tp": ["0.10:0.50", "0.20:0.50"],
        "sl": ["0.10:1.0"]
    }


# ============================================================================
# 1. Request Validation Tests
# ============================================================================

class TestRequestValidation:
    """Tests for API request validation."""

    def test_valid_request_format(self, valid_backtest_request):
        """Test that valid request passes validation."""
        from main import TradeBasedSimulationRequest

        # Should not raise
        req = TradeBasedSimulationRequest(**valid_backtest_request)

        assert req.amount_usd == 100.0
        assert req.initial_capital == 1000.0
        assert len(req.trades) == 1

    def test_invalid_amount_usd_zero(self, valid_backtest_request):
        """Test that zero amount_usd is rejected."""
        from main import TradeBasedSimulationRequest
        from pydantic import ValidationError

        valid_backtest_request["amount_usd"] = 0

        with pytest.raises(ValidationError):
            TradeBasedSimulationRequest(**valid_backtest_request)

    def test_invalid_amount_usd_negative(self, valid_backtest_request):
        """Test that negative amount_usd is rejected."""
        from main import TradeBasedSimulationRequest
        from pydantic import ValidationError

        valid_backtest_request["amount_usd"] = -100

        with pytest.raises(ValidationError):
            TradeBasedSimulationRequest(**valid_backtest_request)

    def test_invalid_timeframe(self, valid_backtest_request):
        """Test that invalid timeframe is rejected."""
        from main import TradeBasedSimulationRequest
        from pydantic import ValidationError

        # Timeframe too large (max is 1440)
        valid_backtest_request["timeframe_minutes"] = 2000

        with pytest.raises(ValidationError):
            TradeBasedSimulationRequest(**valid_backtest_request)

    def test_default_ladder_values(self):
        """Test that default ladder values are applied when provided."""
        from main import TradeBasedSimulationRequest

        # Test with explicit ladder values
        req = TradeBasedSimulationRequest(
            trades=[{
                "token": "So11111111111111111111111111111111111111112",
                "date_called": "2024-01-01T12:00:00Z"
            }],
            amount_usd=100.0,
            initial_capital=1000.0,
            tp=["0.05:1.0"],  # Explicitly provided
            sl=[]
        )

        # Should have provided TP ladder
        assert req.tp == ["0.05:1.0"]
        # Should have provided SL (empty)
        assert req.sl == []


class TestTradeInfoValidation:
    """Tests for TradeInfo validation."""

    def test_valid_trade_info(self):
        """Test valid trade info."""
        from main import TradeInfo

        trade = TradeInfo(
            token="So11111111111111111111111111111111111111112",
            date_called="2024-01-01T12:00:00Z",
            caller="TestCaller"
        )

        assert trade.token == "So11111111111111111111111111111111111111112"
        assert trade.caller == "TestCaller"

    def test_trade_info_optional_caller(self):
        """Test that caller is optional."""
        from main import TradeInfo

        trade = TradeInfo(
            token="So11111111111111111111111111111111111111112",
            date_called="2024-01-01T12:00:00Z"
        )

        assert trade.caller is None


# ============================================================================
# 2. Response Format Tests
# ============================================================================

class TestResponseFormat:
    """Tests for API response format."""

    def test_backtest_summary_format(self):
        """Test BacktestSummary has all required fields."""
        from main import BacktestSummary

        summary = BacktestSummary()

        # Check all expected fields exist
        assert hasattr(summary, 'total_profit')
        assert hasattr(summary, 'realized_profit')
        assert hasattr(summary, 'unrealized_profit')
        assert hasattr(summary, 'avg_profit')
        assert hasattr(summary, 'avg_trade_roi')
        assert hasattr(summary, 'account_roi')
        assert hasattr(summary, 'win_rate')
        assert hasattr(summary, 'final_portfolio_value')
        assert hasattr(summary, 'starting_capital')
        assert hasattr(summary, 'total_trades')
        assert hasattr(summary, 'valid_trades')
        assert hasattr(summary, 'invalid_trades')
        assert hasattr(summary, 'max_drawdown')
        assert hasattr(summary, 'profit_factor')
        assert hasattr(summary, 'winning_trades')
        assert hasattr(summary, 'losing_trades')
        assert hasattr(summary, 'avg_win')
        assert hasattr(summary, 'avg_loss')
        assert hasattr(summary, 'largest_win')
        assert hasattr(summary, 'largest_loss')
        assert hasattr(summary, 'expectancy')
        assert hasattr(summary, 'risk_reward_ratio')

    def test_token_breakdown_format(self):
        """Test TokenBreakdown has all required fields."""
        from main import TokenBreakdown

        breakdown = TokenBreakdown(token="test")

        # Check all expected fields exist
        assert hasattr(breakdown, 'token')
        assert hasattr(breakdown, 'trade_id')
        assert hasattr(breakdown, 'time_called')
        assert hasattr(breakdown, 'entry_price')
        assert hasattr(breakdown, 'final_price')
        assert hasattr(breakdown, 'ath_price')
        assert hasattr(breakdown, 'ath_percentage')
        assert hasattr(breakdown, 'total_pnl')
        assert hasattr(breakdown, 'realized_pnl')
        assert hasattr(breakdown, 'unrealized_pnl')
        assert hasattr(breakdown, 'coins_left')
        assert hasattr(breakdown, 'coins_initial')
        assert hasattr(breakdown, 'trade_capital')
        assert hasattr(breakdown, 'final_value')
        assert hasattr(breakdown, 'max_drawdown')
        assert hasattr(breakdown, 'trade_roi')
        assert hasattr(breakdown, 'roi_to_date')
        assert hasattr(breakdown, 'is_valid')
        assert hasattr(breakdown, 'validation_errors')
        assert hasattr(breakdown, 'tps_hit')
        assert hasattr(breakdown, 'sls_hit')

    def test_caller_stats_format(self):
        """Test CallerStats has all required fields."""
        from main import CallerStats

        stats = CallerStats(caller="TestCaller")

        assert hasattr(stats, 'caller')
        assert hasattr(stats, 'total_trades')
        assert hasattr(stats, 'valid_trades')
        assert hasattr(stats, 'winning_trades')
        assert hasattr(stats, 'losing_trades')
        assert hasattr(stats, 'total_pnl')
        assert hasattr(stats, 'avg_trade_roi')
        assert hasattr(stats, 'win_rate')
        assert hasattr(stats, 'profit_factor')

    def test_backtest_response_format(self):
        """Test BacktestResponse has all required fields."""
        from main import BacktestResponse, BacktestSummary

        response = BacktestResponse(
            summary=BacktestSummary(),
            breakdowns=[],
            simulations=[]
        )

        assert hasattr(response, 'summary')
        assert hasattr(response, 'breakdowns')
        assert hasattr(response, 'simulations')
        assert hasattr(response, 'chart_data')
        assert hasattr(response, 'cumulative_chart_data')
        assert hasattr(response, 'caller_stats')


# ============================================================================
# 3. Ladder Parsing Integration Tests
# ============================================================================

class TestLadderParsingIntegration:
    """Tests for ladder parsing in context of full request."""

    def test_multiple_tp_levels_parsed(self, valid_backtest_request):
        """Test that multiple TP levels are parsed correctly."""
        from main import _parse_ladder

        tp_input = valid_backtest_request["tp"]  # ["0.10:0.50", "0.20:0.50"]

        ratios, sells = _parse_ladder(tp_input)

        assert ratios == [0.10, 0.20], "TP ratios should be [0.10, 0.20]"
        assert sells == [0.50, 0.50], "TP sells should be [0.50, 0.50]"

    def test_sl_level_parsed(self, valid_backtest_request):
        """Test that SL level is parsed correctly."""
        from main import _parse_ladder

        sl_input = valid_backtest_request["sl"]  # ["0.10:1.0"]

        ratios, sells = _parse_ladder(sl_input)

        assert ratios == [0.10], "SL ratio should be [0.10]"
        assert sells == [1.0], "SL sell should be [1.0]"


# ============================================================================
# 4. Simulation Result Tests
# ============================================================================

class TestSimulationResults:
    """Tests for simulation result structures."""

    def test_simulation_result_format(self):
        """Test SimulationResult structure."""
        from main import SimulationResult

        result = SimulationResult(token="test")

        assert hasattr(result, 'token')
        assert hasattr(result, 'ledger')
        assert hasattr(result, 'realized_profit')
        assert hasattr(result, 'unrealized_profit')
        assert hasattr(result, 'coins_left')
        assert hasattr(result, 'tps_hit')
        assert hasattr(result, 'sls_hit')
        assert hasattr(result, 'error')

    def test_position_point_format(self):
        """Test PositionPoint structure."""
        from main import PositionPoint

        point = PositionPoint(
            ts=1704067200,
            value=100.0,
            coins_held=100.0,
            unrealized=0.0,
            realized=0.0
        )

        assert point.ts == 1704067200
        assert point.value == 100.0
        assert point.coins_held == 100.0
        assert point.unrealized == 0.0
        assert point.realized == 0.0


# ============================================================================
# 5. End-to-End Calculation Tests with Mocks
# ============================================================================

class TestEndToEndCalculations:
    """End-to-end calculation tests with mocked data."""

    def test_simulation_with_tp_hit(self, mock_ohlc_dataframe):
        """Test full simulation with TP being hit."""
        from main import run_simulation_with_ledger

        # Modify OHLC to ensure TP is hit
        df = mock_ohlc_dataframe.copy()
        # Entry at 1.0, goes to 1.12 (12% gain) - should hit 10% TP
        df['high'] = [1.0 + i*0.02 for i in range(len(df))]  # Goes up to 1.0 + 99*0.02 = 2.98
        df['close'] = [1.0 + i*0.015 for i in range(len(df))]  # Closes at 1.0 + 99*0.015 = 2.485

        result = run_simulation_with_ledger(
            df,
            start_cash_usd=100.0,
            current_price=2.0,  # Final price
            tp_ratios=[0.10, 0.20],  # 10% and 20% TP
            tp_sizes=[0.30, 0.30],   # Sell 30% at each
            sl_ratios=[],
            sl_sizes=[]
        )

        # TP at 10% should be hit (price goes above 1.10)
        assert len(result["tps_hit"]) > 0, "At least one TP should be hit"

    def test_simulation_with_sl_hit(self):
        """Test full simulation with SL being hit."""
        from main import run_simulation_with_ledger

        # Create OHLC with price drop
        df = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(10)], unit='s'),
            'open': [1.0, 0.95, 0.92, 0.90, 0.88, 0.85, 0.82, 0.80, 0.78, 0.75],
            'high': [1.0, 0.96, 0.93, 0.91, 0.89, 0.86, 0.83, 0.81, 0.79, 0.76],
            'low': [1.0, 0.94, 0.91, 0.89, 0.87, 0.84, 0.81, 0.79, 0.77, 0.74],
            'close': [1.0, 0.95, 0.92, 0.90, 0.88, 0.85, 0.82, 0.80, 0.78, 0.75]
        })

        result = run_simulation_with_ledger(
            df,
            start_cash_usd=100.0,
            current_price=0.75,
            tp_ratios=[],
            tp_sizes=[],
            sl_ratios=[0.10],  # 10% SL at $0.90
            sl_sizes=[1.0]     # Sell all
        )

        # SL at 10% should be hit (price goes below 0.90)
        assert len(result["sls_hit"]) > 0, "SL should be hit"
        assert result["coins_left"] == 0.0, "All coins should be sold"

    def test_simulation_preserves_coins_when_no_trigger(self):
        """Test that coins are preserved when no TP/SL triggers."""
        from main import run_simulation_with_ledger

        # Create OHLC with small price movement (not enough to trigger TP/SL)
        df = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(10)], unit='s'),
            'open': [1.0 + i*0.001 for i in range(10)],
            'high': [1.0 + i*0.001 + 0.005 for i in range(10)],  # +0.5% to +1.4%
            'low': [1.0 + i*0.001 - 0.005 for i in range(10)],   # -0.5% to +0.4%
            'close': [1.0 + i*0.001 for i in range(10)]
        })

        result = run_simulation_with_ledger(
            df,
            start_cash_usd=100.0,
            current_price=1.009,
            tp_ratios=[0.50],  # 50% TP - way above price
            tp_sizes=[0.50],
            sl_ratios=[0.50],  # 50% SL - way below price
            sl_sizes=[1.0]
        )

        # No TP/SL should trigger
        assert len(result["tps_hit"]) == 0, "No TP should trigger"
        assert len(result["sls_hit"]) == 0, "No SL should trigger"

        # 100 coins at $1.0 = 100 coins
        # All should remain
        assert result["coins_left"] == 100.0, f"All 100 coins should remain, got {result['coins_left']}"

    def test_simulation_pnl_correctness(self):
        """Test that PnL calculations are correct."""
        from main import run_simulation_with_ledger

        # Simple case: buy 100 coins at $1, price goes to $1.10, sell 50% at TP
        df = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(5)], unit='s'),
            'open': [1.0, 1.03, 1.06, 1.10, 1.10],
            'high': [1.0, 1.04, 1.08, 1.12, 1.12],  # Hits 10% at $1.10
            'low': [1.0, 1.02, 1.04, 1.08, 1.08],
            'close': [1.0, 1.03, 1.06, 1.10, 1.10]
        })

        result = run_simulation_with_ledger(
            df,
            start_cash_usd=100.0,
            current_price=1.10,
            tp_ratios=[0.10],  # 10% TP at $1.10
            tp_sizes=[0.50],   # Sell 50%
            sl_ratios=[],
            sl_sizes=[]
        )

        # Entry: 100 coins at $1.0
        # Sold: 50 coins at $1.10 -> realized = 50 * (1.10 - 1.0) = $5
        # Remaining: 50 coins at $1.10 -> unrealized = 50 * (1.10 - 1.0) = $5

        assert abs(result["realized_profit"] - 5.0) < 0.1, f"Realized should be ~$5, got {result['realized_profit']}"
        assert abs(result["unrealized_profit"] - 5.0) < 0.1, f"Unrealized should be ~$5, got {result['unrealized_profit']}"
        assert abs(result["coins_left"] - 50.0) < 0.1, f"Should have ~50 coins, got {result['coins_left']}"


# ============================================================================
# 6. Error Handling Tests
# ============================================================================

class TestErrorHandling:
    """Tests for error handling in the backtest system."""

    def test_empty_ohlc_raises_error(self):
        """Test that empty OHLC data raises appropriate error."""
        from main import run_simulation_with_ledger

        df = pd.DataFrame()  # Empty

        with pytest.raises(ValueError, match="Empty"):
            run_simulation_with_ledger(
                df,
                start_cash_usd=100.0,
                current_price=1.0,
                tp_ratios=[],
                tp_sizes=[],
                sl_ratios=[],
                sl_sizes=[]
            )

    def test_invalid_solana_address_detection(self):
        """Test that invalid Solana addresses are detected."""
        from main import is_valid_solana_address

        # Invalid addresses
        assert not is_valid_solana_address("")
        assert not is_valid_solana_address("invalid")
        assert not is_valid_solana_address("0x" + "a" * 40)  # Ethereum-style

        # Valid Solana address
        assert is_valid_solana_address("So11111111111111111111111111111111111111112")

    def test_validation_errors_accumulated(self):
        """Test that multiple validation errors are accumulated."""
        from main import TradeValidationResult

        result = TradeValidationResult()
        result.add_error("Error 1")
        result.add_error("Error 2")
        result.add_error("Error 3")

        assert not result.is_valid
        assert len(result.errors) == 3


# ============================================================================
# 7. Numerical Precision Tests
# ============================================================================

class TestNumericalPrecision:
    """Tests for numerical precision in calculations."""

    def test_float_precision_in_pnl(self):
        """Test that PnL calculations maintain precision."""
        from main import run_simulation_with_ledger

        # Use precise values
        df = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(5)], unit='s'),
            'open': [0.000001, 0.0000011, 0.0000012, 0.0000011, 0.0000012],
            'high': [0.000001, 0.00000115, 0.00000125, 0.00000115, 0.00000125],
            'low': [0.000001, 0.00000105, 0.00000115, 0.00000105, 0.00000115],
            'close': [0.000001, 0.0000011, 0.0000012, 0.0000011, 0.0000012]
        })

        result = run_simulation_with_ledger(
            df,
            start_cash_usd=100.0,
            current_price=0.0000012,
            tp_ratios=[],
            tp_sizes=[],
            sl_ratios=[],
            sl_sizes=[]
        )

        # Verify result is not NaN or Inf
        assert not np.isnan(result["realized_profit"])
        assert not np.isnan(result["unrealized_profit"])
        assert not np.isinf(result["realized_profit"])
        assert not np.isinf(result["unrealized_profit"])

    def test_large_position_precision(self):
        """Test precision with large position sizes."""
        from main import run_simulation_with_ledger

        df = pd.DataFrame({
            't': pd.to_datetime([1704067200 + i*300 for i in range(5)], unit='s'),
            'open': [100.0, 101.0, 102.0, 103.0, 104.0],
            'high': [100.5, 101.5, 102.5, 103.5, 104.5],
            'low': [99.5, 100.5, 101.5, 102.5, 103.5],
            'close': [100.0, 101.0, 102.0, 103.0, 104.0]
        })

        result = run_simulation_with_ledger(
            df,
            start_cash_usd=1000000.0,  # $1M position
            current_price=104.0,
            tp_ratios=[],
            tp_sizes=[],
            sl_ratios=[],
            sl_sizes=[]
        )

        # Entry: 10000 coins at $100
        # Final: 10000 coins at $104
        # Unrealized: 10000 * (104 - 100) = $40,000
        expected_unrealized = 10000 * 4.0

        assert abs(result["unrealized_profit"] - expected_unrealized) < 1.0, f"Expected ~$40k unrealized"


# ============================================================================
# 8. Boundary Condition Tests
# ============================================================================

class TestBoundaryConditions:
    """Tests for boundary conditions."""

    def test_tp_at_exactly_100_percent(self):
        """Test TP at exactly 100% gain."""
        from main import _bt_core_py

        close = np.array([1.0, 1.5, 2.0, 2.0, 2.0])  # 100% gain
        high = close.copy()
        low = close.copy()

        tp_r = np.array([1.0], dtype=np.float64)  # 100% TP
        tp_s = np.array([1.0], dtype=np.float64)
        sl_r = np.array([], dtype=np.float64)
        sl_s = np.array([], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert tp_hit[0] == True, "100% TP should trigger"
        assert size_left == 0.0, "All should be sold"
        # PnL = 1.0 * 1.0 = 1.0 (100% of entry price as profit per unit)
        assert abs(pnl - 1.0) < 0.0001, f"PnL should be 1.0, got {pnl}"

    def test_sl_at_100_percent_loss(self):
        """Test SL at 100% loss (price goes to 0)."""
        from main import _bt_core_py

        close = np.array([1.0, 0.5, 0.0001, 0.0001, 0.0001])  # Near-total loss
        high = close.copy()
        low = np.array([1.0, 0.4, 0.0, 0.0, 0.0])  # Low touches 0

        tp_r = np.array([], dtype=np.float64)
        tp_s = np.array([], dtype=np.float64)
        sl_r = np.array([0.99], dtype=np.float64)  # 99% SL (at $0.01)
        sl_s = np.array([1.0], dtype=np.float64)

        pnl, size_left, tp_hit, sl_hit = _bt_core_py(close, high, low, tp_r, tp_s, sl_r, sl_s)

        assert sl_hit[0] == True, "99% SL should trigger"
        # PnL = 1.0 * (0.01 - 1.0) = -0.99
        assert pnl < 0, "PnL should be negative"

    def test_sell_fraction_at_one(self):
        """Test sell fraction at exactly 1.0 (100%)."""
        from main import _parse_ladder

        # This should be valid
        ratios, sells = _parse_ladder(["0.10:1.0"])

        assert sells[0] == 1.0, "Sell fraction of 1.0 should be valid"

    def test_minimum_valid_ratios(self):
        """Test minimum valid ratio values."""
        from main import _parse_ladder

        # Very small but valid ratio
        ratios, sells = _parse_ladder(["0.001:0.5"])  # 0.1% TP

        assert ratios[0] == 0.001, "Tiny ratio should be accepted"


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

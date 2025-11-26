"""
Phantom Wallet Authentication API

This module provides FastAPI endpoints for Solana wallet-based authentication.
Supports sign-in, account creation, and wallet linking flows.
"""

from .routes import router

__all__ = ["router"]

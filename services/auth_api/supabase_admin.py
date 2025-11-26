"""
Supabase Admin Client for Server-Side Operations

This module provides helper functions to interact with Supabase using the
service role key, which bypasses Row Level Security (RLS) and allows
server-side user creation and session management.

IMPORTANT: This should only be used in backend code, never expose the
service role key to the frontend.
"""

import os
import httpx
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# Supabase configuration from environment variables
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

# Validate configuration
if not SUPABASE_URL:
    logger.warning("NEXT_PUBLIC_SUPABASE_URL not set in environment")
if not SUPABASE_SERVICE_ROLE_KEY:
    logger.warning("SUPABASE_SERVICE_ROLE_KEY not set in environment")


class SupabaseAdmin:
    """
    Admin client for Supabase server-side operations.
    Uses the service role key to bypass RLS.
    """

    def __init__(self):
        self.url = SUPABASE_URL
        self.service_key = SUPABASE_SERVICE_ROLE_KEY
        self.anon_key = SUPABASE_ANON_KEY
        self.rest_url = f"{self.url}/rest/v1"
        self.auth_url = f"{self.url}/auth/v1"

    def _get_headers(self, use_service_role: bool = True) -> Dict[str, str]:
        """Get headers for Supabase API requests."""
        api_key = self.service_key if use_service_role else self.anon_key
        return {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    async def get_wallet_nonce(
        self,
        public_key: str,
        nonce: str
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve a wallet nonce from the database.

        Args:
            public_key: Solana wallet public key
            nonce: The nonce string

        Returns:
            Nonce record or None if not found
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.rest_url}/wallet_nonces",
                    headers=self._get_headers(),
                    params={
                        "public_key": f"eq.{public_key}",
                        "nonce": f"eq.{nonce}",
                        "select": "*"
                    }
                )
                response.raise_for_status()
                results = response.json()
                return results[0] if results else None
            except Exception as e:
                logger.error(f"Error fetching wallet nonce: {e}")
                return None

    async def create_wallet_nonce(
        self,
        public_key: str,
        nonce: str,
        expires_in_seconds: int = 300
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new wallet nonce in the database.

        Args:
            public_key: Solana wallet public key
            nonce: The nonce string
            expires_in_seconds: Expiry time in seconds (default: 5 minutes)

        Returns:
            Created nonce record or None on error
        """
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.rest_url}/wallet_nonces",
                    headers=self._get_headers(),
                    json={
                        "public_key": public_key,
                        "nonce": nonce,
                        "expires_at": expires_at.isoformat(),
                        "used": False
                    }
                )
                response.raise_for_status()
                result = response.json()
                return result[0] if isinstance(result, list) else result
            except Exception as e:
                logger.error(f"Error creating wallet nonce: {e}")
                return None

    async def mark_nonce_as_used(self, nonce_id: str) -> bool:
        """Mark a nonce as used to prevent replay attacks."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(
                    f"{self.rest_url}/wallet_nonces",
                    headers=self._get_headers(),
                    params={"id": f"eq.{nonce_id}"},
                    json={"used": True}
                )
                response.raise_for_status()
                return True
            except Exception as e:
                logger.error(f"Error marking nonce as used: {e}")
                return False

    async def get_user_wallet(self, public_key: str) -> Optional[Dict[str, Any]]:
        """
        Get user wallet mapping by public key.

        Args:
            public_key: Solana wallet public key

        Returns:
            Wallet record with user_id or None if not found
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.rest_url}/user_wallets",
                    headers=self._get_headers(),
                    params={
                        "public_key": f"eq.{public_key}",
                        "select": "*"
                    }
                )
                response.raise_for_status()
                results = response.json()
                return results[0] if results else None
            except Exception as e:
                logger.error(f"Error fetching user wallet: {e}")
                return None

    async def get_user_wallets(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all wallets for a user.

        Args:
            user_id: Supabase auth user ID

        Returns:
            List of wallet records
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.rest_url}/user_wallets",
                    headers=self._get_headers(),
                    params={
                        "user_id": f"eq.{user_id}",
                        "select": "*"
                    }
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Error fetching user wallets: {e}")
                return []

    async def link_wallet_to_user(
        self,
        user_id: str,
        public_key: str,
        is_primary: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Link a wallet to a user account.

        Args:
            user_id: Supabase auth user ID
            public_key: Solana wallet public key
            is_primary: Whether this is the user's primary wallet

        Returns:
            Created wallet record or None on error
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.rest_url}/user_wallets",
                    headers=self._get_headers(),
                    json={
                        "user_id": user_id,
                        "public_key": public_key,
                        "is_primary": is_primary,
                        "last_used_at": datetime.now(timezone.utc).isoformat()
                    }
                )
                response.raise_for_status()
                result = response.json()
                return result[0] if isinstance(result, list) else result
            except Exception as e:
                logger.error(f"Error linking wallet to user: {e}")
                return None

    async def unlink_wallet(self, public_key: str, user_id: str) -> bool:
        """
        Unlink a wallet from a user account.

        Args:
            public_key: Solana wallet public key
            user_id: Supabase auth user ID (for verification)

        Returns:
            True if successful, False otherwise
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.delete(
                    f"{self.rest_url}/user_wallets",
                    headers=self._get_headers(),
                    params={
                        "public_key": f"eq.{public_key}",
                        "user_id": f"eq.{user_id}"
                    }
                )
                response.raise_for_status()
                return True
            except Exception as e:
                logger.error(f"Error unlinking wallet: {e}")
                return False

    async def update_profile_wallet(
        self,
        user_id: str,
        public_key: str
    ) -> bool:
        """
        Update the user's profile with their wallet public key.

        Args:
            user_id: Supabase auth user ID
            public_key: Solana wallet public key

        Returns:
            True if successful, False otherwise
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(
                    f"{self.rest_url}/profiles",
                    headers=self._get_headers(),
                    params={"id": f"eq.{user_id}"},
                    json={
                        "wallet_pubkeys": public_key,
                        "wallet_address": public_key  # Also update legacy field
                    }
                )
                response.raise_for_status()
                logger.info(f"Profile wallet updated for user {user_id}")
                return True
            except Exception as e:
                logger.error(f"Error updating profile wallet: {e}")
                return False

    async def create_user_with_wallet(
        self,
        public_key: str
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new Supabase Auth user for wallet-based sign-in.

        This creates a user without email/password using the Admin API.
        The user is identified by their wallet public key.

        Args:
            public_key: Solana wallet public key

        Returns:
            User object with access_token and session info, or None on error
        """
        async with httpx.AsyncClient() as client:
            try:
                # Create user via Admin API (bypasses email verification)
                response = await client.post(
                    f"{self.auth_url}/admin/users",
                    headers=self._get_headers(),
                    json={
                        "email": f"{public_key}@phantom.wallet",  # Placeholder email
                        "email_confirm": True,  # Auto-confirm
                        "user_metadata": {
                            "wallet_public_key": public_key,
                            "login_method": "phantom_wallet",
                            "wallet_created": True
                        }
                    }
                )
                response.raise_for_status()
                user_data = response.json()

                # Update the profile with wallet public key
                await self.update_profile_wallet(user_data["id"], public_key)

                # Create a session for this user
                session = await self.create_user_session(user_data["id"])

                return {
                    "user": user_data,
                    "session": session
                }
            except Exception as e:
                logger.error(f"Error creating user with wallet: {e}")
                return None

    async def create_user_session(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Create a new session for a user (admin operation).

        NOTE: This is a workaround since Supabase doesn't have a direct
        "create session" admin endpoint. We'll return user data and let
        the client handle session creation.

        Args:
            user_id: Supabase auth user ID

        Returns:
            Session-like object or None on error
        """
        async with httpx.AsyncClient() as client:
            try:
                # Get user data
                response = await client.get(
                    f"{self.auth_url}/admin/users/{user_id}",
                    headers=self._get_headers()
                )
                response.raise_for_status()
                user_data = response.json()

                # Return user data (frontend will handle session via signInWithPassword)
                return {
                    "user_id": user_id,
                    "email": user_data.get("email"),
                    "user_metadata": user_data.get("user_metadata", {})
                }
            except Exception as e:
                logger.error(f"Error creating user session: {e}")
                return None

    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user data by ID using admin API."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.auth_url}/admin/users/{user_id}",
                    headers=self._get_headers()
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Error fetching user by ID: {e}")
                return None


# Singleton instance
supabase_admin = SupabaseAdmin()

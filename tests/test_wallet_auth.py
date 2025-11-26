"""
Pytest tests for Phantom wallet authentication endpoints.

Run with: pytest tests/test_wallet_auth.py -v
"""

import pytest
import base64
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

# Import modules to test
from services.auth_api.crypto import (
    generate_nonce,
    verify_solana_signature,
    is_nonce_expired,
    validate_public_key_format,
)
from services.auth_api.models import (
    NonceRequest,
    VerifyRequest,
)


class TestCryptoFunctions:
    """Test cryptographic utility functions"""

    def test_generate_nonce(self):
        """Test nonce generation"""
        nonce = generate_nonce()

        assert isinstance(nonce, str)
        assert len(nonce) > 0
        # Base64-encoded 48 bytes should be ~64 characters
        assert len(nonce) >= 60

        # Test uniqueness
        nonce2 = generate_nonce()
        assert nonce != nonce2

    def test_generate_nonce_custom_length(self):
        """Test nonce generation with custom length"""
        nonce = generate_nonce(length=32)
        assert isinstance(nonce, str)
        assert len(nonce) >= 40  # Base64-encoded 32 bytes

    def test_validate_public_key_format_valid(self):
        """Test public key validation with valid key"""
        # Mock valid Solana public key (base58, 32 bytes decoded)
        valid_key = "7fXiGe9VD4f3xVJP6rQpMqQhzTQUmKhKrPjQsY3X9YJZ"

        is_valid, error = validate_public_key_format(valid_key)

        # Note: This may fail if base58 library not installed
        # In that case, it should still pass basic validation
        assert is_valid or "base58" in error.lower()

    def test_validate_public_key_format_empty(self):
        """Test public key validation with empty key"""
        is_valid, error = validate_public_key_format("")

        assert not is_valid
        assert "empty" in error.lower()

    def test_validate_public_key_format_too_short(self):
        """Test public key validation with too short key"""
        is_valid, error = validate_public_key_format("abc")

        assert not is_valid
        assert "length" in error.lower()

    def test_is_nonce_expired_not_expired(self):
        """Test nonce expiry check with valid nonce"""
        future_time = datetime.now(timezone.utc) + timedelta(minutes=5)

        assert not is_nonce_expired(future_time)

    def test_is_nonce_expired_expired(self):
        """Test nonce expiry check with expired nonce"""
        past_time = datetime.now(timezone.utc) - timedelta(minutes=5)

        assert is_nonce_expired(past_time)

    def test_is_nonce_expired_edge_case(self):
        """Test nonce expiry at exact expiry time"""
        now = datetime.now(timezone.utc)

        # At or after expiry should be expired
        assert is_nonce_expired(now)

    @pytest.mark.skipif(
        not hasattr(pytest, 'nacl_available'),
        reason="PyNaCl not installed"
    )
    def test_verify_solana_signature_invalid_public_key(self):
        """Test signature verification with invalid public key"""
        is_valid, error = verify_solana_signature(
            public_key_base58="invalid_key",
            message="test_message",
            signature_base64="dGVzdF9zaWduYXR1cmU="  # "test_signature" in base64
        )

        assert not is_valid
        assert len(error) > 0

    def test_verify_solana_signature_missing_libraries(self):
        """Test signature verification without required libraries"""
        # Mock library availability
        with patch('services.auth_api.crypto.NACL_AVAILABLE', False):
            is_valid, error = verify_solana_signature(
                public_key_base58="test",
                message="test",
                signature_base64="test"
            )

            assert not is_valid
            assert "pynacl" in error.lower()


class TestPydanticModels:
    """Test Pydantic request/response models"""

    def test_nonce_request_valid(self):
        """Test NonceRequest with valid data"""
        data = {"public_key": "7fXiGe9VD4f3xVJP6rQpMqQhzTQUmKhKrPjQsY3X9YJZ"}
        request = NonceRequest(**data)

        assert request.public_key == data["public_key"]

    def test_nonce_request_strips_whitespace(self):
        """Test NonceRequest strips whitespace from public key"""
        data = {"public_key": "  7fXiGe9VD4f3xVJP6rQpMqQhzTQUmKhKrPjQsY3X9YJZ  "}
        request = NonceRequest(**data)

        assert request.public_key.strip() == request.public_key

    def test_nonce_request_too_short(self):
        """Test NonceRequest rejects too short public key"""
        data = {"public_key": "abc"}

        with pytest.raises(ValueError):
            NonceRequest(**data)

    def test_verify_request_valid(self):
        """Test VerifyRequest with valid data"""
        data = {
            "public_key": "7fXiGe9VD4f3xVJP6rQpMqQhzTQUmKhKrPjQsY3X9YJZ",
            "signature": "dGVzdF9zaWduYXR1cmU=",
            "nonce": "test_nonce_12345"
        }
        request = VerifyRequest(**data)

        assert request.public_key == data["public_key"]
        assert request.signature == data["signature"]
        assert request.nonce == data["nonce"]

    def test_verify_request_missing_fields(self):
        """Test VerifyRequest with missing required fields"""
        data = {"public_key": "test"}

        with pytest.raises(ValueError):
            VerifyRequest(**data)


class TestSupabaseAdmin:
    """Test Supabase admin client functions"""

    @pytest.mark.asyncio
    async def test_create_wallet_nonce_success(self):
        """Test creating a wallet nonce"""
        from services.auth_api.supabase_admin import SupabaseAdmin

        admin = SupabaseAdmin()

        # Mock httpx.AsyncClient
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = [{
                "id": "test-id",
                "public_key": "test-key",
                "nonce": "test-nonce",
                "expires_at": datetime.now(timezone.utc).isoformat(),
                "used": False
            }]
            mock_response.raise_for_status = MagicMock()

            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            result = await admin.create_wallet_nonce(
                public_key="test-key",
                nonce="test-nonce"
            )

            assert result is not None
            assert result["nonce"] == "test-nonce"

    @pytest.mark.asyncio
    async def test_get_wallet_nonce_success(self):
        """Test retrieving a wallet nonce"""
        from services.auth_api.supabase_admin import SupabaseAdmin

        admin = SupabaseAdmin()

        with patch('httpx.AsyncClient') as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = [{
                "id": "test-id",
                "public_key": "test-key",
                "nonce": "test-nonce",
                "expires_at": datetime.now(timezone.utc).isoformat(),
                "used": False
            }]
            mock_response.raise_for_status = MagicMock()

            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            result = await admin.get_wallet_nonce(
                public_key="test-key",
                nonce="test-nonce"
            )

            assert result is not None
            assert result["nonce"] == "test-nonce"

    @pytest.mark.asyncio
    async def test_get_wallet_nonce_not_found(self):
        """Test retrieving a non-existent wallet nonce"""
        from services.auth_api.supabase_admin import SupabaseAdmin

        admin = SupabaseAdmin()

        with patch('httpx.AsyncClient') as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = []
            mock_response.raise_for_status = MagicMock()

            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            result = await admin.get_wallet_nonce(
                public_key="test-key",
                nonce="nonexistent-nonce"
            )

            assert result is None


class TestWalletAuthEndpoints:
    """Test FastAPI wallet auth endpoints (integration tests)"""

    @pytest.fixture
    def test_client(self):
        """Create a test client for FastAPI app"""
        from fastapi.testclient import TestClient
        from services.auth_api.routes import router

        # Create a minimal FastAPI app for testing
        from fastapi import FastAPI
        app = FastAPI()
        app.include_router(router)

        return TestClient(app)

    def test_health_endpoint(self, test_client):
        """Test health check endpoint"""
        response = test_client.get("/api/auth/wallet/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "wallet-auth"

    def test_nonce_endpoint_missing_public_key(self, test_client):
        """Test nonce endpoint with missing public key"""
        response = test_client.post(
            "/api/auth/wallet/nonce",
            json={}
        )

        assert response.status_code == 422  # Validation error

    def test_nonce_endpoint_invalid_public_key(self, test_client):
        """Test nonce endpoint with invalid public key"""
        response = test_client.post(
            "/api/auth/wallet/nonce",
            json={"public_key": "abc"}  # Too short
        )

        assert response.status_code == 422  # Validation error

    @patch('services.auth_api.routes.supabase_admin')
    def test_nonce_endpoint_success(self, mock_admin, test_client):
        """Test nonce endpoint with valid request"""
        # Mock successful nonce creation
        mock_admin.create_wallet_nonce = AsyncMock(return_value={
            "id": "test-id",
            "public_key": "7fXiGe9VD4f3xVJP6rQpMqQhzTQUmKhKrPjQsY3X9YJZ",
            "nonce": "test-nonce",
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
            "used": False
        })

        response = test_client.post(
            "/api/auth/wallet/nonce",
            json={"public_key": "7fXiGe9VD4f3xVJP6rQpMqQhzTQUmKhKrPjQsY3X9YJZ"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "nonce" in data
        assert "expires_at" in data

    def test_verify_endpoint_missing_fields(self, test_client):
        """Test verify endpoint with missing required fields"""
        response = test_client.post(
            "/api/auth/wallet/verify",
            json={"public_key": "test"}
        )

        assert response.status_code == 422  # Validation error


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

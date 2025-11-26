"""
Pydantic models for wallet authentication API requests and responses.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any
from datetime import datetime


class NonceRequest(BaseModel):
    """Request model for /api/auth/wallet/nonce endpoint."""
    public_key: str = Field(
        ...,
        description="Solana wallet public key in base58 format",
        min_length=32,
        max_length=44
    )

    @field_validator('public_key')
    @classmethod
    def validate_public_key(cls, v: str) -> str:
        """Validate public key format."""
        if not v or not isinstance(v, str):
            raise ValueError("Public key must be a non-empty string")
        if len(v) < 32 or len(v) > 44:
            raise ValueError("Invalid public key length")
        return v.strip()


class NonceResponse(BaseModel):
    """Response model for /api/auth/wallet/nonce endpoint."""
    nonce: str = Field(..., description="Challenge nonce to sign")
    expires_at: str = Field(..., description="ISO timestamp when nonce expires")
    message: Optional[str] = Field(
        None,
        description="Human-readable message to display in wallet (optional)"
    )


class VerifyRequest(BaseModel):
    """Request model for /api/auth/wallet/verify endpoint."""
    public_key: str = Field(
        ...,
        description="Solana wallet public key in base58 format",
        min_length=32,
        max_length=44
    )
    signature: str = Field(
        ...,
        description="Base64-encoded signature from wallet"
    )
    nonce: str = Field(
        ...,
        description="The nonce that was signed"
    )

    @field_validator('public_key')
    @classmethod
    def validate_public_key(cls, v: str) -> str:
        """Validate public key format."""
        if not v or not isinstance(v, str):
            raise ValueError("Public key must be a non-empty string")
        return v.strip()

    @field_validator('signature')
    @classmethod
    def validate_signature(cls, v: str) -> str:
        """Validate signature format."""
        if not v or not isinstance(v, str):
            raise ValueError("Signature must be a non-empty string")
        return v.strip()

    @field_validator('nonce')
    @classmethod
    def validate_nonce(cls, v: str) -> str:
        """Validate nonce format."""
        if not v or not isinstance(v, str):
            raise ValueError("Nonce must be a non-empty string")
        return v.strip()


class VerifyResponse(BaseModel):
    """Response model for /api/auth/wallet/verify endpoint."""
    status: str = Field(..., description="Status of verification (ok, error)")
    created_new_user: bool = Field(
        False,
        description="Whether a new user was created"
    )
    linked_to_existing_session: bool = Field(
        False,
        description="Whether wallet was linked to existing authenticated user"
    )
    user_id: str = Field(..., description="Supabase user ID")
    email: Optional[str] = Field(None, description="User email (if available)")
    user_metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="User metadata"
    )
    # Session information (Supabase Admin path)
    access_token: Optional[str] = Field(
        None,
        description="Supabase access token (if session created)"
    )
    # Alternative: Custom JWT (commented implementation)
    # custom_jwt: Optional[str] = Field(
    #     None,
    #     description="Custom JWT signed by FastAPI server"
    # )
    message: Optional[str] = Field(
        None,
        description="Additional information or error message"
    )


class LinkWalletRequest(BaseModel):
    """Request model for /api/auth/wallet/link endpoint."""
    public_key: str = Field(
        ...,
        description="Solana wallet public key to link",
        min_length=32,
        max_length=44
    )
    signature: str = Field(
        ...,
        description="Base64-encoded signature from wallet"
    )
    nonce: str = Field(
        ...,
        description="The nonce that was signed"
    )

    @field_validator('public_key')
    @classmethod
    def validate_public_key(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("Public key must be a non-empty string")
        return v.strip()


class LinkWalletResponse(BaseModel):
    """Response model for /api/auth/wallet/link endpoint."""
    status: str = Field(..., description="Status (ok, error)")
    message: str = Field(..., description="Success or error message")
    wallet: Optional[Dict[str, Any]] = Field(
        None,
        description="Linked wallet information"
    )


class UnlinkWalletRequest(BaseModel):
    """Request model for /api/auth/wallet/unlink endpoint."""
    public_key: str = Field(
        ...,
        description="Solana wallet public key to unlink",
        min_length=32,
        max_length=44
    )
    confirm: bool = Field(
        False,
        description="Confirm unlinking even if it's the last auth method"
    )

    @field_validator('public_key')
    @classmethod
    def validate_public_key(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("Public key must be a non-empty string")
        return v.strip()


class UnlinkWalletResponse(BaseModel):
    """Response model for /api/auth/wallet/unlink endpoint."""
    status: str = Field(..., description="Status (ok, error)")
    message: str = Field(..., description="Success or error message")
    remaining_wallets: int = Field(
        0,
        description="Number of wallets still linked to user"
    )


class ErrorResponse(BaseModel):
    """Standard error response model."""
    detail: str = Field(..., description="Error message")
    code: Optional[str] = Field(None, description="Error code")

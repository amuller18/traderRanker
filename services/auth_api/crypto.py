"""
Cryptographic utilities for Phantom wallet authentication.

Handles:
- Nonce generation and validation
- Ed25519 signature verification for Solana wallets
- Base58 encoding/decoding for Solana public keys
"""

import secrets
import base64
from typing import Tuple
from datetime import datetime, timezone

try:
    import nacl.signing
    import nacl.exceptions
    NACL_AVAILABLE = True
except ImportError:
    NACL_AVAILABLE = False
    print("WARNING: PyNaCl not installed. Install with: pip install pynacl")

try:
    import base58
    BASE58_AVAILABLE = True
except ImportError:
    BASE58_AVAILABLE = False
    print("WARNING: base58 not installed. Install with: pip install base58")


def generate_nonce(length: int = 48) -> str:
    """
    Generate a cryptographically secure random nonce for signature challenges.

    Args:
        length: Number of random bytes to generate (default: 48)

    Returns:
        URL-safe base64-encoded nonce string

    Example:
        >>> nonce = generate_nonce()
        >>> len(nonce) >= 64  # Base64 encoded 48 bytes
        True
    """
    return secrets.token_urlsafe(length)


def verify_solana_signature(
    public_key_base58: str,
    message: str,
    signature_base64: str
) -> Tuple[bool, str]:
    """
    Verify an Ed25519 signature from a Solana wallet (Phantom).

    Solana wallets sign messages using Ed25519 cryptography. This function
    verifies that the signature matches the public key and message.

    Args:
        public_key_base58: Solana public key in base58 format (e.g., from Phantom)
        message: The original message that was signed (typically the nonce)
        signature_base64: The signature in base64 format

    Returns:
        Tuple of (is_valid: bool, error_message: str)
        If valid: (True, "")
        If invalid: (False, "reason for failure")

    Example:
        >>> # Assume valid signature from Phantom wallet
        >>> is_valid, error = verify_solana_signature(
        ...     "7fX8...",  # Public key
        ...     "my_nonce_123",
        ...     "signature_base64..."
        ... )
        >>> is_valid
        True
    """
    if not NACL_AVAILABLE:
        return False, "PyNaCl library not installed. Cannot verify signatures."

    if not BASE58_AVAILABLE:
        return False, "base58 library not installed. Cannot decode public key."

    try:
        # Decode the Solana public key from base58
        try:
            public_key_bytes = base58.b58decode(public_key_base58)
        except Exception as e:
            return False, f"Invalid base58 public key: {str(e)}"

        # Verify public key length (Solana/Ed25519 keys are 32 bytes)
        if len(public_key_bytes) != 32:
            return False, f"Invalid public key length: {len(public_key_bytes)} (expected 32)"

        # Decode the signature from base64
        try:
            signature_bytes = base64.b64decode(signature_base64)
        except Exception as e:
            return False, f"Invalid base64 signature: {str(e)}"

        # Verify signature length (Ed25519 signatures are 64 bytes)
        if len(signature_bytes) != 64:
            return False, f"Invalid signature length: {len(signature_bytes)} (expected 64)"

        # Create a VerifyKey from the public key
        verify_key = nacl.signing.VerifyKey(public_key_bytes)

        # Encode the message to bytes (UTF-8)
        # NOTE: This must match how Phantom encodes the message when signing
        message_bytes = message.encode('utf-8')

        # Verify the signature
        # PyNaCl will raise an exception if verification fails
        try:
            verify_key.verify(message_bytes, signature_bytes)
            return True, ""
        except nacl.exceptions.BadSignatureError:
            return False, "Signature verification failed: signature does not match public key and message"

    except Exception as e:
        return False, f"Unexpected error during signature verification: {str(e)}"


def is_nonce_expired(expires_at: datetime) -> bool:
    """
    Check if a nonce has expired.

    Args:
        expires_at: The expiration timestamp (timezone-aware datetime)

    Returns:
        True if expired, False otherwise
    """
    # Ensure expires_at is timezone-aware
    if expires_at.tzinfo is None:
        # Assume UTC if no timezone
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    return now >= expires_at


def validate_public_key_format(public_key: str) -> Tuple[bool, str]:
    """
    Validate that a public key is in the correct format for Solana.

    Args:
        public_key: The public key string to validate

    Returns:
        Tuple of (is_valid: bool, error_message: str)
    """
    if not public_key:
        return False, "Public key is empty"

    if not isinstance(public_key, str):
        return False, "Public key must be a string"

    # Solana public keys are typically 32-44 characters in base58
    if len(public_key) < 32 or len(public_key) > 44:
        return False, f"Public key length {len(public_key)} is outside expected range (32-44)"

    if not BASE58_AVAILABLE:
        # If base58 not available, just do basic validation
        return True, ""

    # Try to decode to verify it's valid base58
    try:
        decoded = base58.b58decode(public_key)
        if len(decoded) != 32:
            return False, f"Decoded public key is {len(decoded)} bytes (expected 32)"
        return True, ""
    except Exception as e:
        return False, f"Invalid base58 encoding: {str(e)}"

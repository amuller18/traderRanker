"""
FastAPI routes for Phantom wallet authentication.

Endpoints:
- POST /api/auth/wallet/nonce - Generate a nonce for signature challenge
- POST /api/auth/wallet/verify - Verify signature and sign in / create account / link wallet
- POST /api/auth/wallet/link - Link wallet to existing authenticated user
- POST /api/auth/wallet/unlink - Unlink wallet from user account
"""

import logging
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Header, Depends, Request
from fastapi.responses import JSONResponse

from .models import (
    NonceRequest,
    NonceResponse,
    VerifyRequest,
    VerifyResponse,
    LinkWalletRequest,
    LinkWalletResponse,
    UnlinkWalletRequest,
    UnlinkWalletResponse,
    ErrorResponse
)
from .crypto import (
    generate_nonce,
    verify_solana_signature,
    is_nonce_expired,
    validate_public_key_format
)
from .supabase_admin import supabase_admin

logger = logging.getLogger(__name__)

# Create API router
router = APIRouter(prefix="/api/auth/wallet", tags=["wallet-auth"])

# Rate limiting (simple in-memory counter - for production use Redis/proper rate limiter)
_rate_limit_store: dict = {}


def check_rate_limit(public_key: str, max_requests: int = 5, window_seconds: int = 60) -> bool:
    """
    Simple in-memory rate limiting by public key.
    For production, use Redis or a proper rate limiting library.

    Args:
        public_key: Wallet public key to rate limit
        max_requests: Maximum requests allowed in window
        window_seconds: Time window in seconds

    Returns:
        True if within rate limit, False if exceeded
    """
    now = datetime.now(timezone.utc)
    key = f"nonce:{public_key}"

    # Clean up old entries
    if key in _rate_limit_store:
        _rate_limit_store[key] = [
            ts for ts in _rate_limit_store[key]
            if (now - ts).total_seconds() < window_seconds
        ]

    # Check limit
    if key not in _rate_limit_store:
        _rate_limit_store[key] = []

    if len(_rate_limit_store[key]) >= max_requests:
        return False

    # Add new request timestamp
    _rate_limit_store[key].append(now)
    return True


@router.post(
    "/nonce",
    response_model=NonceResponse,
    responses={
        200: {"description": "Nonce generated successfully"},
        400: {"model": ErrorResponse, "description": "Invalid public key"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"}
    }
)
async def get_nonce(request: NonceRequest) -> NonceResponse:
    """
    Generate a nonce for wallet signature challenge.

    This endpoint:
    1. Validates the public key format
    2. Checks rate limits (5 requests per minute per public key)
    3. Generates a cryptographically secure nonce
    4. Stores it in the database with 5-minute expiry
    5. Returns the nonce to be signed by the wallet

    The client should:
    1. Call this endpoint with their wallet public key
    2. Use Phantom wallet to sign the returned nonce
    3. Submit the signature to /verify endpoint
    """
    logger.info(f"Nonce request for public_key: {request.public_key[:8]}...")

    # Validate public key format
    is_valid, error_msg = validate_public_key_format(request.public_key)
    if not is_valid:
        logger.warning(f"Invalid public key format: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)

    # Rate limiting
    if not check_rate_limit(request.public_key):
        logger.warning(f"Rate limit exceeded for {request.public_key[:8]}...")
        raise HTTPException(
            status_code=429,
            detail="Too many nonce requests. Please try again in a minute."
        )

    # Generate nonce
    nonce = generate_nonce()

    # Store nonce in database with 5-minute expiry
    nonce_record = await supabase_admin.create_wallet_nonce(
        public_key=request.public_key,
        nonce=nonce,
        expires_in_seconds=300  # 5 minutes
    )

    if not nonce_record:
        logger.error("Failed to create nonce in database")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate nonce. Please try again."
        )

    logger.info(f"Nonce created successfully for {request.public_key[:8]}...")

    return NonceResponse(
        nonce=nonce,
        expires_at=nonce_record["expires_at"],
        message=f"Sign this nonce with your Phantom wallet to authenticate: {nonce}"
    )


@router.post(
    "/verify",
    response_model=VerifyResponse,
    responses={
        200: {"description": "Signature verified successfully"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        401: {"model": ErrorResponse, "description": "Invalid signature"},
        500: {"model": ErrorResponse, "description": "Server error"}
    }
)
async def verify_signature(
    request: VerifyRequest,
    authorization: Optional[str] = Header(None)
) -> VerifyResponse:
    """
    Verify wallet signature and handle sign-in / create account / link wallet flow.

    This endpoint implements three flows:
    1. **Sign in**: If wallet is already linked to a user, return session for that user
    2. **Create account**: If wallet is new and no session exists, create new user
    3. **Link wallet**: If wallet is new but user is authenticated, link wallet to user

    Flow logic:
    - Check nonce validity (exists, not expired, not used)
    - Verify signature using Ed25519 (Solana standard)
    - Check if wallet is already linked to a user
        - If yes: Create session and return (sign-in flow)
        - If no: Check if request includes valid authentication
            - If yes: Link wallet to authenticated user (link flow)
            - If no: Create new user for this wallet (create account flow)
    - Mark nonce as used to prevent replay attacks

    Args:
        request: Verification request with public_key, signature, and nonce
        authorization: Optional Authorization header (for linking to existing session)

    Returns:
        VerifyResponse with user data and session information
    """
    logger.info(f"Verify request for public_key: {request.public_key[:8]}...")

    # Step 1: Validate nonce exists and is not expired/used
    nonce_record = await supabase_admin.get_wallet_nonce(
        public_key=request.public_key,
        nonce=request.nonce
    )

    if not nonce_record:
        logger.warning(f"Nonce not found for {request.public_key[:8]}...")
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired nonce. Please request a new nonce."
        )

    if nonce_record.get("used"):
        logger.warning(f"Nonce already used for {request.public_key[:8]}...")
        raise HTTPException(
            status_code=401,
            detail="Nonce has already been used. Please request a new nonce."
        )

    # Parse expires_at
    expires_at_str = nonce_record.get("expires_at")
    if expires_at_str:
        expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
        if is_nonce_expired(expires_at):
            logger.warning(f"Nonce expired for {request.public_key[:8]}...")
            raise HTTPException(
                status_code=401,
                detail="Nonce has expired. Please request a new nonce."
            )

    # Step 2: Verify signature
    is_valid, error_msg = verify_solana_signature(
        public_key_base58=request.public_key,
        message=request.nonce,
        signature_base64=request.signature
    )

    if not is_valid:
        logger.warning(f"Signature verification failed: {error_msg}")
        raise HTTPException(
            status_code=401,
            detail=f"Invalid signature: {error_msg}"
        )

    logger.info(f"Signature verified successfully for {request.public_key[:8]}...")

    # Step 3: Check if wallet is already linked to a user
    wallet_record = await supabase_admin.get_user_wallet(request.public_key)

    if wallet_record:
        # Flow 1: Sign-in (wallet already linked)
        user_id = wallet_record["user_id"]
        user_data = await supabase_admin.get_user_by_id(user_id)

        if not user_data:
            raise HTTPException(
                status_code=500,
                detail="User not found. Please contact support."
            )

        # Update profile with wallet public key (ensure it's in profiles table)
        await supabase_admin.update_profile_wallet(user_id, request.public_key)

        # Mark nonce as used
        await supabase_admin.mark_nonce_as_used(nonce_record["id"])

        logger.info(f"Sign-in successful for user {user_id}")

        # NOTE: For Supabase Admin path, we return user data.
        # The frontend should use this to create a session via
        # supabase.auth.signInWithPassword() or similar.
        # Alternatively, implement custom JWT signing here (see below).

        return VerifyResponse(
            status="ok",
            created_new_user=False,
            linked_to_existing_session=False,
            user_id=user_id,
            email=user_data.get("email"),
            user_metadata=user_data.get("user_metadata", {}),
            message="Sign-in successful. Wallet already linked to your account."
        )

    # Step 4: Wallet is new - check if user is authenticated (link flow)
    # TODO: Parse authorization header to extract user_id if authenticated
    # For now, we'll implement the create account flow

    # Flow 2: Create new account (no existing wallet, no authenticated session)
    logger.info(f"Creating new user for wallet {request.public_key[:8]}...")

    new_user = await supabase_admin.create_user_with_wallet(request.public_key)

    if not new_user:
        raise HTTPException(
            status_code=500,
            detail="Failed to create user account. Please try again."
        )

    user_id = new_user["user"]["id"]

    # Link wallet to newly created user
    wallet_link = await supabase_admin.link_wallet_to_user(
        user_id=user_id,
        public_key=request.public_key,
        is_primary=True
    )

    if not wallet_link:
        logger.error(f"Failed to link wallet to new user {user_id}")
        raise HTTPException(
            status_code=500,
            detail="Failed to link wallet to account. Please try again."
        )

    # Mark nonce as used
    await supabase_admin.mark_nonce_as_used(nonce_record["id"])

    logger.info(f"New user created successfully: {user_id}")

    return VerifyResponse(
        status="ok",
        created_new_user=True,
        linked_to_existing_session=False,
        user_id=user_id,
        email=new_user["user"].get("email"),
        user_metadata=new_user["user"].get("user_metadata", {}),
        message="Account created successfully. Welcome!"
    )


# ============================================================================
# ALTERNATIVE IMPLEMENTATION: Custom JWT (commented)
# ============================================================================
# If you prefer to use a custom JWT signed by FastAPI instead of Supabase Admin,
# uncomment and implement the following:

# import jwt
# import os
# from datetime import timedelta
#
# JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
# JWT_ALGORITHM = "HS256"
# JWT_EXPIRY_HOURS = 24
#
# def create_custom_jwt(user_id: str, public_key: str) -> str:
#     """Create a custom JWT for the user."""
#     payload = {
#         "user_id": user_id,
#         "public_key": public_key,
#         "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
#         "iat": datetime.now(timezone.utc)
#     }
#     return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
#
# def verify_custom_jwt(token: str) -> Optional[dict]:
#     """Verify and decode a custom JWT."""
#     try:
#         payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
#         return payload
#     except jwt.ExpiredSignatureError:
#         return None
#     except jwt.InvalidTokenError:
#         return None
#
# # In verify_signature endpoint, return:
# # custom_jwt=create_custom_jwt(user_id, request.public_key)
# # instead of access_token


@router.post(
    "/link",
    response_model=LinkWalletResponse,
    responses={
        200: {"description": "Wallet linked successfully"},
        401: {"model": ErrorResponse, "description": "Unauthorized or invalid signature"},
        409: {"model": ErrorResponse, "description": "Wallet already linked to another user"}
    }
)
async def link_wallet(
    request: LinkWalletRequest,
    authorization: Optional[str] = Header(None)
) -> LinkWalletResponse:
    """
    Link a new wallet to an existing authenticated user.

    This endpoint requires:
    1. User must be authenticated (Authorization header or session cookie)
    2. Wallet signature must be valid
    3. Wallet must not already be linked to another user

    Steps:
    1. Verify user is authenticated
    2. Verify signature
    3. Check wallet is not already linked
    4. Link wallet to user

    NOTE: This is a placeholder implementation. You need to add proper
    authentication middleware to extract user_id from session/JWT.
    """
    # TODO: Implement authentication check
    # For now, return an error indicating implementation needed
    raise HTTPException(
        status_code=501,
        detail="Link wallet endpoint requires authentication middleware. "
               "Please implement auth token verification first."
    )


@router.post(
    "/unlink",
    response_model=UnlinkWalletResponse,
    responses={
        200: {"description": "Wallet unlinked successfully"},
        400: {"model": ErrorResponse, "description": "Cannot unlink last auth method"},
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        404: {"model": ErrorResponse, "description": "Wallet not found"}
    }
)
async def unlink_wallet(
    request: UnlinkWalletRequest,
    authorization: Optional[str] = Header(None)
) -> UnlinkWalletResponse:
    """
    Unlink a wallet from the authenticated user's account.

    This endpoint:
    1. Verifies user is authenticated
    2. Checks user owns the wallet
    3. Ensures user won't be locked out (requires confirm=true if last auth method)
    4. Removes wallet link

    NOTE: This is a placeholder implementation. You need to add proper
    authentication middleware to extract user_id from session/JWT.
    """
    # TODO: Implement authentication check
    raise HTTPException(
        status_code=501,
        detail="Unlink wallet endpoint requires authentication middleware. "
               "Please implement auth token verification first."
    )


# Health check endpoint
@router.get("/health")
async def health_check():
    """Health check endpoint for wallet auth service."""
    return {
        "status": "ok",
        "service": "wallet-auth",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

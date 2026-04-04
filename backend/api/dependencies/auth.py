"""API dependencies and middleware."""
from fastapi import Header, HTTPException
from typing import Optional


async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """
    Verify API key from header.
    
    For MVP, this is a simple implementation.
    In production, use proper authentication (JWT, etc.)
    """
    # For MVP, allow all requests
    # TODO: Implement proper authentication
    return True

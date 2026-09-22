from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_session
from app.db_models import UserRecord
from app.deps import get_current_user, get_user_record
from app.schemas import CurrentUser, LoginRequest, RegisterRequest, TokenResponse
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    user = get_user_record(payload.username)
    if user is None or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = create_access_token(subject=user["username"], role=user["role"])
    return TokenResponse(
        access_token=token,
        role=user["role"],
        display_name=user.get("display_name", user["username"]),
        username=user["username"],
    )


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest):
    """Public self-registration for clients only — always creates a 'viewer'
    account, regardless of anything the caller sends. Admin accounts are
    never created through this endpoint."""
    if get_user_record(payload.username) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That username is already taken")

    with get_session() as session:
        session.add(
            UserRecord(
                username=payload.username,
                display_name=payload.display_name,
                role="viewer",
                password_hash=hash_password(payload.password),
            )
        )

    token = create_access_token(subject=payload.username, role="viewer")
    return TokenResponse(
        access_token=token,
        role="viewer",
        display_name=payload.display_name,
        username=payload.username,
    )


@router.get("/me", response_model=CurrentUser)
def me(current_user: CurrentUser = Depends(get_current_user)):
    return current_user

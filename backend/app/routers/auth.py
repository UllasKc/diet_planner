from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user, get_user_record
from app.schemas import CurrentUser, LoginRequest, TokenResponse
from app.security import create_access_token, verify_password

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


@router.get("/me", response_model=CurrentUser)
def me(current_user: CurrentUser = Depends(get_current_user)):
    return current_user

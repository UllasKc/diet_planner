from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.db import get_session
from app.db_models import UserRecord
from app.schemas import CurrentUser
from app.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def get_user_record(username: str) -> dict | None:
    with get_session() as session:
        record = session.query(UserRecord).filter_by(username=username).one_or_none()
        if record is None:
            return None
        return {
            "username": record.username,
            "display_name": record.display_name,
            "role": record.role,
            "password_hash": record.password_hash,
        }


def get_current_user(token: str = Depends(oauth2_scheme)) -> CurrentUser:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_error

    username = payload.get("sub")
    role = payload.get("role")
    if not username or not role:
        raise credentials_error

    user_record = get_user_record(username)
    if user_record is None:
        raise credentials_error

    return CurrentUser(username=username, role=role, display_name=user_record.get("display_name", username))


def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

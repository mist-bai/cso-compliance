from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, verify_password
from app.database import get_db
from app.models import User
from app.schemas import LoginForm, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="账号已停用")
    token = create_access_token(
        user.username,
        user.role,
        {
            "agent_id": user.agent_id,
            "representative_id": user.representative_id,
        },
    )
    return TokenOut(
        access_token=token,
        role=user.role,
        display_name=user.display_name,
        username=user.username,
    )


@router.post("/login-json", response_model=TokenOut)
def login_json(body: LoginForm, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    token = create_access_token(
        user.username,
        user.role,
        {
            "agent_id": user.agent_id,
            "representative_id": user.representative_id,
        },
    )
    return TokenOut(
        access_token=token,
        role=user.role,
        display_name=user.display_name,
        username=user.username,
    )


@router.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(get_current_user)]):
    return user

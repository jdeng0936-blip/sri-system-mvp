"""
路由：认证中枢 — routers/auth.py
==================================
OAuth2 JWT 登录，Payload: {sub, role, dept}
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models import User
from schemas import LoginRequest, TokenResponse, UserOut
from utils.dependencies import create_access_token, get_current_user, get_db
from utils.security import verify_password

router = APIRouter(prefix="/api/auth", tags=["Auth 认证"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    手机号 + 密码登录，签发 JWT。
    Payload: sub=user_id, role=角色, dept=战区。
    """
    user = db.query(User).filter(User.phone == body.phone).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户不存在")
    if not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "密码错误")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "账号已停用")

    token = create_access_token(user_id=user.id, role=user.role.value, dept=user.dept)
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    """获取当前登录用户信息。"""
    return user

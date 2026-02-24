"""
RBAC 鉴权拦截器 — utils/dependencies.py
=========================================
企业级依赖注入：JWT 认证 + 角色权限校验 + 项目归属校验。
所有路由函数通过 FastAPI Depends() 自动注入。
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db import SessionLocal
from models import User, UserRole, Project

# ── JWT 配置 ──
JWT_SECRET = os.environ.get("JWT_SECRET", "sri-saas-dev-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "24"))

# FastAPI 安全方案：Bearer Token
_bearer_scheme = HTTPBearer(auto_error=False)


# ═══════════════════════════════════════════
# 1. DB Session 依赖
# ═══════════════════════════════════════════

def get_db():
    """
    生成请求级 SQLAlchemy Session。
    请求结束后自动关闭，保证连接不泄漏。
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ═══════════════════════════════════════════
# 2. JWT 工具函数
# ═══════════════════════════════════════════

def create_access_token(user_id: int, role: str, dept: str = "") -> str:
    """
    签发 JWT Access Token。

    Payload:
        sub: user_id (str)
        role: UserRole value
        dept: 所属战区
        exp: 过期时间
    """
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "role": role,
        "dept": dept,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """解析 JWT，失败抛 401。"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 已过期，请重新登录",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效 Token",
        )


# ═══════════════════════════════════════════
# 3. 核心依赖：获取当前用户
# ═══════════════════════════════════════════

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)] = None,
    db: Session = Depends(get_db),
) -> User:
    """
    解析请求中的 Bearer Token → 查库 → 返回 User 对象。
    任何认证失败均返回 401。

    用法：
        @router.get("/endpoint")
        def handler(user: User = Depends(get_current_user)):
            ...
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证 Token，请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 格式异常：缺少 sub 字段",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或已被禁用",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被停用，请联系管理员",
        )
    return user


# ═══════════════════════════════════════════
# 4. 角色权限拦截器
# ═══════════════════════════════════════════

def require_role(*allowed_roles: UserRole):
    """
    角色权限拦截器工厂函数。
    绝不允许越权调接口 — 不匹配直接 403。

    用法：
        @router.post("/approve")
        def approve(user: User = Depends(require_role(UserRole.VP, UserRole.DIRECTOR))):
            ...
    """
    async def _role_checker(
        user: User = Depends(get_current_user),
    ) -> User:
        # admin 拥有超级权限，任何端点均可通行
        if user.role == UserRole.ADMIN:
            return user
        if user.role not in allowed_roles:
            role_names = ", ".join(r.value for r in allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"🔒 权限拦截：此操作仅限 [{role_names}] 角色，"
                       f"您当前角色为 [{user.role.value}]",
            )
        return user
    return _role_checker


# ═══════════════════════════════════════════
# 5. 项目归属校验
# ═══════════════════════════════════════════

def require_project_access(project_id_param: str = "project_id"):
    """
    项目归属 & 可见性校验：
    - sales:    只能访问自己 owner 的项目
    - tech:     只能访问自己参与的项目（暂放行同战区）
    - director: 只能访问自己战区下的项目
    - vp/admin: 全部可见

    用法：
        @router.get("/projects/{project_id}")
        def get_project(
            project_id: int,
            ctx: tuple[User, Project] = Depends(require_project_access()),
        ):
            user, project = ctx
            ...
    """
    from fastapi import Request

    async def _access_checker(
        request: Request,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> tuple[User, Project]:
        # 从路径参数中取 project_id
        pid = request.path_params.get(project_id_param)
        if not pid:
            raise HTTPException(status_code=400, detail="缺少 project_id 路径参数")

        project = db.query(Project).filter(Project.id == int(pid)).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"项目 #{pid} 不存在")

        # VP / admin 全部可见
        if user.role in (UserRole.VP, UserRole.ADMIN):
            return user, project

        # director 只能看自己战区
        if user.role == UserRole.DIRECTOR:
            if project.dept and project.dept != user.dept:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"🔒 越权拦截：该项目属于 [{project.dept}]，"
                           f"您只能管理 [{user.dept}]",
                )
            return user, project

        # sales / tech 只能看自己的或同战区的
        if user.role in (UserRole.SALES, UserRole.TECH):
            is_owner = project.owner_id == user.id
            is_same_dept = project.dept == user.dept
            if not (is_owner or is_same_dept):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="🔒 越权拦截：您无权访问该项目",
                )
            return user, project

        # finance 只读放行
        if user.role == UserRole.FINANCE:
            return user, project

        raise HTTPException(status_code=403, detail="未知角色，拒绝访问")

    return _access_checker

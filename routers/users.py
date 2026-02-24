"""
路由：用户管理 — routers/users.py
===================================
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import User, UserRole
from schemas import UserCreate, UserOut
from utils.dependencies import get_db, require_role
from utils.security import hash_password

router = APIRouter(prefix="/api/users", tags=["Users 用户管理"])


@router.get("", response_model=list[UserOut])
def list_users(
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """用户列表。仅限 admin。"""
    return db.query(User).order_by(User.dept, User.name).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """创建用户。仅限 admin。"""
    if db.query(User).filter(User.phone == body.phone).first():
        raise HTTPException(409, f"手机号 {body.phone} 已存在")

    new_user = User(
        name=body.name,
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=UserRole(body.role.value),
        dept=body.dept,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/org-chart")
def org_chart(
    user: User = Depends(require_role(UserRole.DIRECTOR, UserRole.VP)),
    db: Session = Depends(get_db),
):
    """组织架构树 (按战区分组)。"""
    users = db.query(User).filter(User.is_active == True).order_by(User.dept).all()
    tree: dict[str, list] = {}
    for u in users:
        tree.setdefault(u.dept, []).append({
            "id": u.id, "name": u.name, "role": u.role.value,
        })
    return tree

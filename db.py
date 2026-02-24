"""
SQLAlchemy 引擎 & Session 工厂
================================
企业级连接管理：单例引擎 + 请求级 Session。
"""

import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# ── 数据库 URL（默认 SQLite，生产可切 PostgreSQL）──
# 使用绝对路径，确保 seed.py / uvicorn / pytest 读写同一个文件
_PROJECT_ROOT = Path(__file__).resolve().parent
_DEFAULT_DB = f"sqlite:///{_PROJECT_ROOT / 'sri_saas.db'}"

DATABASE_URL = os.environ.get("DATABASE_URL", _DEFAULT_DB)

# ── 引擎配置 ──
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},  # SQLite 多线程
        echo=False,
    )
    # SQLite 开启外键约束（默认关闭），保障级联删除生效
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """创建所有表（幂等操作，已存在的表不会被重建）。"""
    from models import Base
    Base.metadata.create_all(bind=engine)

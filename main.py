"""
FastAPI 应用入口 — main.py
============================
挂载所有 10 个路由模块，初始化数据库。
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routers import (
    ai,
    appeals,
    auth,
    contracts,
    deal_desks,
    intel,
    projects,
    sos,
    stakeholders,
    users,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时初始化数据库。"""
    init_db()
    yield


app = FastAPI(
    title="SRI 作战指挥室 — API",
    description=(
        "销售 AI 情报系统后端 API\n\n"
        "• 10 个路由模块 • RBAC 权限锁 • 状态机引擎 • 天眼防篡改 • AI 网关"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS 配置 ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 生产环境请替换为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 挂载路由 ──
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(stakeholders.router)
app.include_router(intel.router)
app.include_router(deal_desks.router)
app.include_router(contracts.router)
app.include_router(sos.router)
app.include_router(appeals.router)
app.include_router(ai.router)


@app.get("/api/health")
def health_check():
    return {"status": "operational", "version": "2.0.0", "system": "SRI 作战指挥室"}

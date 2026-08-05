import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.database import Base, SessionLocal, engine
from app.routers import auth, dashboard, filings, meetings, master, reports, visits
from app.seed import seed_if_empty, sync_master_data

app = FastAPI(title="代理商合规管理系统", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(master.router, prefix="/api")
app.include_router(filings.router, prefix="/api")
app.include_router(visits.router, prefix="/api")
app.include_router(meetings.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok", "service": "cso-compliance"}


@app.on_event("startup")
def on_startup():
    for attempt in range(30):
        try:
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()
            try:
                # 每次启动同步 resources 主数据；演示账号仅空库写入
                sync_master_data(db)
                seed_if_empty(db)
            finally:
                db.close()
            return
        except OperationalError:
            time.sleep(2)
    raise RuntimeError("数据库连接失败，请检查 MySQL 是否就绪")

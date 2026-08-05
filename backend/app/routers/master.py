from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, hash_password, require_roles
from app.database import get_db
from app.models import (
    Agent,
    Factory,
    FeeStandard,
    Hospital,
    Product,
    Representative,
    ServiceProvider,
    User,
    UserRole,
)
from app.schemas import (
    AgentCreate,
    AgentOut,
    AgentUpdate,
    FactoryOut,
    FeeCreate,
    FeeOut,
    HospitalBulkImport,
    HospitalCreate,
    HospitalOut,
    ProductCreate,
    ProductOut,
    ProviderCreate,
    ProviderOut,
    RepOut,
    RepUpdate,
)
from app.seed import sync_master_data

router = APIRouter(tags=["master"])


@router.get("/factories", response_model=list[FactoryOut])
def list_factories(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    return db.query(Factory).order_by(Factory.id).all()


@router.get("/providers", response_model=list[ProviderOut])
def list_providers(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    return db.query(ServiceProvider).order_by(ServiceProvider.id).all()


@router.post("/providers", response_model=ProviderOut)
def create_provider(
    body: ProviderCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value))],
):
    row = ServiceProvider(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/agents", response_model=list[AgentOut])
def list_agents(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    q = db.query(Agent)
    if user.role == UserRole.AGENT.value and user.agent_id:
        q = q.filter(Agent.id == user.agent_id)
    rows = q.order_by(Agent.id).all()
    out = []
    for r in rows:
        item = AgentOut.model_validate(r)
        item.provider_name = r.provider.name if r.provider else None
        out.append(item)
    return out


@router.post("/agents", response_model=AgentOut)
def create_agent(
    body: AgentCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value))],
):
    data = body.model_dump(exclude={"username", "password"})
    row = Agent(**data)
    db.add(row)
    db.flush()
    if body.username:
        if db.query(User).filter(User.username == body.username).first():
            raise HTTPException(status_code=400, detail="账号已存在")
        db.add(
            User(
                username=body.username,
                password_hash=hash_password(body.password),
                display_name=body.name,
                role=UserRole.AGENT.value,
                agent_id=row.id,
                phone=body.phone,
                email=body.email,
            )
        )
    db.commit()
    db.refresh(row)
    item = AgentOut.model_validate(row)
    item.provider_name = row.provider.name if row.provider else None
    return item


@router.patch("/agents/{agent_id}", response_model=AgentOut)
def update_agent(
    agent_id: int,
    body: AgentUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value))],
):
    row = db.get(Agent, agent_id)
    if not row:
        raise HTTPException(status_code=404, detail="代理商不存在")
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    # 停用/启用时同步代理商登录账号
    if "is_active" in data:
        for u in db.query(User).filter(User.agent_id == agent_id, User.role == UserRole.AGENT.value):
            u.is_active = bool(data["is_active"])
    db.commit()
    db.refresh(row)
    item = AgentOut.model_validate(row)
    item.provider_name = row.provider.name if row.provider else None
    return item


@router.get("/products", response_model=list[ProductOut])
def list_products(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = db.query(Product).order_by(Product.id).all()
    out = []
    for r in rows:
        item = ProductOut.model_validate(r)
        item.factory_name = r.factory.name if r.factory else None
        item.factory_short_name = r.factory.short_name if r.factory else None
        out.append(item)
    return out


@router.get("/representatives", response_model=list[RepOut])
def list_representatives(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    q = db.query(Representative)
    if user.role == UserRole.AGENT.value and user.agent_id:
        q = q.filter(Representative.agent_id == user.agent_id)
    elif user.role == UserRole.REP.value and user.representative_id:
        q = q.filter(Representative.id == user.representative_id)
    rows = q.order_by(Representative.id).all()
    out = []
    for r in rows:
        item = RepOut.model_validate(r)
        item.agent_name = r.agent.name if r.agent else None
        out.append(item)
    return out


@router.patch("/representatives/{rep_id}", response_model=RepOut)
def update_representative(
    rep_id: int,
    body: RepUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value))],
):
    row = db.get(Representative, rep_id)
    if not row:
        raise HTTPException(status_code=404, detail="代表不存在")
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    if "is_active" in data:
        for u in db.query(User).filter(
            User.representative_id == rep_id, User.role == UserRole.REP.value
        ):
            u.is_active = bool(data["is_active"])
    db.commit()
    db.refresh(row)
    item = RepOut.model_validate(row)
    item.agent_name = row.agent.name if row.agent else None
    return item


@router.get("/hospitals", response_model=list[HospitalOut])
def list_hospitals(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    q: str | None = None,
    province: str | None = None,
):
    query = db.query(Hospital)
    if province:
        query = query.filter(Hospital.province == province)
    rows = query.order_by(Hospital.id).limit(500).all()
    if q:
        rows = [r for r in rows if q in r.name]
    return rows


@router.post("/hospitals", response_model=HospitalOut)
def create_hospital(
    body: HospitalCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value))],
):
    if body.terminal_code:
        exists = (
            db.query(Hospital)
            .filter(Hospital.terminal_code == body.terminal_code)
            .first()
        )
        if exists:
            raise HTTPException(status_code=400, detail="终端编码已存在")
    row = Hospital(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/hospitals/bulk")
def bulk_import_hospitals(
    body: HospitalBulkImport,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value))],
):
    added = 0
    updated = 0
    for item in body.items:
        row = None
        if item.terminal_code:
            row = (
                db.query(Hospital)
                .filter(Hospital.terminal_code == item.terminal_code)
                .first()
            )
        if not row:
            row = db.query(Hospital).filter(Hospital.name == item.name).first()
        if not row:
            row = Hospital(name=item.name)
            db.add(row)
            added += 1
        else:
            updated += 1
        row.name = item.name
        row.province = item.province
        row.city = item.city
        row.level = item.level
        row.terminal_code = item.terminal_code
        row.is_active = True
    db.commit()
    return {"ok": True, "added": added, "updated": updated, "total": len(body.items)}


@router.post("/master/sync")
def sync_master(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value))],
):
    """从 backend/resources 同步真实主数据（工厂/服务商/产品/医院）。"""
    return {"ok": True, "result": sync_master_data(db)}


@router.post("/products", response_model=ProductOut)
def create_product(
    body: ProductCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value))],
):
    row = Product(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    item = ProductOut.model_validate(row)
    item.factory_name = row.factory.name if row.factory else None
    return item


@router.get("/fees", response_model=list[FeeOut])
def list_fees(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    return db.query(FeeStandard).order_by(FeeStandard.id).all()


@router.post("/fees", response_model=FeeOut)
def create_fee(
    body: FeeCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value))],
):
    row = FeeStandard(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, hash_password, require_roles
from app.database import get_db
from app.models import Agent, Factory, FeeStandard, Product, ServiceProvider, User, UserRole
from app.schemas import (
    AgentCreate,
    AgentOut,
    FactoryOut,
    FeeCreate,
    FeeOut,
    ProductCreate,
    ProductOut,
    ProviderCreate,
    ProviderOut,
)

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
        out.append(item)
    return out


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

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import (
    Agent,
    FilingStatus,
    RepFiling,
    Representative,
    User,
    UserRole,
)
from app.schemas import FilingCreate, FilingOut, FilingStatusUpdate

router = APIRouter(prefix="/filings", tags=["filings"])


def _to_out(row: RepFiling) -> FilingOut:
    item = FilingOut.model_validate(row)
    item.rep_name = row.representative.name if row.representative else None
    item.id_card = row.representative.id_card if row.representative else None
    item.agent_name = row.agent.name if row.agent else None
    item.provider_name = row.provider.name if row.provider else None
    item.factory_name = row.factory.name if row.factory else None
    return item


@router.get("", response_model=list[FilingOut])
def list_filings(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    provider_id: int | None = None,
    factory_id: int | None = None,
    q: str | None = Query(default=None, description="姓名或身份证号"),
):
    query = db.query(RepFiling)
    if user.role == UserRole.AGENT.value and user.agent_id:
        query = query.filter(RepFiling.agent_id == user.agent_id)
    elif user.role == UserRole.REP.value and user.representative_id:
        query = query.filter(RepFiling.representative_id == user.representative_id)
    if provider_id:
        query = query.filter(RepFiling.provider_id == provider_id)
    if factory_id:
        query = query.filter(RepFiling.factory_id == factory_id)
    rows = query.order_by(RepFiling.id.desc()).all()
    if q:
        keyword = q.strip()
        rows = [
            r
            for r in rows
            if r.representative
            and (
                keyword in r.representative.name
                or keyword in r.representative.id_card
            )
        ]
    return [_to_out(r) for r in rows]


@router.post("", response_model=FilingOut)
def create_filing(
    body: FilingCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.AGENT.value, UserRole.ADMIN.value))],
):
    agent_id = user.agent_id
    if user.role == UserRole.ADMIN.value:
        # 管理员建档时挂到华北区默认代理商（演示）
        agent = db.query(Agent).order_by(Agent.id).first()
        if not agent:
            raise HTTPException(status_code=400, detail="请先创建代理商")
        agent_id = agent.id
    if not agent_id:
        raise HTTPException(status_code=400, detail="当前账号未绑定代理商")

    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=400, detail="代理商不存在")

    rep = (
        db.query(Representative)
        .filter(Representative.id_card == body.id_card)
        .first()
    )
    if not rep:
        rep = Representative(
            name=body.name,
            id_card=body.id_card,
            agent_id=agent_id,
            phone=body.phone,
        )
        db.add(rep)
        db.flush()
    else:
        rep.name = body.name
        if body.phone:
            rep.phone = body.phone

    row = RepFiling(
        representative_id=rep.id,
        factory_id=body.factory_id,
        provider_id=agent.provider_id,
        agent_id=agent_id,
        status=FilingStatus.APPLIED_PENDING_EXAM.value,
        valid_from=body.valid_from,
        valid_to=body.valid_to,
        remark=body.remark,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.patch("/{filing_id}/status", response_model=FilingOut)
def update_status(
    filing_id: int,
    body: FilingStatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[
        User,
        Depends(
            require_roles(
                UserRole.ADMIN.value,
                UserRole.COMPLIANCE.value,
                UserRole.AGENT.value,
            )
        ),
    ],
):
    allowed = {s.value for s in FilingStatus}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"非法状态，可选：{sorted(allowed)}")

    row = db.get(RepFiling, filing_id)
    if not row:
        raise HTTPException(status_code=404, detail="备案不存在")
    if user.role == UserRole.AGENT.value and row.agent_id != user.agent_id:
        raise HTTPException(status_code=403, detail="无权操作该备案")

    row.status = body.status
    if body.valid_from is not None:
        row.valid_from = body.valid_from
    if body.valid_to is not None:
        row.valid_to = body.valid_to
    if body.remark is not None:
        row.remark = body.remark
    db.commit()
    db.refresh(row)
    return _to_out(row)

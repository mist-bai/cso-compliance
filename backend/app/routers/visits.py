from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import Hospital, Representative, ServiceProvider, User, UserRole, VisitEvent, VisitRecord
from app.schemas import VisitCreate, VisitEventOut, VisitOut

router = APIRouter(prefix="/visits", tags=["visits"])


def _event_out(row: VisitEvent) -> VisitEventOut:
    return VisitEventOut(
        id=row.id,
        visit_record_id=row.visit_record_id,
        representative_id=row.representative_id,
        hospital_id=row.hospital_id,
        hospital_name=row.hospital.name if row.hospital else None,
        hospital_province=row.hospital.province if row.hospital else None,
        hospital_city=row.hospital.city if row.hospital else None,
        visit_date=row.visit_date,
        period=row.period,
        note=row.note,
        rep_name=row.representative.name if row.representative else None,
    )


def _to_out(db: Session, row: VisitRecord) -> VisitOut:
    item = VisitOut.model_validate(row)
    item.rep_name = row.representative.name if row.representative else None
    provider = db.get(ServiceProvider, row.provider_id)
    item.provider_name = provider.name if provider else None
    item.completion_rate = (
        round(row.visit_count / row.target_count * 100, 0) if row.target_count else 0
    )
    events = (
        db.query(VisitEvent)
        .filter(VisitEvent.visit_record_id == row.id)
        .order_by(VisitEvent.visit_date.desc(), VisitEvent.id.desc())
        .all()
    )
    names: list[str] = []
    for e in events:
        if e.hospital and e.hospital.name and e.hospital.name not in names:
            names.append(e.hospital.name)
    item.hospital_names = names[:5]
    item.event_count = len(events)
    return item


@router.get("", response_model=list[VisitOut])
def list_visits(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    period: str | None = None,
    representative_id: int | None = None,
    provider_id: int | None = None,
):
    q = db.query(VisitRecord)
    if user.role == UserRole.AGENT.value and user.agent_id:
        q = q.filter(VisitRecord.agent_id == user.agent_id)
    elif user.role == UserRole.REP.value and user.representative_id:
        q = q.filter(VisitRecord.representative_id == user.representative_id)
    if period:
        q = q.filter(VisitRecord.period == period)
    if representative_id:
        q = q.filter(VisitRecord.representative_id == representative_id)
    if provider_id:
        q = q.filter(VisitRecord.provider_id == provider_id)
    rows = q.order_by(VisitRecord.period.desc(), VisitRecord.id.desc()).all()
    return [_to_out(db, row) for row in rows]


@router.get("/events", response_model=list[VisitEventOut])
def list_visit_events(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    visit_id: int | None = None,
    period: str | None = None,
):
    q = db.query(VisitEvent)
    if user.role == UserRole.AGENT.value and user.agent_id:
        q = q.filter(VisitEvent.agent_id == user.agent_id)
    elif user.role == UserRole.REP.value and user.representative_id:
        q = q.filter(VisitEvent.representative_id == user.representative_id)
    if visit_id:
        q = q.filter(VisitEvent.visit_record_id == visit_id)
    if period:
        q = q.filter(VisitEvent.period == period)
    rows = q.order_by(VisitEvent.visit_date.desc(), VisitEvent.id.desc()).limit(200).all()
    return [_event_out(r) for r in rows]


@router.get("/{visit_id}", response_model=VisitOut)
def get_visit(
    visit_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = db.get(VisitRecord, visit_id)
    if not row:
        raise HTTPException(status_code=404, detail="拜访记录不存在")
    if user.role == UserRole.AGENT.value and row.agent_id != user.agent_id:
        raise HTTPException(status_code=403, detail="无权查看")
    if user.role == UserRole.REP.value and row.representative_id != user.representative_id:
        raise HTTPException(status_code=403, detail="无权查看")
    return _to_out(db, row)


@router.get("/{visit_id}/events", response_model=list[VisitEventOut])
def get_visit_events(
    visit_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = db.get(VisitRecord, visit_id)
    if not row:
        raise HTTPException(status_code=404, detail="拜访记录不存在")
    if user.role == UserRole.AGENT.value and row.agent_id != user.agent_id:
        raise HTTPException(status_code=403, detail="无权查看")
    if user.role == UserRole.REP.value and row.representative_id != user.representative_id:
        raise HTTPException(status_code=403, detail="无权查看")
    events = (
        db.query(VisitEvent)
        .filter(VisitEvent.visit_record_id == visit_id)
        .order_by(VisitEvent.visit_date.desc(), VisitEvent.id.desc())
        .all()
    )
    return [_event_out(e) for e in events]


@router.post("", response_model=VisitOut)
def create_or_add_visit(
    body: VisitCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.REP.value))],
):
    if not user.representative_id or not user.agent_id:
        raise HTTPException(status_code=400, detail="未绑定代表或代理商")

    rep = db.get(Representative, user.representative_id)
    if not rep or not rep.agent:
        raise HTTPException(status_code=400, detail="代表组织信息不完整")

    hospital = None
    if body.hospital_id:
        hospital = db.get(Hospital, body.hospital_id)
        if not hospital or not hospital.is_active:
            raise HTTPException(status_code=400, detail="医院终端不存在或已停用")

    provider_id = rep.agent.provider_id
    visit_date = body.visit_date or date.today()
    add_count = max(int(body.visit_count or 1), 1)

    row = (
        db.query(VisitRecord)
        .filter(
            VisitRecord.representative_id == user.representative_id,
            VisitRecord.period == body.period,
        )
        .first()
    )
    if row:
        row.visit_count += add_count
        if body.note:
            row.note = body.note
        row.uploaded_on = date.today()
    else:
        row = VisitRecord(
            representative_id=user.representative_id,
            provider_id=provider_id,
            agent_id=user.agent_id,
            period=body.period,
            visit_count=add_count,
            target_count=3,
            uploaded_on=date.today(),
            note=body.note,
        )
        db.add(row)
        db.flush()

    for _ in range(add_count):
        db.add(
            VisitEvent(
                visit_record_id=row.id,
                representative_id=user.representative_id,
                provider_id=provider_id,
                agent_id=user.agent_id,
                hospital_id=hospital.id if hospital else None,
                visit_date=visit_date,
                period=body.period,
                note=body.note,
            )
        )

    db.commit()
    db.refresh(row)
    return _to_out(db, row)

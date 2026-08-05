import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import AcademicMeeting, Agent, MeetingStatus, ServiceProvider, User, UserRole
from app.schemas import MeetingCreate, MeetingOut, MeetingSummaryUpdate, MeetingUpdate

router = APIRouter(prefix="/meetings", tags=["meetings"])


def _attendees(row: AcademicMeeting) -> list[str]:
    if not row.attendees_json:
        return []
    try:
        data = json.loads(row.attendees_json)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _to_out(db: Session, row: AcademicMeeting) -> MeetingOut:
    item = MeetingOut.model_validate(row)
    item.attendees = _attendees(row)
    item.rep_name = row.representative.name if row.representative else None
    item.agent_name = row.agent.name if row.agent else None
    provider = db.get(ServiceProvider, row.provider_id)
    item.provider_name = provider.name if provider else None
    return item


@router.get("", response_model=list[MeetingOut])
def list_meetings(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    q: str | None = Query(default=None),
    rep_q: str | None = Query(default=None),
):
    query = db.query(AcademicMeeting)
    if user.role == UserRole.AGENT.value and user.agent_id:
        query = query.filter(AcademicMeeting.agent_id == user.agent_id)
    elif user.role == UserRole.REP.value and user.representative_id:
        query = query.filter(
            AcademicMeeting.representative_id == user.representative_id
        )
    rows = query.order_by(AcademicMeeting.id.desc()).all()
    if q:
        rows = [r for r in rows if q in r.title or (r.location and q in r.location)]
    if rep_q:
        rows = [
            r
            for r in rows
            if (
                (r.representative and rep_q in r.representative.name)
                or any(rep_q in a for a in _attendees(r))
            )
        ]
    return [_to_out(db, r) for r in rows]


@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting(
    meeting_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = db.get(AcademicMeeting, meeting_id)
    if not row:
        raise HTTPException(status_code=404, detail="会议不存在")
    return _to_out(db, row)


@router.post("", response_model=MeetingOut)
def create_meeting(
    body: MeetingCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.AGENT.value, UserRole.ADMIN.value))],
):
    agent_id = user.agent_id
    if user.role == UserRole.ADMIN.value:
        agent = db.query(Agent).order_by(Agent.id).first()
        agent_id = agent.id if agent else None
    if not agent_id:
        raise HTTPException(status_code=400, detail="未绑定代理商")
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=400, detail="代理商不存在")

    attendees = body.attendees or []
    count = body.attendees_count if body.attendees_count is not None else len(attendees)
    row = AcademicMeeting(
        title=body.title,
        meeting_type=body.meeting_type,
        location=body.location,
        meeting_date=body.meeting_date,
        agent_id=agent_id,
        provider_id=agent.provider_id,
        representative_id=body.representative_id,
        attendees_count=count,
        attendees_json=json.dumps(attendees, ensure_ascii=False),
        purpose=body.purpose,
        budget=body.budget,
        status=MeetingStatus.PENDING.value if body.submit else MeetingStatus.PLANNING.value,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(db, row)


@router.patch("/{meeting_id}", response_model=MeetingOut)
def update_meeting(
    meeting_id: int,
    body: MeetingUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.AGENT.value, UserRole.ADMIN.value))],
):
    row = db.get(AcademicMeeting, meeting_id)
    if not row:
        raise HTTPException(status_code=404, detail="会议不存在")
    if user.role == UserRole.AGENT.value and row.agent_id != user.agent_id:
        raise HTTPException(status_code=403, detail="无权操作")
    if row.status == MeetingStatus.CLOSED.value:
        raise HTTPException(status_code=400, detail="已完成会议不可修改")

    data = body.model_dump(exclude_unset=True)
    attendees = data.pop("attendees", None)
    for k, v in data.items():
        setattr(row, k, v)
    if attendees is not None:
        row.attendees_json = json.dumps(attendees, ensure_ascii=False)
        if body.attendees_count is None:
            row.attendees_count = len(attendees)
    db.commit()
    db.refresh(row)
    return _to_out(db, row)


@router.post("/{meeting_id}/submit", response_model=MeetingOut)
def submit_meeting(
    meeting_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.AGENT.value, UserRole.ADMIN.value))],
):
    row = db.get(AcademicMeeting, meeting_id)
    if not row:
        raise HTTPException(status_code=404, detail="会议不存在")
    if user.role == UserRole.AGENT.value and row.agent_id != user.agent_id:
        raise HTTPException(status_code=403, detail="无权操作")
    if row.status not in {MeetingStatus.PLANNING.value, MeetingStatus.REJECTED.value}:
        raise HTTPException(status_code=400, detail="当前状态不可提交审批")
    row.status = MeetingStatus.PENDING.value
    db.commit()
    db.refresh(row)
    return _to_out(db, row)


@router.post("/{meeting_id}/approve", response_model=MeetingOut)
def approve_meeting(
    meeting_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value, UserRole.COMPLIANCE.value))],
):
    row = db.get(AcademicMeeting, meeting_id)
    if not row:
        raise HTTPException(status_code=404, detail="会议不存在")
    row.status = MeetingStatus.APPROVED.value
    db.commit()
    db.refresh(row)
    return _to_out(db, row)


@router.post("/{meeting_id}/reject", response_model=MeetingOut)
def reject_meeting(
    meeting_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value, UserRole.COMPLIANCE.value))],
):
    row = db.get(AcademicMeeting, meeting_id)
    if not row:
        raise HTTPException(status_code=404, detail="会议不存在")
    row.status = MeetingStatus.REJECTED.value
    db.commit()
    db.refresh(row)
    return _to_out(db, row)


@router.post("/{meeting_id}/summary", response_model=MeetingOut)
def submit_summary(
    meeting_id: int,
    body: MeetingSummaryUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.AGENT.value, UserRole.REP.value))],
):
    row = db.get(AcademicMeeting, meeting_id)
    if not row:
        raise HTTPException(status_code=404, detail="会议不存在")
    if user.role == UserRole.AGENT.value and row.agent_id != user.agent_id:
        raise HTTPException(status_code=403, detail="无权操作")
    if user.role == UserRole.REP.value and row.representative_id != user.representative_id:
        raise HTTPException(status_code=403, detail="无权操作")
    if row.status not in {MeetingStatus.APPROVED.value, MeetingStatus.CLOSED.value}:
        raise HTTPException(status_code=400, detail="仅已批准会议可提交总结")
    row.summary = body.summary
    row.status = MeetingStatus.CLOSED.value
    db.commit()
    db.refresh(row)
    return _to_out(db, row)

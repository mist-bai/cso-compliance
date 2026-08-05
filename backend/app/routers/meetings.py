from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import AcademicMeeting, Agent, MeetingStatus, User, UserRole
from app.schemas import MeetingCreate, MeetingOut, MeetingSummaryUpdate

router = APIRouter(prefix="/meetings", tags=["meetings"])


def _to_out(row: AcademicMeeting) -> MeetingOut:
    item = MeetingOut.model_validate(row)
    item.rep_name = row.representative.name if row.representative else None
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
            if r.representative and rep_q in r.representative.name
        ]
    return [_to_out(r) for r in rows]


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

    row = AcademicMeeting(
        title=body.title,
        location=body.location,
        meeting_date=body.meeting_date,
        agent_id=agent_id,
        provider_id=agent.provider_id,
        representative_id=body.representative_id,
        budget=body.budget,
        status=MeetingStatus.PENDING.value,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.post("/{meeting_id}/approve", response_model=MeetingOut)
def approve_meeting(
    meeting_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value, UserRole.COMPLIANCE.value))],
):
    row = db.get(AcademicMeeting, meeting_id)
    if not row:
        raise HTTPException(status_code=404, detail="会议不存在")
    row.status = MeetingStatus.SUMMARY_PENDING.value
    db.commit()
    db.refresh(row)
    return _to_out(row)


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
    row.summary = body.summary
    row.status = MeetingStatus.CLOSED.value
    db.commit()
    db.refresh(row)
    return _to_out(row)

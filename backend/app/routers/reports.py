from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import Agent, ComplianceReport, ReportStatus, User, UserRole
from app.schemas import ReportCreate, ReportOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=list[ReportOut])
def list_reports(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    q = db.query(ComplianceReport)
    if user.role == UserRole.AGENT.value and user.agent_id:
        q = q.filter(ComplianceReport.agent_id == user.agent_id)
    return q.order_by(ComplianceReport.id.desc()).all()


@router.post("", response_model=ReportOut)
def create_report(
    body: ReportCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.AGENT.value))],
):
    if not user.agent_id:
        raise HTTPException(status_code=400, detail="未绑定代理商")
    agent = db.get(Agent, user.agent_id)
    if not agent:
        raise HTTPException(status_code=400, detail="代理商不存在")
    row = ComplianceReport(
        title=body.title,
        period=body.period,
        content=body.content,
        agent_id=user.agent_id,
        provider_id=agent.provider_id,
        status=ReportStatus.SUBMITTED.value,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/{report_id}/approve", response_model=ReportOut)
def approve_report(
    report_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value, UserRole.COMPLIANCE.value))],
):
    row = db.get(ComplianceReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="报告不存在")
    row.status = ReportStatus.APPROVED.value
    db.commit()
    db.refresh(row)
    return row

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import (
    AcademicMeeting,
    Course,
    CourseEnrollment,
    CourseProgressStatus,
    FilingStatus,
    MeetingStatus,
    RepFiling,
    Representative,
    ServiceProvider,
    User,
    UserRole,
    VisitRecord,
)
from app.schemas import DashboardProviderRow

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _compliance_user():
    return Depends(
        require_roles(UserRole.COMPLIANCE.value, UserRole.ADMIN.value)
    )


@router.get("/providers", response_model=list[DashboardProviderRow])
def provider_cockpit(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[
        User,
        Depends(
            require_roles(
                UserRole.COMPLIANCE.value,
                UserRole.ADMIN.value,
            )
        ),
    ],
    q: str | None = None,
):
    providers = db.query(ServiceProvider).order_by(ServiceProvider.id).all()
    if q:
        providers = [p for p in providers if q in p.name]

    rows: list[DashboardProviderRow] = []
    for p in providers:
        agent_ids = [a.id for a in p.agents]
        if not agent_ids:
            rows.append(
                DashboardProviderRow(
                    provider_id=p.id,
                    provider_name=p.name,
                    rep_count=0,
                    active_filings=0,
                    visit_total=0,
                    meeting_count=0,
                )
            )
            continue

        rep_count = (
            db.query(func.count(Representative.id))
            .filter(Representative.agent_id.in_(agent_ids))
            .scalar()
            or 0
        )
        active_filings = (
            db.query(func.count(RepFiling.id))
            .filter(
                RepFiling.provider_id == p.id,
                RepFiling.status == FilingStatus.ACTIVE.value,
            )
            .scalar()
            or 0
        )
        visit_total = (
            db.query(func.coalesce(func.sum(VisitRecord.visit_count), 0))
            .filter(VisitRecord.provider_id == p.id)
            .scalar()
            or 0
        )
        meeting_count = (
            db.query(func.count(AcademicMeeting.id))
            .filter(AcademicMeeting.provider_id == p.id)
            .scalar()
            or 0
        )
        # 待培训：该服务商下代表中，存在未通过/未完成课程的人数
        provider_rep_ids = [
            r.id
            for r in db.query(Representative)
            .filter(Representative.agent_id.in_(agent_ids))
            .all()
        ]
        active_courses = (
            db.query(func.count(Course.id)).filter(Course.is_active.is_(True)).scalar() or 0
        )
        training_pending = 0
        if provider_rep_ids and active_courses:
            for rid in provider_rep_ids:
                completed = (
                    db.query(func.count(CourseEnrollment.id))
                    .filter(
                        CourseEnrollment.representative_id == rid,
                        CourseEnrollment.status.in_(
                            [
                                CourseProgressStatus.PASSED.value,
                                CourseProgressStatus.COMPLETED.value,
                            ]
                        ),
                    )
                    .scalar()
                    or 0
                )
                if int(completed) < int(active_courses):
                    training_pending += 1
        rows.append(
            DashboardProviderRow(
                provider_id=p.id,
                provider_name=p.name,
                rep_count=int(rep_count),
                active_filings=int(active_filings),
                visit_total=int(visit_total),
                meeting_count=int(meeting_count),
                training_pending=training_pending,
            )
        )
    return rows


@router.get("/summary")
def summary(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[
        User,
        Depends(require_roles(UserRole.COMPLIANCE.value, UserRole.ADMIN.value)),
    ],
):
    return {
        "reps": db.query(func.count(Representative.id)).scalar() or 0,
        "filings": db.query(func.count(RepFiling.id)).scalar() or 0,
        "active_filings": db.query(func.count(RepFiling.id))
        .filter(RepFiling.status == FilingStatus.ACTIVE.value)
        .scalar()
        or 0,
        "visits": db.query(func.coalesce(func.sum(VisitRecord.visit_count), 0)).scalar()
        or 0,
        "meetings": db.query(func.count(AcademicMeeting.id)).scalar() or 0,
        "pending_exam": db.query(func.count(RepFiling.id))
        .filter(RepFiling.status == FilingStatus.APPLIED_PENDING_EXAM.value)
        .scalar()
        or 0,
    }


@router.get("/reps")
def rep_monitor(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, _compliance_user()],
    q: str | None = None,
):
    """代表合规监控明细。"""
    filings = db.query(RepFiling).order_by(RepFiling.id.desc()).limit(200).all()
    rows = []
    for f in filings:
        rep = f.representative
        if q and rep and q not in rep.name:
            continue
        visit_total = (
            db.query(func.coalesce(func.sum(VisitRecord.visit_count), 0))
            .filter(VisitRecord.representative_id == f.representative_id)
            .scalar()
            or 0
        )
        rows.append(
            {
                "filing_id": f.id,
                "rep_name": rep.name if rep else None,
                "agent_name": f.agent.name if f.agent else None,
                "provider_name": f.provider.name if f.provider else None,
                "factory_name": f.factory.name if f.factory else None,
                "status": f.status,
                "valid_from": f.valid_from.isoformat() if f.valid_from else None,
                "valid_to": f.valid_to.isoformat() if f.valid_to else None,
                "visit_total": int(visit_total),
                "risk": f.status
                in {
                    FilingStatus.APPLIED_PENDING_EXAM.value,
                    FilingStatus.REVOKED.value,
                },
            }
        )
    return rows


@router.get("/meetings")
def meeting_monitor(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, _compliance_user()],
    q: str | None = None,
):
    """会议合规看板明细。"""
    meetings = db.query(AcademicMeeting).order_by(AcademicMeeting.id.desc()).limit(200).all()
    rows = []
    for m in meetings:
        if q and q not in m.title and (not m.location or q not in m.location):
            continue
        rows.append(
            {
                "id": m.id,
                "title": m.title,
                "meeting_type": m.meeting_type,
                "location": m.location,
                "meeting_date": m.meeting_date.isoformat() if m.meeting_date else None,
                "status": m.status,
                "budget": m.budget,
                "provider_name": m.agent.provider.name
                if m.agent and m.agent.provider
                else None,
                "agent_name": m.agent.name if m.agent else None,
                "has_summary": bool(m.summary),
                "need_attention": m.status
                in {
                    MeetingStatus.PENDING.value,
                    MeetingStatus.APPROVED.value,
                }
                and not m.summary,
            }
        )
    return rows


@router.get("/charts")
def charts(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, _compliance_user()],
):
    """看板图表数据：拜访、会议、备案、培训。"""
    visit_rows = (
        db.query(VisitRecord.period, func.sum(VisitRecord.visit_count))
        .group_by(VisitRecord.period)
        .order_by(VisitRecord.period)
        .all()
    )
    visits_by_period = [
        {"label": period, "value": int(total or 0)} for period, total in visit_rows
    ]

    meeting_status_counts = (
        db.query(AcademicMeeting.status, func.count(AcademicMeeting.id))
        .group_by(AcademicMeeting.status)
        .all()
    )
    meetings_by_status = [
        {"label": status, "value": int(cnt)} for status, cnt in meeting_status_counts
    ]

    filing_status_counts = (
        db.query(RepFiling.status, func.count(RepFiling.id))
        .group_by(RepFiling.status)
        .all()
    )
    filings_by_status = [
        {"label": status, "value": int(cnt)} for status, cnt in filing_status_counts
    ]

    train_passed = (
        db.query(func.count(CourseEnrollment.id))
        .filter(
            CourseEnrollment.status.in_(
                [
                    CourseProgressStatus.PASSED.value,
                    CourseProgressStatus.COMPLETED.value,
                ]
            )
        )
        .scalar()
        or 0
    )
    train_total = db.query(func.count(CourseEnrollment.id)).scalar() or 0
    train_pending = max(int(train_total) - int(train_passed), 0)

    return {
        "visits_by_period": visits_by_period,
        "meetings_by_status": meetings_by_status,
        "filings_by_status": filings_by_status,
        "training": [
            {"label": "已完成/通过", "value": int(train_passed)},
            {"label": "进行中/未完成", "value": train_pending},
        ],
        "meeting_approved": int(
            db.query(func.count(AcademicMeeting.id))
            .filter(AcademicMeeting.status == MeetingStatus.APPROVED.value)
            .scalar()
            or 0
        ),
    }

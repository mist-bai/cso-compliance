from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import (
    AcademicMeeting,
    FilingStatus,
    RepFiling,
    Representative,
    ServiceProvider,
    User,
    UserRole,
    VisitRecord,
)
from app.schemas import DashboardProviderRow

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


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
        rows.append(
            DashboardProviderRow(
                provider_id=p.id,
                provider_name=p.name,
                rep_count=int(rep_count),
                active_filings=int(active_filings),
                visit_total=int(visit_total),
                meeting_count=int(meeting_count),
                training_pending=4,
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

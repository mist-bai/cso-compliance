from __future__ import annotations

import json
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import (
    Course,
    CourseEnrollment,
    CourseProgressStatus,
    ExamQuestion,
    FilingStatus,
    RepFiling,
    Representative,
    User,
    UserRole,
)
from app.schemas import (
    CourseCreate,
    CourseOut,
    EnrollmentOut,
    ExamResultOut,
    ExamSubmit,
    QuestionCreate,
    QuestionOut,
)

router = APIRouter(prefix="/training", tags=["training"])


def _course_out(db: Session, course: Course) -> CourseOut:
    item = CourseOut.model_validate(course)
    item.question_count = (
        db.query(func.count(ExamQuestion.id))
        .filter(ExamQuestion.course_id == course.id)
        .scalar()
        or 0
    )
    enrolls = db.query(CourseEnrollment).filter(CourseEnrollment.course_id == course.id).all()
    item.learner_count = len(enrolls)
    if enrolls:
        passed = sum(1 for e in enrolls if e.passed)
        item.pass_rate = round(passed / len(enrolls) * 100, 1)
    else:
        item.pass_rate = None
    return item


def _enrollment_out(row: CourseEnrollment) -> EnrollmentOut:
    item = EnrollmentOut.model_validate(row)
    item.course_name = row.course.name if row.course else None
    item.duration_minutes = row.course.duration_minutes if row.course else None
    item.has_exam = row.course.has_exam if row.course else None
    item.is_compliance = row.course.is_compliance if row.course else None
    item.rep_name = row.representative.name if row.representative else None
    return item


@router.get("/courses", response_model=list[CourseOut])
def list_courses(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    q: str | None = None,
):
    rows = db.query(Course).filter(Course.is_active.is_(True)).order_by(Course.id).all()
    if q:
        rows = [r for r in rows if q in r.name or (r.description and q in r.description)]
    return [_course_out(db, r) for r in rows]


@router.post("/courses", response_model=CourseOut)
def create_course(
    body: CourseCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value, UserRole.ACADEMY.value))],
):
    row = Course(**body.model_dump(), published_on=date.today())
    db.add(row)
    db.commit()
    db.refresh(row)
    return _course_out(db, row)


@router.get("/courses/{course_id}", response_model=CourseOut)
def get_course(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = db.get(Course, course_id)
    if not row:
        raise HTTPException(status_code=404, detail="课程不存在")
    return _course_out(db, row)


@router.get("/courses/{course_id}/questions", response_model=list[QuestionOut])
def list_questions(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    rows = (
        db.query(ExamQuestion)
        .filter(ExamQuestion.course_id == course_id)
        .order_by(ExamQuestion.sort_order, ExamQuestion.id)
        .all()
    )
    show_answer = user.role in {UserRole.ADMIN.value, UserRole.ACADEMY.value}
    out = []
    for r in rows:
        item = QuestionOut(
            id=r.id,
            course_id=r.course_id,
            stem=r.stem,
            options=json.loads(r.options_json),
            score=r.score,
            sort_order=r.sort_order,
            answer=r.answer if show_answer else None,
        )
        out.append(item)
    return out


@router.post("/courses/{course_id}/questions", response_model=QuestionOut)
def create_question(
    course_id: int,
    body: QuestionCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value, UserRole.ACADEMY.value))],
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    if len(body.options) < 2:
        raise HTTPException(status_code=400, detail="至少需要 2 个选项")
    answer = body.answer.strip().upper()
    if answer not in {chr(65 + i) for i in range(len(body.options))}:
        raise HTTPException(status_code=400, detail="答案必须对应选项字母")
    row = ExamQuestion(
        course_id=course_id,
        stem=body.stem,
        options_json=json.dumps(body.options, ensure_ascii=False),
        answer=answer,
        score=body.score,
        sort_order=body.sort_order,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return QuestionOut(
        id=row.id,
        course_id=row.course_id,
        stem=row.stem,
        options=body.options,
        score=row.score,
        sort_order=row.sort_order,
        answer=row.answer,
    )


@router.delete("/courses/{course_id}/questions/{question_id}")
def delete_question(
    course_id: int,
    question_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN.value, UserRole.ACADEMY.value))],
):
    row = db.get(ExamQuestion, question_id)
    if not row or row.course_id != course_id:
        raise HTTPException(status_code=404, detail="题目不存在")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/enrollments", response_model=list[EnrollmentOut])
def list_enrollments(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    course_id: int | None = None,
):
    q = db.query(CourseEnrollment)
    if user.role == UserRole.REP.value and user.representative_id:
        q = q.filter(CourseEnrollment.representative_id == user.representative_id)
    elif user.role == UserRole.AGENT.value and user.agent_id:
        rep_ids = [
            r.id
            for r in db.query(Representative)
            .filter(Representative.agent_id == user.agent_id)
            .all()
        ]
        q = q.filter(CourseEnrollment.representative_id.in_(rep_ids or [-1]))
    if course_id:
        q = q.filter(CourseEnrollment.course_id == course_id)
    rows = q.order_by(CourseEnrollment.id.desc()).all()
    return [_enrollment_out(r) for r in rows]


@router.post("/courses/{course_id}/enroll", response_model=EnrollmentOut)
def enroll_course(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.REP.value))],
):
    if not user.representative_id:
        raise HTTPException(status_code=400, detail="未绑定代表")
    course = db.get(Course, course_id)
    if not course or not course.is_active:
        raise HTTPException(status_code=404, detail="课程不存在")
    row = (
        db.query(CourseEnrollment)
        .filter(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.representative_id == user.representative_id,
        )
        .first()
    )
    if not row:
        row = CourseEnrollment(
            course_id=course_id,
            representative_id=user.representative_id,
            status=CourseProgressStatus.LEARNING.value,
            learned_at=datetime.utcnow(),
        )
        db.add(row)
    else:
        if row.status == CourseProgressStatus.NOT_STARTED.value:
            row.status = CourseProgressStatus.LEARNING.value
            row.learned_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _enrollment_out(row)


@router.post("/courses/{course_id}/complete-learning", response_model=EnrollmentOut)
def complete_learning(
    course_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.REP.value))],
):
    row = (
        db.query(CourseEnrollment)
        .filter(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.representative_id == user.representative_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=400, detail="请先开始学习")
    course = db.get(Course, course_id)
    if course and course.has_exam:
        row.status = CourseProgressStatus.READY_EXAM.value
    else:
        row.status = CourseProgressStatus.COMPLETED.value
        row.passed = True
    row.learned_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _enrollment_out(row)


@router.post("/courses/{course_id}/exam", response_model=ExamResultOut)
def submit_exam(
    course_id: int,
    body: ExamSubmit,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.REP.value))],
):
    if not user.representative_id:
        raise HTTPException(status_code=400, detail="未绑定代表")
    course = db.get(Course, course_id)
    if not course or not course.has_exam:
        raise HTTPException(status_code=400, detail="该课程无考试")

    enrollment = (
        db.query(CourseEnrollment)
        .filter(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.representative_id == user.representative_id,
        )
        .first()
    )
    if not enrollment:
        enrollment = CourseEnrollment(
            course_id=course_id,
            representative_id=user.representative_id,
            status=CourseProgressStatus.READY_EXAM.value,
        )
        db.add(enrollment)
        db.flush()

    questions = (
        db.query(ExamQuestion).filter(ExamQuestion.course_id == course_id).all()
    )
    if not questions:
        raise HTTPException(status_code=400, detail="试卷题目未配置")

    score = 0
    max_score = 0
    for q in questions:
        max_score += q.score
        ans = (body.answers.get(str(q.id)) or body.answers.get(q.id) or "").strip().upper()
        if ans == q.answer.upper():
            score += q.score

    passed = score >= course.pass_score
    enrollment.score = score
    enrollment.max_score = max_score
    enrollment.passed = passed
    enrollment.examined_at = datetime.utcnow()
    enrollment.status = (
        CourseProgressStatus.PASSED.value if passed else CourseProgressStatus.FAILED.value
    )

    filing_updated = 0
    if passed and course.is_compliance:
        filings = (
            db.query(RepFiling)
            .filter(
                RepFiling.representative_id == user.representative_id,
                RepFiling.status == FilingStatus.APPLIED_PENDING_EXAM.value,
            )
            .all()
        )
        for f in filings:
            f.status = FilingStatus.EXAM_PASSED_PENDING_FILING.value
            filing_updated += 1

    db.commit()
    return ExamResultOut(
        enrollment_id=enrollment.id,
        score=score,
        max_score=max_score,
        passed=passed,
        status=enrollment.status,
        filing_updated=filing_updated,
    )


@router.get("/stats/by-rep")
def training_stats_by_rep(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[
        User,
        Depends(
            require_roles(
                UserRole.AGENT.value,
                UserRole.ADMIN.value,
                UserRole.ACADEMY.value,
                UserRole.COMPLIANCE.value,
            )
        ),
    ],
):
    """代理商/合规视角：代表培训完成情况。"""
    q = db.query(Representative)
    if user.role == UserRole.AGENT.value and user.agent_id:
        q = q.filter(Representative.agent_id == user.agent_id)
    reps = q.all()
    courses = db.query(Course).filter(Course.is_active.is_(True)).all()
    out = []
    for rep in reps:
        enrolls = {
            e.course_id: e
            for e in db.query(CourseEnrollment)
            .filter(CourseEnrollment.representative_id == rep.id)
            .all()
        }
        completed = sum(
            1
            for e in enrolls.values()
            if e.status
            in {
                CourseProgressStatus.PASSED.value,
                CourseProgressStatus.COMPLETED.value,
            }
        )
        out.append(
            {
                "representative_id": rep.id,
                "rep_name": rep.name,
                "total_courses": len(courses),
                "completed_courses": completed,
                "pending_courses": max(len(courses) - completed, 0),
                "enrollments": [_enrollment_out(e) for e in enrolls.values()],
            }
        )
    return out

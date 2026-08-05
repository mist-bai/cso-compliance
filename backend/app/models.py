from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, Enum):
    ADMIN = "admin"
    AGENT = "agent"
    REP = "rep"
    COMPLIANCE = "compliance"
    ACADEMY = "academy"


class FilingStatus(str, Enum):
    APPLIED_PENDING_EXAM = "已申请待考试"
    EXAM_PASSED_PENDING_FILING = "考试通过待备案"
    ACTIVE = "备案有效"
    REVOKED = "备案撤销"


class MeetingStatus(str, Enum):
    PLANNING = "计划中"
    PENDING = "待审批"
    APPROVED = "已批准"
    REJECTED = "已驳回"
    CLOSED = "已完成"


class CourseProgressStatus(str, Enum):
    NOT_STARTED = "未开始"
    LEARNING = "学习中"
    READY_EXAM = "待考试"
    PASSED = "考试通过"
    FAILED = "考试未通过"
    COMPLETED = "已完成"


class ReportStatus(str, Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    APPROVED = "已通过"
    REJECTED = "已驳回"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(32), index=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    agent_id: Mapped[int | None] = mapped_column(ForeignKey("agents.id"), nullable=True)
    representative_id: Mapped[int | None] = mapped_column(
        ForeignKey("representatives.id"), nullable=True
    )


class Factory(Base, TimestampMixin):
    """法人工厂/组织，对齐问数 organizations.json。"""

    __tablename__ = "factories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    short_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    region: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    products: Mapped[list[Product]] = relationship(back_populates="factory")


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    factory_id: Mapped[int] = mapped_column(ForeignKey("factories.id"))
    code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    source: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    factory: Mapped[Factory] = relationship(back_populates="products")


class Hospital(Base, TimestampMixin):
    """医院/终端主数据（后续可从 marketing_hospital_profile 批量导入）。"""

    __tablename__ = "hospitals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(256), index=True)
    province: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    city: Mapped[str | None] = mapped_column(String(64), nullable=True)
    level: Mapped[str | None] = mapped_column(String(64), nullable=True)
    terminal_code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ServiceProvider(Base, TimestampMixin):
    """服务商（发薪/备案机构），如大连博道、天津博达。"""

    __tablename__ = "service_providers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    code: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    region: Mapped[str | None] = mapped_column(String(64), nullable=True)
    contact: Mapped[str | None] = mapped_column(String(64), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source: Mapped[str | None] = mapped_column(String(256), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    agents: Mapped[list[Agent]] = relationship(back_populates="provider")


class Agent(Base, TimestampMixin):
    """代理商公司。"""

    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("service_providers.id"))
    contact: Mapped[str | None] = mapped_column(String(64), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(128), nullable=True)
    region: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    provider: Mapped[ServiceProvider] = relationship(back_populates="agents")
    representatives: Mapped[list[Representative]] = relationship(back_populates="agent")


class Representative(Base, TimestampMixin):
    """外部代表（CSO 代表）。"""

    __tablename__ = "representatives"
    __table_args__ = (UniqueConstraint("id_card", name="uq_rep_id_card"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), index=True)
    id_card: Mapped[str] = mapped_column(String(32), index=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    agent: Mapped[Agent] = relationship(back_populates="representatives")
    filings: Mapped[list[RepFiling]] = relationship(back_populates="representative")


class RepFiling(Base, TimestampMixin):
    """代表备案（按工厂）。"""

    __tablename__ = "rep_filings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    representative_id: Mapped[int] = mapped_column(ForeignKey("representatives.id"))
    factory_id: Mapped[int] = mapped_column(ForeignKey("factories.id"))
    provider_id: Mapped[int] = mapped_column(ForeignKey("service_providers.id"))
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    status: Mapped[str] = mapped_column(
        String(32), default=FilingStatus.APPLIED_PENDING_EXAM.value, index=True
    )
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    representative: Mapped[Representative] = relationship(back_populates="filings")
    factory: Mapped[Factory] = relationship()
    provider: Mapped[ServiceProvider] = relationship()
    agent: Mapped[Agent] = relationship()


class VisitRecord(Base, TimestampMixin):
    """按月汇总的拜访统计。"""

    __tablename__ = "visit_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    representative_id: Mapped[int] = mapped_column(ForeignKey("representatives.id"))
    provider_id: Mapped[int] = mapped_column(ForeignKey("service_providers.id"))
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    period: Mapped[str] = mapped_column(String(16), index=True)  # YYYY-MM
    visit_count: Mapped[int] = mapped_column(Integer, default=0)
    target_count: Mapped[int] = mapped_column(Integer, default=3)
    uploaded_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    representative: Mapped[Representative] = relationship()
    events: Mapped[list[VisitEvent]] = relationship(back_populates="visit_record")


class VisitEvent(Base, TimestampMixin):
    """单次拜访明细（可关联医院终端）。"""

    __tablename__ = "visit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_record_id: Mapped[int] = mapped_column(ForeignKey("visit_records.id"), index=True)
    representative_id: Mapped[int] = mapped_column(ForeignKey("representatives.id"), index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("service_providers.id"))
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospitals.id"), nullable=True)
    visit_date: Mapped[date] = mapped_column(Date, index=True)
    period: Mapped[str] = mapped_column(String(16), index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    visit_record: Mapped[VisitRecord] = relationship(back_populates="events")
    hospital: Mapped[Hospital | None] = relationship()
    representative: Mapped[Representative] = relationship()


class AcademicMeeting(Base, TimestampMixin):
    __tablename__ = "academic_meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(256))
    meeting_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    location: Mapped[str | None] = mapped_column(String(256), nullable=True)
    meeting_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    provider_id: Mapped[int] = mapped_column(ForeignKey("service_providers.id"))
    representative_id: Mapped[int | None] = mapped_column(
        ForeignKey("representatives.id"), nullable=True
    )
    attendees_count: Mapped[int] = mapped_column(Integer, default=0)
    attendees_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON 姓名列表
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default=MeetingStatus.PLANNING.value)
    budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    agent: Mapped[Agent] = relationship()
    representative: Mapped[Representative | None] = relationship()


class Course(Base, TimestampMixin):
    """培训课程（对齐原型课程管理）。"""

    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(256))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    has_exam: Mapped[bool] = mapped_column(Boolean, default=True)
    is_compliance: Mapped[bool] = mapped_column(Boolean, default=False)  # 备案考试课程
    pass_score: Mapped[int] = mapped_column(Integer, default=60)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    questions: Mapped[list[ExamQuestion]] = relationship(back_populates="course")


class ExamQuestion(Base, TimestampMixin):
    __tablename__ = "exam_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    stem: Mapped[str] = mapped_column(Text)
    options_json: Mapped[str] = mapped_column(Text)  # JSON list[str]
    answer: Mapped[str] = mapped_column(String(8))  # A/B/C/D
    score: Mapped[int] = mapped_column(Integer, default=20)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    course: Mapped[Course] = relationship(back_populates="questions")


class CourseEnrollment(Base, TimestampMixin):
    __tablename__ = "course_enrollments"
    __table_args__ = (
        UniqueConstraint("course_id", "representative_id", name="uq_course_rep"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    representative_id: Mapped[int] = mapped_column(
        ForeignKey("representatives.id"), index=True
    )
    status: Mapped[str] = mapped_column(
        String(32), default=CourseProgressStatus.NOT_STARTED.value
    )
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    learned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    examined_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    course: Mapped[Course] = relationship()
    representative: Mapped[Representative] = relationship()


class ComplianceReport(Base, TimestampMixin):
    __tablename__ = "compliance_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(256))
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    provider_id: Mapped[int] = mapped_column(ForeignKey("service_providers.id"))
    period: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(32), default=ReportStatus.SUBMITTED.value)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)

    agent: Mapped[Agent] = relationship()


class FeeStandard(Base, TimestampMixin):
    __tablename__ = "fee_standards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    category: Mapped[str] = mapped_column(String(64), default="会议")
    amount: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str] = mapped_column(String(32), default="场")
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

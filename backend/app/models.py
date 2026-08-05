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
    DRAFT = "草稿"
    PENDING = "待审批"
    APPROVED = "已批准"
    REJECTED = "已驳回"
    SUMMARY_PENDING = "待提交总结"
    CLOSED = "已完成"


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
    __tablename__ = "factories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    region: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    products: Mapped[list[Product]] = relationship(back_populates="factory")


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    factory_id: Mapped[int] = mapped_column(ForeignKey("factories.id"))
    code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    factory: Mapped[Factory] = relationship(back_populates="products")


class ServiceProvider(Base, TimestampMixin):
    """服务商，如哈分。"""

    __tablename__ = "service_providers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    region: Mapped[str | None] = mapped_column(String(64), nullable=True)
    contact: Mapped[str | None] = mapped_column(String(64), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
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


class AcademicMeeting(Base, TimestampMixin):
    __tablename__ = "academic_meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(256))
    location: Mapped[str | None] = mapped_column(String(256), nullable=True)
    meeting_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"))
    provider_id: Mapped[int] = mapped_column(ForeignKey("service_providers.id"))
    representative_id: Mapped[int | None] = mapped_column(
        ForeignKey("representatives.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(32), default=MeetingStatus.PENDING.value)
    budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    agent: Mapped[Agent] = relationship()
    representative: Mapped[Representative | None] = relationship()


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

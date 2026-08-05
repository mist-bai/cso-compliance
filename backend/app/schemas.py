from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    display_name: str
    username: str


class UserOut(OrmModel):
    id: int
    username: str
    display_name: str
    role: str
    phone: str | None = None
    email: str | None = None
    agent_id: int | None = None
    representative_id: int | None = None


class LoginForm(BaseModel):
    username: str
    password: str


class FactoryOut(OrmModel):
    id: int
    name: str
    region: str | None = None
    is_active: bool


class ProductOut(OrmModel):
    id: int
    name: str
    factory_id: int
    code: str | None = None
    is_active: bool
    factory_name: str | None = None


class ProductCreate(BaseModel):
    name: str
    factory_id: int
    code: str | None = None


class ProviderOut(OrmModel):
    id: int
    name: str
    code: str | None = None
    region: str | None = None
    contact: str | None = None
    phone: str | None = None
    is_active: bool


class ProviderCreate(BaseModel):
    name: str
    code: str | None = None
    region: str | None = None
    contact: str | None = None
    phone: str | None = None


class AgentOut(OrmModel):
    id: int
    name: str
    provider_id: int
    contact: str | None = None
    phone: str | None = None
    email: str | None = None
    region: str | None = None
    is_active: bool
    provider_name: str | None = None


class AgentCreate(BaseModel):
    name: str
    provider_id: int
    contact: str | None = None
    phone: str | None = None
    email: str | None = None
    region: str | None = None
    username: str | None = None
    password: str = "demo123"


class RepOut(OrmModel):
    id: int
    name: str
    id_card: str
    agent_id: int
    phone: str | None = None
    is_active: bool
    agent_name: str | None = None


class RepCreate(BaseModel):
    name: str
    id_card: str
    agent_id: int | None = None
    phone: str | None = None


class FilingOut(OrmModel):
    id: int
    representative_id: int
    factory_id: int
    provider_id: int
    agent_id: int
    status: str
    valid_from: date | None = None
    valid_to: date | None = None
    remark: str | None = None
    rep_name: str | None = None
    id_card: str | None = None
    agent_name: str | None = None
    provider_name: str | None = None
    factory_name: str | None = None


class FilingCreate(BaseModel):
    name: str
    id_card: str
    factory_id: int
    phone: str | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    remark: str | None = None


class FilingStatusUpdate(BaseModel):
    status: str
    valid_from: date | None = None
    valid_to: date | None = None
    remark: str | None = None


class VisitOut(OrmModel):
    id: int
    representative_id: int
    provider_id: int
    agent_id: int
    period: str
    visit_count: int
    target_count: int
    uploaded_on: date | None = None
    note: str | None = None
    rep_name: str | None = None
    provider_name: str | None = None
    completion_rate: float | None = None


class VisitCreate(BaseModel):
    period: str = Field(description="YYYY-MM")
    visit_count: int = 1
    note: str | None = None


class MeetingOut(OrmModel):
    id: int
    title: str
    location: str | None = None
    meeting_date: date | None = None
    agent_id: int
    provider_id: int
    representative_id: int | None = None
    status: str
    budget: float | None = None
    summary: str | None = None
    rep_name: str | None = None


class MeetingCreate(BaseModel):
    title: str
    location: str | None = None
    meeting_date: date | None = None
    representative_id: int | None = None
    budget: float | None = None


class MeetingSummaryUpdate(BaseModel):
    summary: str


class ReportOut(OrmModel):
    id: int
    title: str
    agent_id: int
    provider_id: int
    period: str
    status: str
    content: str | None = None
    created_at: datetime | None = None


class ReportCreate(BaseModel):
    title: str
    period: str
    content: str | None = None


class FeeOut(OrmModel):
    id: int
    name: str
    category: str
    amount: float
    unit: str
    remark: str | None = None
    is_active: bool


class FeeCreate(BaseModel):
    name: str
    category: str = "会议"
    amount: float
    unit: str = "场"
    remark: str | None = None


class DashboardProviderRow(BaseModel):
    provider_id: int
    provider_name: str
    rep_count: int
    active_filings: int
    visit_total: int
    meeting_count: int
    training_pending: int = 0

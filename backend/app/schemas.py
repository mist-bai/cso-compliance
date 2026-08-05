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
    code: str | None = None
    name: str
    short_name: str | None = None
    region: str | None = None
    is_active: bool


class ProductOut(OrmModel):
    id: int
    name: str
    factory_id: int
    code: str | None = None
    source: str | None = None
    is_active: bool
    factory_name: str | None = None
    factory_short_name: str | None = None


class HospitalOut(OrmModel):
    id: int
    name: str
    province: str | None = None
    city: str | None = None
    level: str | None = None
    terminal_code: str | None = None
    is_active: bool


class HospitalCreate(BaseModel):
    name: str
    province: str | None = None
    city: str | None = None
    level: str | None = None
    terminal_code: str | None = None


class HospitalBulkItem(BaseModel):
    name: str
    province: str | None = None
    city: str | None = None
    level: str | None = None
    terminal_code: str | None = None


class HospitalBulkImport(BaseModel):
    items: list[HospitalBulkItem]


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
    source: str | None = None
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


class AgentUpdate(BaseModel):
    contact: str | None = None
    phone: str | None = None
    email: str | None = None
    region: str | None = None
    is_active: bool | None = None


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


class RepUpdate(BaseModel):
    phone: str | None = None
    is_active: bool | None = None


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
    create_login: bool = False
    username: str | None = None
    password: str = "demo123"


class FilingCreateOut(FilingOut):
    login_username: str | None = None
    login_created: bool = False


class FilingStatusUpdate(BaseModel):
    status: str
    valid_from: date | None = None
    valid_to: date | None = None
    remark: str | None = None


class VisitEventOut(OrmModel):
    id: int
    visit_record_id: int
    representative_id: int
    hospital_id: int | None = None
    hospital_name: str | None = None
    hospital_province: str | None = None
    hospital_city: str | None = None
    visit_date: date
    period: str
    note: str | None = None
    rep_name: str | None = None


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
    hospital_names: list[str] = []
    event_count: int = 0


class VisitCreate(BaseModel):
    period: str = Field(description="YYYY-MM")
    visit_count: int = 1
    note: str | None = None
    hospital_id: int | None = None
    visit_date: date | None = None


class MeetingOut(OrmModel):
    id: int
    title: str
    meeting_type: str | None = None
    location: str | None = None
    meeting_date: date | None = None
    agent_id: int
    provider_id: int
    representative_id: int | None = None
    attendees_count: int = 0
    attendees: list[str] = []
    purpose: str | None = None
    status: str
    budget: float | None = None
    summary: str | None = None
    rep_name: str | None = None
    provider_name: str | None = None
    agent_name: str | None = None


class MeetingCreate(BaseModel):
    title: str
    meeting_type: str | None = "学术研讨会"
    location: str | None = None
    meeting_date: date | None = None
    representative_id: int | None = None
    attendees: list[str] = []
    attendees_count: int | None = None
    purpose: str | None = None
    budget: float | None = None
    submit: bool = False  # True=直接提交待审批，False=计划中


class MeetingUpdate(BaseModel):
    title: str | None = None
    meeting_type: str | None = None
    location: str | None = None
    meeting_date: date | None = None
    representative_id: int | None = None
    attendees: list[str] | None = None
    attendees_count: int | None = None
    purpose: str | None = None
    budget: float | None = None
    status: str | None = None


class MeetingSummaryUpdate(BaseModel):
    summary: str


class CourseOut(OrmModel):
    id: int
    name: str
    description: str | None = None
    duration_minutes: int
    has_exam: bool
    is_compliance: bool
    pass_score: int
    content: str | None = None
    published_on: date | None = None
    is_active: bool
    learner_count: int = 0
    pass_rate: float | None = None
    question_count: int = 0


class CourseCreate(BaseModel):
    name: str
    description: str | None = None
    duration_minutes: int = 60
    has_exam: bool = True
    is_compliance: bool = False
    pass_score: int = 60
    content: str | None = None


class CourseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    duration_minutes: int | None = None
    has_exam: bool | None = None
    is_compliance: bool | None = None
    pass_score: int | None = None
    content: str | None = None
    is_active: bool | None = None


class QuestionOut(OrmModel):
    id: int
    course_id: int
    stem: str
    options: list[str]
    score: int
    sort_order: int
    # 答卷时不返回答案；管理端另接口可见
    answer: str | None = None


class QuestionCreate(BaseModel):
    stem: str
    options: list[str]
    answer: str
    score: int = 20
    sort_order: int = 0


class EnrollmentOut(OrmModel):
    id: int
    course_id: int
    representative_id: int
    status: str
    score: int | None = None
    max_score: int | None = None
    passed: bool | None = None
    learned_at: datetime | None = None
    examined_at: datetime | None = None
    course_name: str | None = None
    duration_minutes: int | None = None
    has_exam: bool | None = None
    is_compliance: bool | None = None
    rep_name: str | None = None


class ExamSubmit(BaseModel):
    answers: dict[str, str]  # question_id -> A/B/C/D


class ExamResultOut(BaseModel):
    enrollment_id: int
    score: int
    max_score: int
    passed: bool
    status: str
    filing_updated: int = 0


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

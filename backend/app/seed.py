from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models import (
    AcademicMeeting,
    Agent,
    ComplianceReport,
    Factory,
    FeeStandard,
    FilingStatus,
    MeetingStatus,
    Product,
    RepFiling,
    ReportStatus,
    Representative,
    ServiceProvider,
    User,
    UserRole,
    VisitRecord,
)


def seed_if_empty(db: Session) -> None:
    if db.query(User).first():
        return

    factories = [
        Factory(name="华东医药集团", region="华东"),
        Factory(name="华南生物制药", region="华南"),
        Factory(name="华北制药厂", region="华北"),
    ]
    db.add_all(factories)
    db.flush()

    products = [
        Product(name="弥可保", factory_id=factories[2].id, code="MKB"),
        Product(name="安博维", factory_id=factories[0].id, code="ABW"),
        Product(name="补达秀", factory_id=factories[1].id, code="BDX"),
    ]
    db.add_all(products)

    providers = [
        ServiceProvider(name="哈分", code="HF", region="华北", contact="赵经理", phone="13900001111"),
        ServiceProvider(name="京分", code="JF", region="华北", contact="钱经理", phone="13900002222"),
    ]
    db.add_all(providers)
    db.flush()

    agents = [
        Agent(
            name="华北区代理商",
            provider_id=providers[0].id,
            contact="张三",
            phone="13800138001",
            email="agent1@example.com",
            region="华北",
        ),
        Agent(
            name="北京康健医药代理",
            provider_id=providers[0].id,
            contact="李四",
            phone="13800138002",
            email="agent2@example.com",
            region="华北",
        ),
    ]
    db.add_all(agents)
    db.flush()

    reps_data = [
        ("杨明", "110101199001010002"),
        ("何秀英", "110101199001010004"),
        ("罗磊", "110101199001010007"),
        ("杨伟", "110101199001010009"),
        ("刘超", "110101199001010010"),
        ("刘娜", "110101199001010011"),
        ("孙娟", "110101199001010015"),
        ("林芳", "110101199001010016"),
        ("罗浩", "110101199001010099"),
    ]
    reps: list[Representative] = []
    for name, id_card in reps_data:
        reps.append(
            Representative(
                name=name,
                id_card=id_card,
                agent_id=agents[1].id if name != "罗浩" else agents[0].id,
                phone="13800000000",
            )
        )
    db.add_all(reps)
    db.flush()

    status_cycle = [
        FilingStatus.APPLIED_PENDING_EXAM.value,
        FilingStatus.EXAM_PASSED_PENDING_FILING.value,
        FilingStatus.EXAM_PASSED_PENDING_FILING.value,
        FilingStatus.REVOKED.value,
        FilingStatus.EXAM_PASSED_PENDING_FILING.value,
        FilingStatus.REVOKED.value,
        FilingStatus.REVOKED.value,
        FilingStatus.EXAM_PASSED_PENDING_FILING.value,
        FilingStatus.ACTIVE.value,
    ]
    factory_cycle = [0, 0, 1, 1, 0, 2, 1, 2, 2]
    for i, rep in enumerate(reps):
        db.add(
            RepFiling(
                representative_id=rep.id,
                factory_id=factories[factory_cycle[i]].id,
                provider_id=providers[0].id,
                agent_id=rep.agent_id,
                status=status_cycle[i],
                valid_from=date(2025, 8, 9) if i < 8 else date(2024, 1, 1),
                valid_to=date(2026, 11, 20) if i < 8 else date(2025, 12, 31),
            )
        )

    # 拜访统计（代理商视角汇总）
    for period, uploaded in [("2024-05", date(2024, 6, 5)), ("2024-06", date(2024, 7, 3))]:
        counts = [6, 5, 10, 9, 3, 10, 5, 3] if period == "2024-05" else [3, 4, 6, 2, 5, 2, 2, 2]
        for idx, count in enumerate(counts):
            db.add(
                VisitRecord(
                    representative_id=reps[idx].id,
                    provider_id=providers[0].id,
                    agent_id=reps[idx].agent_id,
                    period=period,
                    visit_count=count,
                    target_count=3,
                    uploaded_on=uploaded,
                )
            )

    for i in range(1, 16):
        kinds = ["学术研讨会", "产品推广会", "医生培训会", "科室交流会"]
        title = f"{kinds[(i - 1) % 4]}-华北区第{i}场"
        status = MeetingStatus.SUMMARY_PENDING.value if i <= 4 or i >= 9 else MeetingStatus.APPROVED.value
        db.add(
            AcademicMeeting(
                title=title,
                location="华北区会议中心",
                meeting_date=date(2025, 3, min(i, 28)),
                agent_id=agents[1].id,
                provider_id=providers[0].id,
                representative_id=reps[(i - 1) % 8].id,
                status=status,
                budget=8000 + i * 200,
            )
        )

    db.add(
        ComplianceReport(
            title="2024Q2 合规月报",
            agent_id=agents[1].id,
            provider_id=providers[0].id,
            period="2024-Q2",
            status=ReportStatus.SUBMITTED.value,
            content="本季度代表备案与拜访执行正常，会议总结待补齐。",
        )
    )

    db.add_all(
        [
            FeeStandard(name="市级学术会", category="会议", amount=15000, unit="场"),
            FeeStandard(name="科室会", category="会议", amount=3000, unit="场"),
            FeeStandard(name="讲者费上限", category="讲者", amount=2000, unit="人/场"),
        ]
    )

    users = [
        User(
            username="admin",
            password_hash=hash_password("demo123"),
            display_name="系统管理员",
            role=UserRole.ADMIN.value,
            email="admin@example.com",
        ),
        User(
            username="compliance",
            password_hash=hash_password("demo123"),
            display_name="合规专员",
            role=UserRole.COMPLIANCE.value,
        ),
        User(
            username="academy",
            password_hash=hash_password("demo123"),
            display_name="课程管理员",
            role=UserRole.ACADEMY.value,
        ),
        User(
            username="agent_huabei",
            password_hash=hash_password("demo123"),
            display_name="华北区代理商",
            role=UserRole.AGENT.value,
            agent_id=agents[1].id,
            phone="13800138001",
            email="agent1@example.com",
        ),
        User(
            username="rep_luohao",
            password_hash=hash_password("demo123"),
            display_name="罗浩",
            role=UserRole.REP.value,
            representative_id=reps[-1].id,
            agent_id=agents[0].id,
        ),
    ]
    db.add_all(users)
    db.commit()

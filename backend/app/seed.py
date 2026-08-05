from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models import (
    AcademicMeeting,
    Agent,
    ComplianceReport,
    Factory,
    FeeStandard,
    FilingStatus,
    Hospital,
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

RESOURCES = Path(__file__).resolve().parent.parent / "resources"


def _load_json(name: str):
    path = RESOURCES / name
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def sync_master_data(db: Session) -> dict:
    """从 resources 同步工厂/服务商/产品（幂等 upsert）。"""
    orgs = _load_json("organizations.json")
    providers = _load_json("service_providers.json")
    products = _load_json("products.json")

    factory_by_code: dict[str, Factory] = {}
    for item in orgs:
        code = str(item["code"])
        row = db.query(Factory).filter(Factory.code == code).first()
        if not row:
            row = db.query(Factory).filter(Factory.name == item["full_name"]).first()
        if not row:
            row = Factory(code=code, name=item["full_name"])
            db.add(row)
        row.code = code
        row.name = item["full_name"]
        row.short_name = item.get("short_name")
        row.is_active = True
        db.flush()
        factory_by_code[code] = row

    provider_by_name: dict[str, ServiceProvider] = {}
    for item in providers:
        row = (
            db.query(ServiceProvider)
            .filter(
                (ServiceProvider.code == item["code"])
                | (ServiceProvider.name == item["name"])
            )
            .first()
        )
        if not row:
            row = ServiceProvider(code=item["code"], name=item["name"])
            db.add(row)
        row.code = item["code"]
        row.name = item["name"]
        row.region = item.get("region")
        row.source = item.get("source")
        row.is_active = True
        db.flush()
        provider_by_name[row.name] = row

    product_count = 0
    for item in products:
        factory = factory_by_code.get(str(item["factory_code"]))
        if not factory:
            continue
        row = (
            db.query(Product)
            .filter(Product.code == item["code"])
            .first()
        )
        if not row:
            row = (
                db.query(Product)
                .filter(Product.name == item["name"], Product.factory_id == factory.id)
                .first()
            )
        if not row:
            row = Product(name=item["name"], factory_id=factory.id, code=item["code"])
            db.add(row)
        row.name = item["name"]
        row.code = item["code"]
        row.factory_id = factory.id
        row.source = item.get("source")
        row.is_active = True
        product_count += 1

    # 种子医院（少量，后续可批量导入 profile）
    sample_hospitals = [
        ("哈尔滨医科大学附属第一医院", "黑龙江省", "哈尔滨市", "三级甲等", None),
        ("中国医科大学附属第一医院", "辽宁省", "沈阳市", "三级甲等", None),
        ("天津医科大学总医院", "天津市", "天津市", "三级甲等", None),
        ("安徽医科大学第一附属医院", "安徽省", "合肥市", "三级甲等", None),
        ("北京协和医院", "北京市", "北京市", "三级甲等", None),
    ]
    hospital_count = 0
    for name, province, city, level, code in sample_hospitals:
        row = db.query(Hospital).filter(Hospital.name == name).first()
        if not row:
            db.add(
                Hospital(
                    name=name,
                    province=province,
                    city=city,
                    level=level,
                    terminal_code=code,
                )
            )
            hospital_count += 1

    db.commit()
    return {
        "factories": len(factory_by_code),
        "providers": len(provider_by_name),
        "products": product_count,
        "hospitals_added": hospital_count,
    }


def seed_demo_if_empty(db: Session) -> None:
    """仅在无用户时写入演示业务数据（代理商/代表/备案等）。"""
    if db.query(User).first():
        return

    sync_master_data(db)

    providers = {
        p.name: p for p in db.query(ServiceProvider).order_by(ServiceProvider.id).all()
    }
    factories = {f.code: f for f in db.query(Factory).all() if f.code}

    # 演示代理商：挂在真实服务商下（CSO 代理商公司无现成主数据表）
    agent_specs = [
        ("华北康健医药代理", "大连博道", "张三", "13800138001", "agent_huabei", "华北"),
        ("京津安博推广服务", "天津博达", "李四", "13800138002", "agent_jingjin", "华北"),
        ("安徽普德推广中心", "安徽博鑫", "王五", "13800138003", "agent_anhui", "华东"),
        ("北京塞升合作代理", "北京塞升", "赵六", "13800138004", "agent_beijing", "华北"),
    ]
    agents: list[Agent] = []
    for name, provider_name, contact, phone, username, region in agent_specs:
        provider = providers[provider_name]
        agent = Agent(
            name=name,
            provider_id=provider.id,
            contact=contact,
            phone=phone,
            email=f"{username}@example.com",
            region=region,
        )
        db.add(agent)
        db.flush()
        agents.append(agent)
        db.add(
            User(
                username=username,
                password_hash=hash_password("demo123"),
                display_name=name,
                role=UserRole.AGENT.value,
                agent_id=agent.id,
                phone=phone,
                email=f"{username}@example.com",
            )
        )

    primary = agents[0]  # 大连博道下
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
        agent = primary if name != "罗浩" else agents[0]
        reps.append(
            Representative(
                name=name,
                id_card=id_card,
                agent_id=agent.id,
                phone="13800000000",
            )
        )
    db.add_all(reps)
    db.flush()

    factory_codes = ["10502", "104", "114", "100", "103"]
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
    for i, rep in enumerate(reps):
        fcode = factory_codes[i % len(factory_codes)]
        factory = factories[fcode]
        # 按工厂映射选服务商：优先代理商所属服务商
        provider_id = rep.agent.provider_id
        db.add(
            RepFiling(
                representative_id=rep.id,
                factory_id=factory.id,
                provider_id=provider_id,
                agent_id=rep.agent_id,
                status=status_cycle[i],
                valid_from=date(2025, 8, 9) if i < 8 else date(2024, 1, 1),
                valid_to=date(2026, 11, 20) if i < 8 else date(2025, 12, 31),
            )
        )

    for period, uploaded in [("2024-05", date(2024, 6, 5)), ("2024-06", date(2024, 7, 3))]:
        counts = [6, 5, 10, 9, 3, 10, 5, 3] if period == "2024-05" else [3, 4, 6, 2, 5, 2, 2, 2]
        for idx, count in enumerate(counts):
            db.add(
                VisitRecord(
                    representative_id=reps[idx].id,
                    provider_id=reps[idx].agent.provider_id,
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
        status = (
            MeetingStatus.SUMMARY_PENDING.value
            if i <= 4 or i >= 9
            else MeetingStatus.APPROVED.value
        )
        db.add(
            AcademicMeeting(
                title=title,
                location="华北区会议中心",
                meeting_date=date(2025, 3, min(i, 28)),
                agent_id=primary.id,
                provider_id=primary.provider_id,
                representative_id=reps[(i - 1) % 8].id,
                status=status,
                budget=8000 + i * 200,
            )
        )

    db.add(
        ComplianceReport(
            title="2024Q2 合规月报",
            agent_id=primary.id,
            provider_id=primary.provider_id,
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

    db.add_all(
        [
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
                username="rep_luohao",
                password_hash=hash_password("demo123"),
                display_name="罗浩",
                role=UserRole.REP.value,
                representative_id=reps[-1].id,
                agent_id=reps[-1].agent_id,
            ),
        ]
    )
    db.commit()


def seed_if_empty(db: Session) -> None:
    """兼容旧入口：先同步主数据，再按需灌演示数据。"""
    sync_master_data(db)
    seed_demo_if_empty(db)

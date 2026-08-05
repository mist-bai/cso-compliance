from __future__ import annotations

import json
from datetime import date
from pathlib import Path

# json used for meeting attendees & exam options

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models import (
    AcademicMeeting,
    Agent,
    ComplianceReport,
    Course,
    CourseEnrollment,
    CourseProgressStatus,
    ExamQuestion,
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
        # 罗浩：便于演示「备案考试通过 → 考试通过待备案」
        FilingStatus.APPLIED_PENDING_EXAM.value,
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

    locations = [
        "上海世博展览馆",
        "成都世纪城会议中心",
        "北京国际会议中心",
        "广州白云国际会议中心",
        "深圳会展中心",
    ]
    for i in range(1, 16):
        kinds = ["学术研讨会", "产品推广会", "医生培训会", "科室交流会"]
        kind = kinds[(i - 1) % 4]
        title = f"{kind}-华北区第{i}场"
        if i in {6, 7, 8, 14}:
            status = MeetingStatus.PLANNING.value
        elif i in {1, 3, 13}:
            status = MeetingStatus.APPROVED.value
        elif i == 2:
            status = MeetingStatus.PENDING.value
        else:
            status = MeetingStatus.CLOSED.value
        attendees = [reps[(i + j) % 8].name for j in range(3 + (i % 4))]
        db.add(
            AcademicMeeting(
                title=title,
                meeting_type=kind,
                location=locations[(i - 1) % len(locations)],
                meeting_date=date(2025, 3, min(i, 28)),
                agent_id=primary.id,
                provider_id=primary.provider_id,
                representative_id=reps[(i - 1) % 8].id,
                attendees_count=len(attendees),
                attendees_json=json.dumps(attendees, ensure_ascii=False),
                purpose=f"{kind}合规备案申请",
                status=status,
                budget=8000 + i * 200,
                summary="会议顺利召开，材料齐备。" if status == MeetingStatus.CLOSED.value else None,
            )
        )

    # 培训课程 + 备案考试题
    course_specs = [
        ("药品合规销售规范培训", 120, True, True, "覆盖推广行为红线、拜访合规与费用标准。"),
        ("抗生素合理使用指南", 90, True, False, "抗菌药物临床合理使用要点。"),
        ("学术会议组织与管理", 60, False, False, "学术会议申请、执行与总结规范。"),
        ("患者隐私保护与数据安全", 45, True, False, "患者信息与数据安全管理。"),
        ("新产品知识培训-心血管系列", 150, True, False, "心血管产品知识与学术推广要点。"),
    ]
    courses: list[Course] = []
    for name, mins, has_exam, is_compliance, desc in course_specs:
        c = Course(
            name=name,
            description=desc,
            duration_minutes=mins,
            has_exam=has_exam,
            is_compliance=is_compliance,
            pass_score=60,
            content=f"《{name}》学习材料（演示）。\n1. 政策背景\n2. 操作要点\n3. 案例警示",
            published_on=date(2024, 1, 15),
        )
        db.add(c)
        db.flush()
        courses.append(c)

    compliance = courses[0]
    questions = [
        ("推广活动中，以下哪项属于合规要求？", ["可给予处方回扣", "如实记录拜访与费用", "伪造会议签到", "超标准宴请"], "B"),
        ("代表备案考试未通过时，正确处理是？", ["继续开展推广", "暂停备案流程并补考", "由代理商代签", "忽略考试要求"], "B"),
        ("学术会议费用申请应基于？", ["口头约定", "费用标准与审批流程", "个人垫付即可", "无需留存票据"], "B"),
        ("拜访数据应由谁提交？", ["代理商代填即可", "代表本人如实提交", "医院工作人员", "无需提交"], "B"),
        ("发现潜在合规风险时应？", ["隐瞒不报", "及时上报并停止违规行为", "事后补材料即可", "仅口头说明"], "B"),
    ]
    for idx, (stem, options, answer) in enumerate(questions):
        db.add(
            ExamQuestion(
                course_id=compliance.id,
                stem=stem,
                options_json=json.dumps(options, ensure_ascii=False),
                answer=answer,
                score=20,
                sort_order=idx + 1,
            )
        )
    # 第二门课也给少量题
    for idx, (stem, options, answer) in enumerate(questions[:3]):
        db.add(
            ExamQuestion(
                course_id=courses[1].id,
                stem=stem,
                options_json=json.dumps(options, ensure_ascii=False),
                answer=answer,
                score=20,
                sort_order=idx + 1,
            )
        )

    # 给罗浩分配待学课程；部分代表已完成
    for course in courses[:4]:
        db.add(
            CourseEnrollment(
                course_id=course.id,
                representative_id=reps[-1].id,  # 罗浩
                status=CourseProgressStatus.NOT_STARTED.value
                if course.is_compliance
                else CourseProgressStatus.LEARNING.value,
            )
        )
    db.add(
        CourseEnrollment(
            course_id=courses[2].id,
            representative_id=reps[0].id,
            status=CourseProgressStatus.COMPLETED.value,
            passed=True,
            score=100,
            max_score=100,
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

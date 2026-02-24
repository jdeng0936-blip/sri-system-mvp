"""
数据库初始化种子 — seed.py
============================
注入 Demo 账号 + 作战项目 + 关键人到数据库，供前端联调使用。
用法: python3 seed.py
"""

from db import SessionLocal, init_db
from models import (
    User, UserRole,
    Project, ProjectStage, ProjectApproval,
    BudgetStatus, CompetitivePosition,
    Stakeholder, StakeholderAttitude,
)
from utils.security import hash_password

DEMO_USERS = [
    {
        "name": "管理员",
        "phone": "admin",
        "password": "123",
        "role": UserRole.ADMIN,
        "dept": "总部",
    },
    {
        "name": "王VP",
        "phone": "vp001",
        "password": "123",
        "role": UserRole.VP,
        "dept": "总部",
    },
    {
        "name": "李总监",
        "phone": "director001",
        "password": "123",
        "role": UserRole.DIRECTOR,
        "dept": "华东战区",
    },
    {
        "name": "张伟",
        "phone": "sales001",
        "password": "123",
        "role": UserRole.SALES,
        "dept": "华东战区",
    },
    {
        "name": "赵技术",
        "phone": "tech001",
        "password": "123",
        "role": UserRole.TECH,
        "dept": "华东战区",
    },
    {
        "name": "钱财务",
        "phone": "finance001",
        "password": "123",
        "role": UserRole.FINANCE,
        "dept": "总部",
    },
]

# ── 作战项目种子 ──
DEMO_PROJECTS = [
    {
        "name": "万华化学-烟台二期冷站改造",
        "client": "万华化学集团",
        "project_title": "烟台工业园二期冷站升级改造",
        "design_institute": "山东省化工规划设计院",
        "general_contractor": "中国化学工程第十六建设有限公司",
        "dept": "华东战区",
        "applicant_name": "张伟",
        "stage": ProjectStage.NEGOTIATION,
        "approval_status": ProjectApproval.APPROVED,
        "budget_status": BudgetStatus.FULLY_APPROVED,
        "competitive_position": CompetitivePosition.LEADING,
        "estimated_amount": 1280.0,
        "meddic_metrics": 75,
        "meddic_economic_buyer": 60,
        "meddic_decision_criteria": 85,
        "meddic_decision_process": 55,
        "meddic_identify_pain": 90,
        "meddic_champion": 70,
        "meddic_relationship": 65,
        "win_rate": 72.0,
    },
    {
        "name": "东风汽车-武汉涂装车间项目",
        "client": "东风汽车集团有限公司",
        "project_title": "武汉经开区涂装车间空调系统",
        "design_institute": "武汉市市政建筑设计研究院",
        "general_contractor": "中建三局集团有限公司",
        "dept": "华东战区",
        "applicant_name": "张伟",
        "stage": ProjectStage.PROPOSAL,
        "approval_status": ProjectApproval.PENDING,
        "budget_status": BudgetStatus.PARTIAL,
        "competitive_position": CompetitivePosition.PARALLEL,
        "estimated_amount": 860.0,
        "meddic_metrics": 50,
        "meddic_economic_buyer": 40,
        "meddic_decision_criteria": 60,
        "meddic_decision_process": 35,
        "meddic_identify_pain": 70,
        "meddic_champion": 30,
        "meddic_relationship": 45,
        "win_rate": 47.0,
    },
    {
        "name": "宁德时代-溧阳电池基地扩建",
        "client": "宁德时代新能源科技",
        "project_title": "溧阳基地三期洁净空调",
        "design_institute": "中国电子工程设计院",
        "general_contractor": "中国建筑第五工程局",
        "dept": "华东战区",
        "applicant_name": "张伟",
        "stage": ProjectStage.INITIAL_CONTACT,
        "approval_status": ProjectApproval.APPROVED,
        "budget_status": BudgetStatus.APPLYING,
        "competitive_position": CompetitivePosition.TRAILING,
        "estimated_amount": 2150.0,
        "meddic_metrics": 30,
        "meddic_economic_buyer": 20,
        "meddic_decision_criteria": 40,
        "meddic_decision_process": 25,
        "meddic_identify_pain": 55,
        "meddic_champion": 15,
        "meddic_relationship": 30,
        "win_rate": 31.0,
    },
]

# ── 关键人种子 (project_index → stakeholders) ──
DEMO_STAKEHOLDERS = {
    0: [  # 万华化学
        {
            "name": "王建国",
            "title": "采购总监",
            "role_tags": "决策者",
            "attitude": StakeholderAttitude.SUPPORT,
            "influence_weight": 9,
            "reports_to": "集团副总裁",
            "phone": "138****1001",
            "notes": "老客户关系，上一期项目合作过",
        },
        {
            "name": "李明辉",
            "title": "电气科长",
            "role_tags": "评估者/技术审查",
            "attitude": StakeholderAttitude.SUPPORT,
            "influence_weight": 7,
            "reports_to": "王建国",
            "phone": "139****2002",
            "notes": "技术路线倾向我方",
        },
        {
            "name": "张大鹏",
            "title": "财务副总裁",
            "role_tags": "影响者/顾问",
            "attitude": StakeholderAttitude.NEUTRAL,
            "influence_weight": 8,
            "reports_to": "CEO",
            "phone": "137****3003",
            "notes": "关注性价比，需重点突破",
        },
        {
            "name": "赵芳",
            "title": "设备运维主管",
            "role_tags": "使用者/操作层",
            "attitude": StakeholderAttitude.SUPPORT,
            "influence_weight": 5,
            "reports_to": "李明辉",
            "phone": "136****4004",
            "notes": "一线使用反馈正面",
        },
    ],
    1: [  # 东风汽车
        {
            "name": "陈东风",
            "title": "基建处处长",
            "role_tags": "决策者",
            "attitude": StakeholderAttitude.NEUTRAL,
            "influence_weight": 9,
            "reports_to": "分管副总经理",
            "phone": "135****5005",
            "notes": "与大金有历史合作关系，需破局",
        },
        {
            "name": "孙立伟",
            "title": "涂装工艺工程师",
            "role_tags": "评估者/技术审查",
            "attitude": StakeholderAttitude.OPPOSE,
            "influence_weight": 6,
            "reports_to": "陈东风",
            "phone": "134****6006",
            "notes": "倾向日系品牌，需技术说服",
        },
        {
            "name": "刘慧",
            "title": "采购经理",
            "role_tags": "把关者/采购",
            "attitude": StakeholderAttitude.NEUTRAL,
            "influence_weight": 7,
            "reports_to": "陈东风",
            "phone": "133****7007",
            "notes": "价格敏感，需提供阶梯报价",
        },
    ],
    2: [  # 宁德时代
        {
            "name": "黄伟明",
            "title": "基建部总经理",
            "role_tags": "决策者",
            "attitude": StakeholderAttitude.NEUTRAL,
            "influence_weight": 10,
            "reports_to": "执行副总裁",
            "phone": "132****8008",
            "notes": "决策层，尚未建立直接联系",
        },
        {
            "name": "周小玲",
            "title": "暖通设计主管",
            "role_tags": "评估者/技术审查",
            "attitude": StakeholderAttitude.SUPPORT,
            "influence_weight": 6,
            "reports_to": "黄伟明",
            "phone": "131****9009",
            "notes": "技术沟通积极，可培养为教练",
        },
    ],
}


def seed():
    # 确保表已创建
    init_db()

    db = SessionLocal()
    try:
        # ── 1. 注入用户 ──
        created_users = 0
        sales_user = None
        for u in DEMO_USERS:
            existing = db.query(User).filter(User.phone == u["phone"]).first()
            if existing:
                print(f"  ⏭️  [{u['phone']}] 已存在，跳过")
                if u["phone"] == "sales001":
                    sales_user = existing
                continue

            user = User(
                name=u["name"],
                phone=u["phone"],
                password_hash=hash_password(u["password"]),
                role=u["role"],
                dept=u["dept"],
            )
            db.add(user)
            db.flush()  # 获取 ID
            created_users += 1
            print(f"  ✅  [{u['phone']}] {u['name']} ({u['role'].value}) → 创建成功")
            if u["phone"] == "sales001":
                sales_user = user

        db.commit()
        print(f"\n🎉 用户 Seed 完成: 新增 {created_users} 个，共 {len(DEMO_USERS)} 个 Demo 账号。\n")

        # ── 2. 注入作战项目 ──
        created_projects = 0
        project_objs = []
        for p in DEMO_PROJECTS:
            existing = db.query(Project).filter(Project.name == p["name"]).first()
            if existing:
                print(f"  ⏭️  项目 [{p['name']}] 已存在，跳过")
                project_objs.append(existing)
                continue

            project = Project(
                name=p["name"],
                client=p["client"],
                project_title=p["project_title"],
                design_institute=p["design_institute"],
                general_contractor=p["general_contractor"],
                owner_id=sales_user.id if sales_user else None,
                dept=p["dept"],
                applicant_name=p["applicant_name"],
                stage=p["stage"],
                approval_status=p["approval_status"],
                budget_status=p["budget_status"],
                competitive_position=p["competitive_position"],
                estimated_amount=p["estimated_amount"],
                meddic_metrics=p["meddic_metrics"],
                meddic_economic_buyer=p["meddic_economic_buyer"],
                meddic_decision_criteria=p["meddic_decision_criteria"],
                meddic_decision_process=p["meddic_decision_process"],
                meddic_identify_pain=p["meddic_identify_pain"],
                meddic_champion=p["meddic_champion"],
                meddic_relationship=p["meddic_relationship"],
                win_rate=p["win_rate"],
            )
            db.add(project)
            db.flush()
            project_objs.append(project)
            created_projects += 1
            print(f"  ✅  项目 [{p['name']}] id={project.id} → 创建成功")

        db.commit()
        print(f"\n🎉 项目 Seed 完成: 新增 {created_projects} 个，共 {len(DEMO_PROJECTS)} 个作战项目。\n")

        # ── 3. 注入关键人 ──
        created_stakeholders = 0
        for proj_idx, stakeholders in DEMO_STAKEHOLDERS.items():
            project = project_objs[proj_idx]
            for s in stakeholders:
                existing = (
                    db.query(Stakeholder)
                    .filter(
                        Stakeholder.project_id == project.id,
                        Stakeholder.name == s["name"],
                    )
                    .first()
                )
                if existing:
                    print(f"  ⏭️  关键人 [{s['name']}] 已存在，跳过")
                    continue

                sh = Stakeholder(
                    project_id=project.id,
                    name=s["name"],
                    title=s["title"],
                    role_tags=s["role_tags"],
                    attitude=s["attitude"],
                    influence_weight=s["influence_weight"],
                    reports_to=s["reports_to"],
                    phone=s["phone"],
                    notes=s["notes"],
                )
                db.add(sh)
                created_stakeholders += 1
                print(
                    f"  ✅  关键人 [{s['name']}] → 项目 [{project.name}] "
                    f"({s['attitude'].value}, w={s['influence_weight']})"
                )

        db.commit()
        print(f"\n🎉 关键人 Seed 完成: 新增 {created_stakeholders} 人。")
        print(f"\n{'='*50}")
        print(f"📊 数据库总览：")
        print(f"   用户: {db.query(User).count()}")
        print(f"   项目: {db.query(Project).count()}")
        print(f"   关键人: {db.query(Stakeholder).count()}")
        print(f"{'='*50}")

    finally:
        db.close()


if __name__ == "__main__":
    seed()

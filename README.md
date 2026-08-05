# 代理商合规管理系统（CSO）

基于秒悟原型 [代理商合规管理系统](https://mimk44rm0t03.meoo.pub) 落地开发。  
技术栈：Next.js 14 + FastAPI + MySQL 8 / SQLite + Docker Compose。

**完整能力说明见：[docs/功能清单.md](docs/功能清单.md)**

## 本地启动

```bash
# 方式 A：Docker
cp .env.example .env
docker compose up -d --build

# 方式 B：无 Docker（SQLite）
cd backend && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL='sqlite:///./cso.db' SECRET_KEY='dev-local' uvicorn app.main:app --host 127.0.0.1 --port 8200 --reload
# 另开终端
cd frontend && npm i && BACKEND_INTERNAL_URL=http://127.0.0.1:8200 npm run dev
```

| 服务 | 地址 |
|------|------|
| 前端门户 | http://localhost:3200 |
| 后端 API | http://localhost:8200 |
| API 文档 | http://localhost:8200/docs |
| MySQL（Docker） | localhost:3307 |

## 演示账号（密码均为 `demo123`）

| 角色 | 用户名 |
|------|--------|
| 代理商（大连博道） | `agent_huabei` |
| 代理商（天津博达） | `agent_jingjin` |
| 代理商（安徽博鑫） | `agent_anhui` |
| 代表 | `rep_luohao` |
| 合规看板 | `compliance` |
| 后台管理 | `admin` |
| 课程管理 | `academy` |

## 当前可实现功能（摘要）

| 模块 | 能力 |
|------|------|
| 备案 | 申请、开号、编辑、状态机推进、备案考试自动推进 |
| 拜访 | 代表选医院提交、月度汇总、代理商下钻明细 |
| 会议 | 申请/修改/审批/驳回/总结；费用标准带出预算 |
| 培训 | 课程编辑、题目维护、学习考试、培训明细 |
| 报告 | 提交、详情、驳回、重新提交 |
| 看板 | 图表 + 四类明细；服务商季度筛选；待培训真实统计 |
| 后台 | 代理商/服务商/代表启停、产品/医院/费用、主数据同步 |

## 门户路径

- `/` 角色选择 · `/agent` 代理商 · `/rep` 代表  
- `/dashboard` 合规看板 · `/admin` 后台 · `/courses` 课程管理

## 目录

```
backend/app/          FastAPI
backend/resources/    主数据 JSON
frontend/             Next.js
docs/                 功能清单、原型对照、主数据说明
```

## GitHub

https://github.com/mist-bai/cso-compliance

## 说明

- **主数据**：工厂/服务商/产品/医院抽样已接入；后台可「同步真实主数据」
- **RAG**：本期不做
- **备案考试演示**：`rep_luohao` →「备案考试」→ 选项全选 **B**

# 代理商合规管理系统（CSO）

基于秒悟原型 [代理商合规管理系统](https://mimk44rm0t03.meoo.pub) 落地开发。  
技术栈参考 `marketing-platform`：Next.js 14 + FastAPI + MySQL 8 + Docker Compose。

## 本地启动

```bash
cp .env.example .env   # 已有 .env 可跳过
docker compose up -d --build
```

| 服务 | 地址 |
|------|------|
| 前端门户 | http://localhost:3200 |
| 后端 API | http://localhost:8200 |
| API 文档 | http://localhost:8200/docs |
| MySQL | localhost:3307 |

首次启动后端会自动建表并写入演示账号/种子数据。

### 演示账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 代理商 | agent_huabei | demo123 |
| 代表 | rep_luohao | demo123 |
| 合规看板 | compliance | demo123 |
| 后台管理 | admin | demo123 |
| 课程管理 | academy | demo123 |

## 门户入口

- `/` 角色选择
- `/agent` 代理商入口
- `/rep` 代表入口
- `/dashboard` 合规看板
- `/admin` 后台管理
- `/courses` 课程管理（占位，后续可对接誉学院）

## 目录

```
backend/app/     FastAPI 应用
frontend/        Next.js 前端
docs/            设计与对照说明
```

## GitHub 远程

本机暂未安装 `gh`。在 GitHub 创建空仓库后：

```bash
git remote add origin git@github.com:<你的账号>/cso-compliance.git
git push -u origin master
```

## 当前阶段

Phase 0–1：脚手架、五入口、登录鉴权、主数据与代表备案状态机（本地可演示）。

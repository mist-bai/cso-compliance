# 主数据与 RAG 说明

## 结论

| 能力 | MVP 是否需要 | 说明 |
|------|--------------|------|
| **结构化主数据** | **需要** | 工厂/服务商/产品/代表/医院是备案、拜访、会议的底座 |
| **RAG / 向量库** | **暂不需要** | 留给培训考试出题、制度问答、自然语言问数 |

问数项目（`marketing-ai-test`）的 Qdrant 实体索引适合「医院/产品名称解析」，不是合规备案主流程必需。

## 本系统主数据来源

| 实体 | 来源 | 落盘文件 |
|------|------|----------|
| 工厂（法人工厂） | 问数 `resources/organizations.json`（12 家） | `backend/resources/organizations.json` |
| 服务商 | `oracle_bridge.ORG_MAP` + BI `MAT_YWGS`（大连博道/天津博达/安徽博鑫/北京塞升） | `backend/resources/service_providers.json` |
| 产品大类 | marketing-platform `visit_call_type` + 常用品种 | `backend/resources/products.json` |
| 工厂↔服务商 | `ORG_MAP` | `backend/resources/factory_provider_map.json` |
| CSO 代理商公司 | **无现成表**（`sg_baseinfo_agent` 是内部医药代表） | 业务新建/演示账号 |
| 医院终端 | `sg_baseinfo_hospital` / `marketing_hospital_profile` | 后续按需导入（量大） |

## 命名注意

- marketing-platform 的 `agents` = **内部医药代表**，≠ CSO「代理商公司」
- 原型里的「哈分」对应真实数据中的 **服务商**（如大连博道）
- `customer`（问数维度）= 医院/终端，≠ 法人组织

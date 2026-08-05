"use client";

import { FormEvent, useEffect, useState } from "react";
import AppShell, { StatusBadge } from "@/components/AppShell";
import { api } from "@/lib/api";

type Agent = {
  id: number;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  provider_name?: string;
  created_at?: string;
};

type Provider = {
  id: number;
  name: string;
  code?: string;
  region?: string;
  contact?: string;
  phone?: string;
  source?: string;
};
type Factory = { id: number; code?: string; name: string; short_name?: string };
type Product = {
  id: number;
  name: string;
  factory_name?: string;
  factory_short_name?: string;
  code?: string;
  source?: string;
};
type Hospital = {
  id: number;
  name: string;
  province?: string;
  city?: string;
  level?: string;
  terminal_code?: string;
};
type Fee = { id: number; name: string; category: string; amount: number; unit: string };
type Report = { id: number; title: string; period: string; status: string };
type Meeting = { id: number; title: string; status: string; budget?: number };

const tabs = [
  { key: "agents", label: "代理商管理" },
  { key: "providers", label: "服务商管理" },
  { key: "reps", label: "代表管理" },
  { key: "factories", label: "工厂管理" },
  { key: "products", label: "产品管理" },
  { key: "hospitals", label: "医院终端" },
  { key: "fees", label: "费用标准" },
  { key: "reports", label: "报告管理" },
  { key: "approvals", label: "审批管理" },
];

export default function AdminPage() {
  const [tab, setTab] = useState("agents");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filings, setFilings] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [syncMsg, setSyncMsg] = useState("");

  async function load() {
    try {
      const [a, p, fac, pr, h, f, r, m, fi] = await Promise.all([
        api<Agent[]>("/api/agents"),
        api<Provider[]>("/api/providers"),
        api<Factory[]>("/api/factories"),
        api<Product[]>("/api/products"),
        api<Hospital[]>("/api/hospitals"),
        api<Fee[]>("/api/fees"),
        api<Report[]>("/api/reports"),
        api<Meeting[]>("/api/meetings"),
        api<any[]>("/api/filings"),
      ]);
      setAgents(a);
      setProviders(p);
      setFactories(fac);
      setProducts(pr);
      setHospitals(h);
      setFees(f);
      setReports(r);
      setMeetings(m);
      setFilings(fi);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }

  const [hospitalQ, setHospitalQ] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showHospitalForm, setShowHospitalForm] = useState(false);

  async function syncMaster() {
    try {
      const res = await api<{ result: Record<string, number> }>("/api/master/sync", {
        method: "POST",
      });
      setSyncMsg(
        `已同步：工厂 ${res.result.factories} / 服务商 ${res.result.providers} / 产品 ${res.result.products} / 医院 ${res.result.hospitals ?? 0}（新增 ${res.result.hospitals_added ?? 0}）`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "同步失败");
    }
  }

  async function createHospital(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/hospitals", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        province: fd.get("province") || null,
        city: fd.get("city") || null,
        level: fd.get("level") || null,
        terminal_code: fd.get("terminal_code") || null,
      }),
    });
    setShowHospitalForm(false);
    await load();
  }

  async function bulkImportHospitals() {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const items = lines.map((line) => {
      const [name, province, city, level, terminal_code] = line.split(/[,，\t]/).map((s) => s.trim());
      return { name, province, city, level, terminal_code };
    }).filter((i) => i.name);
    if (!items.length) {
      setError("请粘贴至少一行：医院名,省,市,等级,终端编码");
      return;
    }
    const res = await api<{ added: number; updated: number }>("/api/hospitals/bulk", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    setSyncMsg(`医院导入完成：新增 ${res.added} / 更新 ${res.updated}`);
    setBulkText("");
    await load();
  }

  async function toggleAgent(id: number, is_active: boolean) {
    await api(`/api/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    });
    await load();
  }

  async function createFee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/fees", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        category: fd.get("category") || "会议",
        amount: Number(fd.get("amount") || 0),
        unit: fd.get("unit") || "场",
      }),
    });
    e.currentTarget.reset();
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  async function createAgent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/agents", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        provider_id: Number(fd.get("provider_id")),
        contact: fd.get("contact"),
        phone: fd.get("phone"),
        email: fd.get("email"),
        username: fd.get("username"),
        password: "demo123",
      }),
    });
    e.currentTarget.reset();
    await load();
  }

  async function approveMeeting(id: number) {
    await api(`/api/meetings/${id}/approve`, { method: "POST" });
    await load();
  }

  async function approveReport(id: number) {
    await api(`/api/reports/${id}/approve`, { method: "POST" });
    await load();
  }

  async function advanceFiling(id: number, status: string) {
    await api(`/api/filings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <AppShell
      title="后台管理"
      subtitle="后台管理"
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      requiredRoles={["admin"]}
      rightSlot={
        <button className="cso-btn-secondary" onClick={syncMaster}>
          同步真实主数据
        </button>
      }
    >
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
      {syncMsg && <p className="mb-4 text-sm text-emerald-700">{syncMsg}</p>}

      {tab === "agents" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <form className="cso-card space-y-3 p-5 lg:col-span-1" onSubmit={createAgent}>
            <h2 className="font-semibold">新增代理商</h2>
            <input className="cso-input" name="name" placeholder="代理商名称" required />
            <select className="cso-input" name="provider_id" required>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input className="cso-input" name="username" placeholder="登录账号" required />
            <input className="cso-input" name="contact" placeholder="联系人" />
            <input className="cso-input" name="phone" placeholder="电话" />
            <input className="cso-input" name="email" placeholder="邮箱" />
            <button className="cso-btn-primary">保存（默认密码 demo123）</button>
          </form>
          <div className="cso-card overflow-x-auto p-5 lg:col-span-2">
            <h2 className="cso-page-title mb-1">代理商账号管理</h2>
            <table className="cso-table">
              <thead>
                <tr>
                  <th>代理商名称</th>
                  <th>服务商</th>
                  <th>联系人</th>
                  <th>电话</th>
                  <th>邮箱</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.provider_name}</td>
                    <td>{a.contact}</td>
                    <td>{a.phone}</td>
                    <td>{a.email}</td>
                    <td>
                      <StatusBadge status={a.is_active ? "启用" : "停用"} />
                    </td>
                    <td>
                      <button
                        className="cso-btn-secondary h-8"
                        onClick={() => toggleAgent(a.id, !a.is_active)}
                      >
                        {a.is_active ? "停用" : "启用"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "providers" && (
        <section className="cso-card p-6">
          <h2 className="cso-page-title mb-1">服务商管理</h2>
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">
            来源：oracle_bridge.ORG_MAP + BI 发薪机构 MAT_YWGS（大连博道/天津博达/安徽博鑫/北京塞升）
          </p>
          <table className="cso-table">
            <thead>
              <tr>
                <th>编码</th>
                <th>名称</th>
                <th>区域</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} >
                  <td>{p.code}</td>
                  <td>{p.name}</td>
                  <td>{p.region}</td>
                  <td className="px-2 py-2.5 text-xs text-[var(--muted-foreground)]">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "factories" && (
        <section className="cso-card p-6">
          <h2 className="cso-page-title mb-1">工厂管理（法人组织）</h2>
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">
            来源：营销信息推送问数 organizations.json（12 家）
          </p>
          <table className="cso-table">
            <thead>
              <tr>
                <th>编码</th>
                <th>简称</th>
                <th>全称</th>
              </tr>
            </thead>
            <tbody>
              {factories.map((f) => (
                <tr key={f.id} >
                  <td>{f.code}</td>
                  <td>{f.short_name}</td>
                  <td>{f.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "hospitals" && (
        <div className="space-y-4">
          <section className="cso-card p-6">
            <div className="cso-section-head">
              <div>
                <h2 className="cso-page-title">医院终端</h2>
                <p className="cso-page-desc mt-1">
                  可同步 resources/hospitals.json（终端主数据抽样），或粘贴 CSV 批量导入
                </p>
              </div>
              <div className="flex gap-2">
                <button className="cso-btn-secondary" onClick={syncMaster}>
                  同步主数据医院
                </button>
                <button className="cso-btn-primary" onClick={() => setShowHospitalForm(true)}>
                  新增医院
                </button>
              </div>
            </div>
            <div className="cso-toolbar">
              <input
                className="cso-input max-w-xs"
                placeholder="搜索医院名称..."
                value={hospitalQ}
                onChange={(e) => setHospitalQ(e.target.value)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="cso-table">
                <thead>
                  <tr>
                    <th>终端编码</th>
                    <th>医院</th>
                    <th>省</th>
                    <th>市</th>
                    <th>等级</th>
                  </tr>
                </thead>
                <tbody>
                  {hospitals
                    .filter((h) => !hospitalQ || h.name.includes(hospitalQ))
                    .map((h) => (
                      <tr key={h.id}>
                        <td>{h.terminal_code || "-"}</td>
                        <td>{h.name}</td>
                        <td>{h.province}</td>
                        <td>{h.city}</td>
                        <td>{h.level}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="cso-card space-y-3 p-6">
            <h3 className="cso-page-title">批量导入</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              每行：医院名,省,市,等级,终端编码（逗号或 Tab 分隔）
            </p>
            <textarea
              className="cso-input min-h-28 py-2 font-mono text-xs"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"莱西市第三人民医院,山东省,青岛市,三级,HB0037872"}
            />
            <button className="cso-btn-primary" onClick={bulkImportHospitals}>
              导入
            </button>
          </section>
          {showHospitalForm && (
            <div className="cso-modal-mask" onClick={() => setShowHospitalForm(false)}>
              <form
                className="cso-card w-full max-w-lg space-y-3 p-6"
                onClick={(e) => e.stopPropagation()}
                onSubmit={createHospital}
              >
                <h3 className="cso-page-title">新增医院</h3>
                <input className="cso-input" name="name" placeholder="医院名称" required />
                <input className="cso-input" name="province" placeholder="省" />
                <input className="cso-input" name="city" placeholder="市" />
                <input className="cso-input" name="level" placeholder="等级" />
                <input className="cso-input" name="terminal_code" placeholder="终端编码" />
                <div className="flex justify-end gap-2">
                  <button type="button" className="cso-btn-secondary" onClick={() => setShowHospitalForm(false)}>
                    取消
                  </button>
                  <button className="cso-btn-primary">保存</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {tab === "reps" && (
        <section className="cso-card p-6">
          <h2 className="cso-page-title mb-1">代表备案管理</h2>
          <table className="cso-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>代理商</th>
                <th>工厂</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filings.map((f) => (
                <tr key={f.id} >
                  <td>{f.rep_name}</td>
                  <td>{f.agent_name}</td>
                  <td>{f.factory_name}</td>
                  <td>
                    <StatusBadge status={f.status} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {f.status === "已申请待考试" && (
                        <button
                          className="cso-btn-secondary"
                          onClick={() => advanceFiling(f.id, "考试通过待备案")}
                        >
                          考试通过
                        </button>
                      )}
                      {f.status === "考试通过待备案" && (
                        <button
                          className="cso-btn-primary"
                          onClick={() => advanceFiling(f.id, "备案有效")}
                        >
                          确认备案
                        </button>
                      )}
                      {f.status !== "备案撤销" && (
                        <button
                          className="cso-btn-secondary"
                          onClick={() => advanceFiling(f.id, "备案撤销")}
                        >
                          撤销
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "products" && (
        <section className="cso-card p-6">
          <h2 className="cso-page-title mb-1">产品管理</h2>
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">
            来源：marketing-platform 拜访产品大类 + 流向常用品种
          </p>
          <table className="cso-table">
            <thead>
              <tr>
                <th>产品</th>
                <th>编码</th>
                <th>工厂简称</th>
                <th>工厂全称</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} >
                  <td>{p.name}</td>
                  <td>{p.code}</td>
                  <td>{p.factory_short_name}</td>
                  <td>{p.factory_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "fees" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <form className="cso-card space-y-3 p-5" onSubmit={createFee}>
            <h2 className="font-semibold">新增费用标准</h2>
            <input className="cso-input" name="name" placeholder="名称" required />
            <input className="cso-input" name="category" placeholder="类别" defaultValue="会议" />
            <input className="cso-input" name="amount" type="number" placeholder="金额" required />
            <input className="cso-input" name="unit" placeholder="单位" defaultValue="场" />
            <button className="cso-btn-primary">保存</button>
          </form>
          <section className="cso-card overflow-x-auto p-6 lg:col-span-2">
            <h2 className="cso-page-title mb-1">费用标准</h2>
            <table className="cso-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类别</th>
                  <th>金额</th>
                  <th>单位</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td>{f.category}</td>
                    <td>{f.amount}</td>
                    <td>{f.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {tab === "reports" && (
        <section className="cso-card p-6">
          <h2 className="cso-page-title mb-1">报告管理</h2>
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
                <span>
                  {r.title} · {r.period}
                </span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.status === "已提交" && (
                    <button className="cso-btn-primary" onClick={() => approveReport(r.id)}>
                      通过
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "approvals" && (
        <section className="cso-card p-6">
          <h2 className="cso-page-title mb-1">会议费用审批</h2>
          <ul className="space-y-2">
            {meetings.map((m) => (
              <li key={m.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
                <span>
                  {m.title} · 预算 {m.budget ?? "-"}
                </span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={m.status} />
                  {(m.status === "待审批" || m.status === "计划中") && (
                    <>
                      <button className="cso-btn-primary" onClick={() => approveMeeting(m.id)}>
                        批准
                      </button>
                      <button
                        className="cso-btn-secondary"
                        onClick={async () => {
                          await api(`/api/meetings/${m.id}/reject`, { method: "POST" });
                          await load();
                        }}
                      >
                        驳回
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}

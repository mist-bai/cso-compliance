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

  async function syncMaster() {
    try {
      const res = await api<{ result: Record<string, number> }>("/api/master/sync", {
        method: "POST",
      });
      setSyncMsg(
        `已同步：工厂 ${res.result.factories} / 服务商 ${res.result.providers} / 产品 ${res.result.products}`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "同步失败");
    }
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
      subtitle="后台管理入口"
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
            <h2 className="mb-3 font-semibold">代理商账号管理</h2>
            <table className="min-w-full text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left">代理商名称</th>
                  <th className="px-2 py-2 text-left">服务商</th>
                  <th className="px-2 py-2 text-left">联系人</th>
                  <th className="px-2 py-2 text-left">电话</th>
                  <th className="px-2 py-2 text-left">邮箱</th>
                  <th className="px-2 py-2 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="px-2 py-2.5">{a.name}</td>
                    <td className="px-2 py-2.5">{a.provider_name}</td>
                    <td className="px-2 py-2.5">{a.contact}</td>
                    <td className="px-2 py-2.5">{a.phone}</td>
                    <td className="px-2 py-2.5">{a.email}</td>
                    <td className="px-2 py-2.5">{a.is_active ? "启用" : "停用"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "providers" && (
        <section className="cso-card p-5">
          <h2 className="mb-3 font-semibold">服务商管理</h2>
          <p className="mb-3 text-sm text-slate-500">
            来源：oracle_bridge.ORG_MAP + BI 发薪机构 MAT_YWGS（大连博道/天津博达/安徽博鑫/北京塞升）
          </p>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">编码</th>
                <th className="px-2 py-2 text-left">名称</th>
                <th className="px-2 py-2 text-left">区域</th>
                <th className="px-2 py-2 text-left">来源</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{p.code}</td>
                  <td className="px-2 py-2.5">{p.name}</td>
                  <td className="px-2 py-2.5">{p.region}</td>
                  <td className="px-2 py-2.5 text-xs text-slate-500">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "factories" && (
        <section className="cso-card p-5">
          <h2 className="mb-3 font-semibold">工厂管理（法人组织）</h2>
          <p className="mb-3 text-sm text-slate-500">
            来源：营销信息推送问数 organizations.json（12 家）
          </p>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">编码</th>
                <th className="px-2 py-2 text-left">简称</th>
                <th className="px-2 py-2 text-left">全称</th>
              </tr>
            </thead>
            <tbody>
              {factories.map((f) => (
                <tr key={f.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{f.code}</td>
                  <td className="px-2 py-2.5">{f.short_name}</td>
                  <td className="px-2 py-2.5">{f.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "hospitals" && (
        <section className="cso-card p-5">
          <h2 className="mb-3 font-semibold">医院终端</h2>
          <p className="mb-3 text-sm text-slate-500">
            当前为种子样例；后续可从 marketing_hospital_profile / 终端主数据批量导入
          </p>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">医院</th>
                <th className="px-2 py-2 text-left">省</th>
                <th className="px-2 py-2 text-left">市</th>
                <th className="px-2 py-2 text-left">等级</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((h) => (
                <tr key={h.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{h.name}</td>
                  <td className="px-2 py-2.5">{h.province}</td>
                  <td className="px-2 py-2.5">{h.city}</td>
                  <td className="px-2 py-2.5">{h.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "reps" && (
        <section className="cso-card p-5">
          <h2 className="mb-3 font-semibold">代表备案管理</h2>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">姓名</th>
                <th className="px-2 py-2 text-left">代理商</th>
                <th className="px-2 py-2 text-left">工厂</th>
                <th className="px-2 py-2 text-left">状态</th>
                <th className="px-2 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {filings.map((f) => (
                <tr key={f.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{f.rep_name}</td>
                  <td className="px-2 py-2.5">{f.agent_name}</td>
                  <td className="px-2 py-2.5">{f.factory_name}</td>
                  <td className="px-2 py-2.5">
                    <StatusBadge status={f.status} />
                  </td>
                  <td className="px-2 py-2.5">
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
        <section className="cso-card p-5">
          <h2 className="mb-3 font-semibold">产品管理</h2>
          <p className="mb-3 text-sm text-slate-500">
            来源：marketing-platform 拜访产品大类 + 流向常用品种
          </p>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">产品</th>
                <th className="px-2 py-2 text-left">编码</th>
                <th className="px-2 py-2 text-left">工厂简称</th>
                <th className="px-2 py-2 text-left">工厂全称</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{p.name}</td>
                  <td className="px-2 py-2.5">{p.code}</td>
                  <td className="px-2 py-2.5">{p.factory_short_name}</td>
                  <td className="px-2 py-2.5">{p.factory_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "fees" && (
        <section className="cso-card p-5">
          <h2 className="mb-3 font-semibold">费用标准</h2>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">名称</th>
                <th className="px-2 py-2 text-left">类别</th>
                <th className="px-2 py-2 text-left">金额</th>
                <th className="px-2 py-2 text-left">单位</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((f) => (
                <tr key={f.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{f.name}</td>
                  <td className="px-2 py-2.5">{f.category}</td>
                  <td className="px-2 py-2.5">{f.amount}</td>
                  <td className="px-2 py-2.5">{f.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "reports" && (
        <section className="cso-card p-5">
          <h2 className="mb-3 font-semibold">报告管理</h2>
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
        <section className="cso-card p-5">
          <h2 className="mb-3 font-semibold">会议费用审批</h2>
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

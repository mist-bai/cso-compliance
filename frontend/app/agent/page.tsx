"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell, { StatusBadge } from "@/components/AppShell";
import { api } from "@/lib/api";

type Filing = {
  id: number;
  rep_name?: string;
  id_card?: string;
  agent_name?: string;
  provider_name?: string;
  factory_name?: string;
  valid_from?: string;
  valid_to?: string;
  status: string;
};

type Visit = {
  id: number;
  rep_name?: string;
  provider_name?: string;
  visit_count: number;
  completion_rate?: number;
  period: string;
  uploaded_on?: string;
};

type Meeting = {
  id: number;
  title: string;
  meeting_type?: string;
  location?: string;
  meeting_date?: string;
  attendees_count?: number;
  attendees?: string[];
  purpose?: string;
  status: string;
  budget?: number;
  summary?: string;
  rep_name?: string;
  provider_name?: string;
};

type Report = { id: number; title: string; period: string; status: string };
type Factory = { id: number; name: string };
type Provider = { id: number; name: string };
type Rep = { id: number; name: string };
type TrainStat = {
  representative_id: number;
  rep_name: string;
  total_courses: number;
  completed_courses: number;
  pending_courses: number;
};

const tabs = [
  { key: "filings", label: "代表备案" },
  { key: "visits", label: "代表拜访" },
  { key: "meetings", label: "学术会议" },
  { key: "training", label: "代表培训" },
  { key: "reports", label: "报告提交" },
];

const meetingTypes = ["学术研讨会", "产品推广会", "医生培训会", "科室交流会"];

export default function AgentPage() {
  const [tab, setTab] = useState("filings");
  const [filings, setFilings] = useState<Filing[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [trainStats, setTrainStats] = useState<TrainStat[]>([]);
  const [providerId, setProviderId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [q, setQ] = useState("");
  const [meetingQ, setMeetingQ] = useState("");
  const [repQ, setRepQ] = useState("");
  const [error, setError] = useState("");
  const [showCreateFiling, setShowCreateFiling] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [detail, setDetail] = useState<Meeting | null>(null);

  async function load() {
    try {
      const [f, v, m, r, fac, pro, repList, stats] = await Promise.all([
        api<Filing[]>(`/api/filings${providerId ? `?provider_id=${providerId}` : ""}`),
        api<Visit[]>("/api/visits"),
        api<Meeting[]>(
          `/api/meetings?${new URLSearchParams({
            ...(meetingQ ? { q: meetingQ } : {}),
            ...(repQ ? { rep_q: repQ } : {}),
          }).toString()}`
        ),
        api<Report[]>("/api/reports"),
        api<Factory[]>("/api/factories"),
        api<Provider[]>("/api/providers"),
        api<Rep[]>("/api/representatives"),
        api<TrainStat[]>("/api/training/stats/by-rep"),
      ]);
      setFilings(f);
      setVisits(v);
      setMeetings(m);
      setReports(r);
      setFactories(fac);
      setProviders(pro);
      setReps(repList);
      setTrainStats(stats);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  const filteredFilings = useMemo(() => {
    return filings.filter((row) => {
      if (
        factoryId &&
        factories.find((f) => String(f.id) === factoryId)?.name !== row.factory_name
      ) {
        return false;
      }
      if (!q) return true;
      return (row.rep_name || "").includes(q) || (row.id_card || "").includes(q);
    });
  }, [filings, factoryId, factories, q]);

  async function onCreateFiling(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/filings", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          id_card: fd.get("id_card"),
          factory_id: Number(fd.get("factory_id")),
          phone: fd.get("phone") || null,
          valid_from: fd.get("valid_from") || null,
          valid_to: fd.get("valid_to") || null,
        }),
      });
      setShowCreateFiling(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  }

  async function onCreateMeeting(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const attendees = String(fd.get("attendees") || "")
      .split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await api("/api/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: fd.get("title"),
          meeting_type: fd.get("meeting_type"),
          location: fd.get("location"),
          meeting_date: fd.get("meeting_date") || null,
          representative_id: fd.get("representative_id")
            ? Number(fd.get("representative_id"))
            : null,
          attendees,
          attendees_count: attendees.length,
          purpose: fd.get("purpose"),
          budget: fd.get("budget") ? Number(fd.get("budget")) : null,
          submit: fd.get("submit") === "1",
        }),
      });
      setShowMeetingForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "会议申请失败");
    }
  }

  async function submitMeeting(id: number) {
    await api(`/api/meetings/${id}/submit`, { method: "POST" });
    await load();
  }

  async function submitSummary(id: number) {
    const summary = window.prompt("请输入会议总结");
    if (!summary) return;
    await api(`/api/meetings/${id}/summary`, {
      method: "POST",
      body: JSON.stringify({ summary }),
    });
    await load();
  }

  async function submitReport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/reports", {
      method: "POST",
      body: JSON.stringify({
        title: fd.get("title"),
        period: fd.get("period"),
        content: fd.get("content"),
      }),
    });
    e.currentTarget.reset();
    await load();
  }

  return (
    <AppShell
      title="代理商入口"
      subtitle="誉衡药业 · 真实服务商主数据（大连博道等）"
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      requiredRoles={["agent"]}
      rightSlot={
        <label className="flex items-center gap-2 text-sm text-slate-600">
          服务商
          <select
            className="cso-input w-auto"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            <option value="">全部</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {tab === "filings" && (
        <section className="cso-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">代表备案列表</h2>
              <p className="text-sm text-slate-500">管理代表的备案信息和状态</p>
            </div>
            <button className="cso-btn-primary" onClick={() => setShowCreateFiling(true)}>
              + 新增代表备案
            </button>
          </div>
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              className="cso-input max-w-xs"
              placeholder="搜索姓名或身份证号..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="cso-input w-auto"
              value={factoryId}
              onChange={(e) => setFactoryId(e.target.value)}
            >
              <option value="">全部工厂</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="px-2 py-2">姓名</th>
                  <th className="px-2 py-2">身份证号</th>
                  <th className="px-2 py-2">代理商</th>
                  <th className="px-2 py-2">服务商</th>
                  <th className="px-2 py-2">备案工厂</th>
                  <th className="px-2 py-2">有效期</th>
                  <th className="px-2 py-2">状态</th>
                </tr>
              </thead>
              <tbody>
                {filteredFilings.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-2.5">{row.rep_name}</td>
                    <td className="px-2 py-2.5">{row.id_card}</td>
                    <td className="px-2 py-2.5">{row.agent_name}</td>
                    <td className="px-2 py-2.5">{row.provider_name}</td>
                    <td className="px-2 py-2.5">{row.factory_name}</td>
                    <td className="px-2 py-2.5">
                      {row.valid_from || "-"} ~ {row.valid_to || "-"}
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "visits" && (
        <section className="cso-card p-5">
          <h2 className="text-lg font-semibold">代表拜访统计</h2>
          <p className="mb-4 text-sm text-slate-500">
            查看名下代表的拜访记录和活动统计（拜访记录由代表自行提交）
          </p>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2">代表姓名</th>
                <th className="px-2 py-2">服务商</th>
                <th className="px-2 py-2">拜访次数</th>
                <th className="px-2 py-2">完成率</th>
                <th className="px-2 py-2">统计周期</th>
                <th className="px-2 py-2">上传日期</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{row.rep_name}</td>
                  <td className="px-2 py-2.5">{row.provider_name}</td>
                  <td className="px-2 py-2.5">{row.visit_count} 次</td>
                  <td className="px-2 py-2.5">{row.completion_rate}%</td>
                  <td className="px-2 py-2.5">{row.period}</td>
                  <td className="px-2 py-2.5">{row.uploaded_on || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "meetings" && (
        <section className="space-y-4">
          <div className="cso-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">学术会议列表</h2>
                <p className="text-sm text-slate-500">管理和查看学术会议信息</p>
              </div>
              <button className="cso-btn-primary" onClick={() => setShowMeetingForm(true)}>
                + 会议申请
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-3">
              <input
                className="cso-input max-w-xs"
                placeholder="搜索会议名称或地点..."
                value={meetingQ}
                onChange={(e) => setMeetingQ(e.target.value)}
              />
              <input
                className="cso-input max-w-xs"
                placeholder="搜索参与代表..."
                value={repQ}
                onChange={(e) => setRepQ(e.target.value)}
              />
              <button className="cso-btn-secondary" onClick={load}>
                查询
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="px-2 py-2">会议名称</th>
                    <th className="px-2 py-2">日期</th>
                    <th className="px-2 py-2">地点</th>
                    <th className="px-2 py-2">服务商</th>
                    <th className="px-2 py-2">参与人数</th>
                    <th className="px-2 py-2">预算</th>
                    <th className="px-2 py-2">状态</th>
                    <th className="px-2 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100">
                      <td className="px-2 py-2.5">
                        <button className="font-medium text-brand-600 hover:underline" onClick={() => setDetail(m)}>
                          {m.title}
                        </button>
                      </td>
                      <td className="px-2 py-2.5">{m.meeting_date || "-"}</td>
                      <td className="px-2 py-2.5">{m.location || "-"}</td>
                      <td className="px-2 py-2.5">{m.provider_name || "-"}</td>
                      <td className="px-2 py-2.5">{m.attendees_count || 0} 人</td>
                      <td className="px-2 py-2.5">
                        {m.budget != null ? `¥${m.budget.toLocaleString()}` : "-"}
                      </td>
                      <td className="px-2 py-2.5">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(m.status === "计划中" || m.status === "已驳回") && (
                            <button className="cso-btn-secondary" onClick={() => submitMeeting(m.id)}>
                              提交审批
                            </button>
                          )}
                          {m.status === "已批准" && (
                            <button className="cso-btn-primary" onClick={() => submitSummary(m.id)}>
                              提交总结
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === "training" && (
        <section className="cso-card p-5">
          <h2 className="text-lg font-semibold">代表培训情况</h2>
          <p className="mb-4 text-sm text-slate-500">
            查看名下代表课程完成进度；课程内容在「课程管理」维护，备案考试通过后自动推进备案状态
          </p>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">代表</th>
                <th className="px-2 py-2 text-left">课程总数</th>
                <th className="px-2 py-2 text-left">已完成</th>
                <th className="px-2 py-2 text-left">待完成</th>
              </tr>
            </thead>
            <tbody>
              {trainStats.map((s) => (
                <tr key={s.representative_id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{s.rep_name}</td>
                  <td className="px-2 py-2.5">{s.total_courses}</td>
                  <td className="px-2 py-2.5">{s.completed_courses}</td>
                  <td className="px-2 py-2.5">{s.pending_courses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "reports" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <form className="cso-card space-y-3 p-5" onSubmit={submitReport}>
            <h2 className="text-lg font-semibold">提交合规报告</h2>
            <input className="cso-input" name="title" placeholder="报告标题" required />
            <input className="cso-input" name="period" placeholder="周期，如 2026-Q1" required />
            <textarea className="cso-input min-h-28" name="content" placeholder="报告内容" />
            <button className="cso-btn-primary">提交</button>
          </form>
          <div className="cso-card p-5">
            <h2 className="mb-3 text-lg font-semibold">已提交报告</h2>
            <ul className="space-y-2 text-sm">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2">
                  <span>
                    {r.title} · {r.period}
                  </span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {showCreateFiling && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <form className="cso-card w-full max-w-lg space-y-3 p-6" onSubmit={onCreateFiling}>
            <h3 className="text-lg font-semibold">新增代表备案</h3>
            <input className="cso-input" name="name" placeholder="姓名" required />
            <input className="cso-input" name="id_card" placeholder="身份证号" required />
            <input className="cso-input" name="phone" placeholder="手机号" />
            <select className="cso-input" name="factory_id" required>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input className="cso-input" type="date" name="valid_from" />
              <input className="cso-input" type="date" name="valid_to" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="cso-btn-secondary" onClick={() => setShowCreateFiling(false)}>
                取消
              </button>
              <button className="cso-btn-primary">保存</button>
            </div>
          </form>
        </div>
      )}

      {showMeetingForm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <form className="cso-card max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto p-6" onSubmit={onCreateMeeting}>
            <h3 className="text-lg font-semibold">学术会议申请</h3>
            <input className="cso-input" name="title" placeholder="会议名称" required />
            <select className="cso-input" name="meeting_type" defaultValue="学术研讨会">
              {meetingTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input className="cso-input" name="location" placeholder="会议地点" required />
            <input className="cso-input" type="date" name="meeting_date" required />
            <input className="cso-input" name="budget" type="number" placeholder="会议预算（元）" />
            <select className="cso-input" name="representative_id">
              <option value="">主责代表（可选）</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <textarea
              className="cso-input min-h-20"
              name="attendees"
              placeholder="参与代表，逗号分隔，如：杨明,何秀英,罗磊"
            />
            <textarea className="cso-input min-h-20" name="purpose" placeholder="申请事由 / 会议目的" />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="submit" value="1" defaultChecked />
              创建后直接提交审批（否则为「计划中」）
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="cso-btn-secondary" onClick={() => setShowMeetingForm(false)}>
                取消
              </button>
              <button className="cso-btn-primary">保存申请</button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="cso-card w-full max-w-lg p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">学术会议详情</h3>
                <p className="mt-1 font-medium">{detail.title}</p>
              </div>
              <button className="cso-btn-secondary" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">会议日期</dt>
                <dd>{detail.meeting_date || "-"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">会议地点</dt>
                <dd>{detail.location || "-"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">参与人数</dt>
                <dd>{detail.attendees_count || 0} 人</dd>
              </div>
              <div>
                <dt className="text-slate-500">会议预算</dt>
                <dd>{detail.budget != null ? `¥${detail.budget.toLocaleString()}` : "-"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">参与代表</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {(detail.attendees || []).map((a) => (
                    <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                      {a}
                    </span>
                  ))}
                  {!detail.attendees?.length && "-"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">会议状态</dt>
                <dd className="mt-1">
                  <StatusBadge status={detail.status} />
                </dd>
              </div>
              {detail.summary && (
                <div className="col-span-2">
                  <dt className="text-slate-500">会议总结</dt>
                  <dd>{detail.summary}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </AppShell>
  );
}

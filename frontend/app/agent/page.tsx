"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell, { StatusBadge } from "@/components/AppShell";
import { Modal, ProviderSelect, SearchInput, SectionCard } from "@/components/ui";
import { api } from "@/lib/api";
import { Pencil } from "lucide-react";

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
  target_count?: number;
  completion_rate?: number;
  period: string;
  uploaded_on?: string;
  note?: string;
  hospital_names?: string[];
  event_count?: number;
};

type VisitEvent = {
  id: number;
  visit_date: string;
  hospital_name?: string;
  hospital_province?: string;
  hospital_city?: string;
  note?: string;
  rep_name?: string;
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
  const [visitDetail, setVisitDetail] = useState<Visit | null>(null);
  const [visitEvents, setVisitEvents] = useState<VisitEvent[]>([]);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [editFiling, setEditFiling] = useState<Filing | null>(null);

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

  async function openVisit(id: number) {
    const [row, events] = await Promise.all([
      api<Visit>(`/api/visits/${id}`),
      api<VisitEvent[]>(`/api/visits/${id}/events`),
    ]);
    setVisitDetail(row);
    setVisitEvents(events);
  }

  async function saveFilingEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editFiling) return;
    const fd = new FormData(e.currentTarget);
    await api(`/api/filings/${editFiling.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: fd.get("status") || editFiling.status,
        valid_from: fd.get("valid_from") || null,
        valid_to: fd.get("valid_to") || null,
        remark: fd.get("remark") || null,
      }),
    });
    setEditFiling(null);
    await load();
  }

  async function saveMeetingEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editMeeting) return;
    const fd = new FormData(e.currentTarget);
    const attendees = String(fd.get("attendees") || "")
      .split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    await api(`/api/meetings/${editMeeting.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: fd.get("title"),
        meeting_type: fd.get("meeting_type"),
        location: fd.get("location"),
        meeting_date: fd.get("meeting_date") || null,
        budget: fd.get("budget") ? Number(fd.get("budget")) : null,
        purpose: fd.get("purpose"),
        attendees,
        attendees_count: attendees.length,
      }),
    });
    setEditMeeting(null);
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
      subtitle="誉衡药业 - 华北区"
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      requiredRoles={["agent"]}
      rightSlot={
        <ProviderSelect
          value={providerId}
          onChange={setProviderId}
          options={providers}
        />
      }
    >
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {tab === "filings" && (
        <SectionCard
          title="代表备案列表"
          description="管理代表的备案信息和状态"
          action={
            <button className="cso-btn-primary" onClick={() => setShowCreateFiling(true)}>
              + 新增代表备案
            </button>
          }
        >
          <div className="cso-toolbar">
            <SearchInput
              className="max-w-sm flex-1"
              placeholder="搜索姓名或身份证号..."
              value={q}
              onChange={setQ}
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
            <table className="cso-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>身份证号</th>
                  <th>代理商</th>
                  <th>服务商</th>
                  <th>备案工厂</th>
                  <th>有效期</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredFilings.map((row) => (
                  <tr key={row.id}>
                    <td>{row.rep_name}</td>
                    <td>{row.id_card}</td>
                    <td>{row.agent_name}</td>
                    <td>{row.provider_name}</td>
                    <td>{row.factory_name}</td>
                    <td>
                      {row.valid_from || "-"} ~ {row.valid_to || "-"}
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <button
                        className="cso-btn-ghost h-8 px-2 text-[var(--muted-foreground)]"
                        onClick={() => setEditFiling(row)}
                        title="编辑备案"
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {tab === "visits" && (
        <SectionCard
          title="代表拜访统计"
          description="查看名下代表的拜访记录和活动统计（拜访记录由代表自行提交）"
        >
          <div className="overflow-x-auto">
            <table className="cso-table">
              <thead>
                <tr>
                  <th>代表姓名</th>
                  <th>服务商</th>
                  <th>拜访次数</th>
                  <th>医院</th>
                  <th>完成率</th>
                  <th>统计周期</th>
                  <th>上传日期</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((row) => (
                  <tr key={row.id}>
                    <td>{row.rep_name}</td>
                    <td>{row.provider_name}</td>
                    <td>
                      <button
                        className="cso-btn-secondary h-8 px-3"
                        onClick={() => openVisit(row.id)}
                      >
                        {row.visit_count} 次
                      </button>
                    </td>
                    <td className="max-w-[12rem] truncate text-sm text-[var(--muted-foreground)]">
                      {(row.hospital_names || []).join("、") || "-"}
                    </td>
                    <td>{row.completion_rate}%</td>
                    <td>{row.period}</td>
                    <td>{row.uploaded_on || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {tab === "meetings" && (
        <SectionCard
          title="学术会议列表"
          description="管理和查看学术会议信息"
          action={
            <button className="cso-btn-primary" onClick={() => setShowMeetingForm(true)}>
              + 会议申请
            </button>
          }
        >
          <div className="cso-toolbar">
            <SearchInput
              className="max-w-xs flex-1"
              placeholder="搜索会议名称或地点..."
              value={meetingQ}
              onChange={setMeetingQ}
            />
            <SearchInput
              className="max-w-xs flex-1"
              placeholder="搜索参与代表..."
              value={repQ}
              onChange={setRepQ}
            />
            <button className="cso-btn-secondary" onClick={load}>
              查询
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="cso-table">
              <thead>
                <tr>
                  <th>会议名称</th>
                  <th>日期</th>
                  <th>地点</th>
                  <th>服务商</th>
                  <th>参与人数</th>
                  <th>预算</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <button
                        className="font-medium text-[var(--foreground)] underline-offset-4 hover:underline"
                        onClick={() => setDetail(m)}
                      >
                        {m.title}
                      </button>
                    </td>
                    <td>{m.meeting_date || "-"}</td>
                    <td>{m.location || "-"}</td>
                    <td>{m.provider_name || "-"}</td>
                    <td>{m.attendees_count || 0} 人</td>
                    <td>{m.budget != null ? `¥${m.budget.toLocaleString()}` : "-"}</td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {m.status !== "已完成" && (
                          <button className="cso-btn-secondary h-8" onClick={() => setEditMeeting(m)}>
                            修改
                          </button>
                        )}
                        {(m.status === "计划中" || m.status === "已驳回") && (
                          <button className="cso-btn-secondary h-8" onClick={() => submitMeeting(m.id)}>
                            提交审批
                          </button>
                        )}
                        {m.status === "已批准" && (
                          <button className="cso-btn-primary h-8" onClick={() => submitSummary(m.id)}>
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
        </SectionCard>
      )}

      {tab === "training" && (
        <SectionCard
          title="代表培训情况"
          description="查看名下代表课程完成进度；备案考试通过后自动推进备案状态"
        >
          <div className="overflow-x-auto">
            <table className="cso-table">
              <thead>
                <tr>
                  <th>代表</th>
                  <th>课程总数</th>
                  <th>已完成</th>
                  <th>待完成</th>
                </tr>
              </thead>
              <tbody>
                {trainStats.map((s) => (
                  <tr key={s.representative_id}>
                    <td>{s.rep_name}</td>
                    <td>{s.total_courses}</td>
                    <td>{s.completed_courses}</td>
                    <td>{s.pending_courses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {tab === "reports" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <form className="cso-card space-y-3 p-6" onSubmit={submitReport}>
            <h2 className="cso-page-title">提交合规报告</h2>
            <p className="cso-page-desc">按周期提交合规报告</p>
            <input className="cso-input" name="title" placeholder="报告标题" required />
            <input className="cso-input" name="period" placeholder="周期，如 2026-Q1" required />
            <textarea className="cso-input min-h-28 py-2" name="content" placeholder="报告内容" />
            <button className="cso-btn-primary">提交</button>
          </form>
          <div className="cso-card p-6">
            <h2 className="cso-page-title mb-3">已提交报告</h2>
            <ul className="space-y-2 text-sm">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between border-b border-[var(--border)] py-3 last:border-0"
                >
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
        <Modal onClose={() => setShowCreateFiling(false)}>
          <form className="space-y-3" onSubmit={onCreateFiling}>
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
        </Modal>
      )}

      {showMeetingForm && (
        <Modal onClose={() => setShowMeetingForm(false)} wide>
          <form className="space-y-3" onSubmit={onCreateMeeting}>
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
              className="cso-input min-h-20 py-2"
              name="attendees"
              placeholder="参与代表，逗号分隔，如：杨明,何秀英,罗磊"
            />
            <textarea className="cso-input min-h-20 py-2" name="purpose" placeholder="申请事由 / 会议目的" />
            <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
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
        </Modal>
      )}

      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">学术会议详情</h3>
              <p className="mt-1 font-medium">{detail.title}</p>
            </div>
            <button className="cso-btn-ghost h-8 px-2" onClick={() => setDetail(null)}>
              ×
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[var(--muted-foreground)]">会议日期</dt>
              <dd className="mt-1 font-medium">{detail.meeting_date || "-"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">会议地点</dt>
              <dd className="mt-1 font-medium">{detail.location || "-"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">参与人数</dt>
              <dd className="mt-1 font-medium">{detail.attendees_count || 0} 人</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">会议预算</dt>
              <dd className="mt-1 font-medium">
                {detail.budget != null ? `¥ ${detail.budget.toLocaleString()}` : "-"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[var(--muted-foreground)]">参与代表</dt>
              <dd className="mt-2 flex flex-wrap gap-1.5">
                {(detail.attendees || []).map((a) => (
                  <span key={a} className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-xs">
                    {a}
                  </span>
                ))}
                {!detail.attendees?.length && "-"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[var(--muted-foreground)]">会议状态</dt>
              <dd className="mt-1">
                <StatusBadge status={detail.status} />
              </dd>
            </div>
            {detail.summary && (
              <div className="col-span-2">
                <dt className="text-[var(--muted-foreground)]">会议总结</dt>
                <dd className="mt-1">{detail.summary}</dd>
              </div>
            )}
          </dl>
        </Modal>
      )}

      {visitDetail && (
        <Modal onClose={() => { setVisitDetail(null); setVisitEvents([]); }} wide>
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold">拜访明细</h3>
            <button
              className="cso-btn-ghost h-8 px-2"
              onClick={() => {
                setVisitDetail(null);
                setVisitEvents([]);
              }}
            >
              ×
            </button>
          </div>
          <dl className="mb-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[var(--muted-foreground)]">代表</dt>
              <dd className="mt-1 font-medium">{visitDetail.rep_name || "-"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">服务商</dt>
              <dd className="mt-1 font-medium">{visitDetail.provider_name || "-"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">统计周期</dt>
              <dd className="mt-1 font-medium">{visitDetail.period}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">完成率</dt>
              <dd className="mt-1 font-medium">
                {visitDetail.completion_rate != null ? `${visitDetail.completion_rate}%` : "-"}
              </dd>
            </div>
          </dl>
          <h4 className="mb-2 text-sm font-medium">单次拜访（{visitEvents.length}）</h4>
          <div className="max-h-64 overflow-y-auto">
            <table className="cso-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>医院终端</th>
                  <th>省市</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {visitEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td>{ev.visit_date}</td>
                    <td>{ev.hospital_name || "未填写"}</td>
                    <td>
                      {[ev.hospital_province, ev.hospital_city].filter(Boolean).join(" ") || "-"}
                    </td>
                    <td>{ev.note || "-"}</td>
                  </tr>
                ))}
                {visitEvents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-[var(--muted-foreground)]">
                      暂无医院明细（历史汇总数据可能未关联终端）
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {editFiling && (
        <Modal onClose={() => setEditFiling(null)}>
          <form className="space-y-3" onSubmit={saveFilingEdit}>
            <h3 className="text-lg font-semibold">编辑代表备案</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              {editFiling.rep_name} · {editFiling.factory_name}
            </p>
            <div className="text-sm">
              当前状态：<StatusBadge status={editFiling.status} />
              <input type="hidden" name="status" value={editFiling.status} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-[var(--muted-foreground)]">
                有效期起
                <input
                  className="cso-input mt-1"
                  type="date"
                  name="valid_from"
                  defaultValue={editFiling.valid_from || ""}
                />
              </label>
              <label className="text-sm text-[var(--muted-foreground)]">
                有效期止
                <input
                  className="cso-input mt-1"
                  type="date"
                  name="valid_to"
                  defaultValue={editFiling.valid_to || ""}
                />
              </label>
            </div>
            <textarea
              className="cso-input min-h-20 py-2"
              name="remark"
              placeholder="备注"
              defaultValue=""
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="cso-btn-secondary" onClick={() => setEditFiling(null)}>
                取消
              </button>
              <button className="cso-btn-primary">保存</button>
            </div>
          </form>
        </Modal>
      )}

      {editMeeting && (
        <Modal onClose={() => setEditMeeting(null)} wide>
          <form className="space-y-3" onSubmit={saveMeetingEdit}>
            <h3 className="text-lg font-semibold">修改会议申请</h3>
            <input
              className="cso-input"
              name="title"
              defaultValue={editMeeting.title}
              placeholder="会议名称"
              required
            />
            <select
              className="cso-input"
              name="meeting_type"
              defaultValue={editMeeting.meeting_type || "学术研讨会"}
            >
              {meetingTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              className="cso-input"
              name="location"
              defaultValue={editMeeting.location || ""}
              placeholder="会议地点"
              required
            />
            <input
              className="cso-input"
              type="date"
              name="meeting_date"
              defaultValue={editMeeting.meeting_date || ""}
            />
            <input
              className="cso-input"
              name="budget"
              type="number"
              defaultValue={editMeeting.budget ?? ""}
              placeholder="会议预算（元）"
            />
            <textarea
              className="cso-input min-h-20 py-2"
              name="attendees"
              defaultValue={(editMeeting.attendees || []).join("、")}
              placeholder="参与代表，逗号分隔"
            />
            <textarea
              className="cso-input min-h-20 py-2"
              name="purpose"
              defaultValue={editMeeting.purpose || ""}
              placeholder="申请事由 / 会议目的"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="cso-btn-secondary" onClick={() => setEditMeeting(null)}>
                取消
              </button>
              <button className="cso-btn-primary">保存修改</button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}

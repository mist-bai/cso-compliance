"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell, { StatusBadge } from "@/components/AppShell";
import { SearchInput, SectionCard } from "@/components/ui";
import { api } from "@/lib/api";

type ProviderRow = {
  provider_id: number;
  provider_name: string;
  rep_count: number;
  active_filings: number;
  visit_total: number;
  meeting_count: number;
  training_pending: number;
};

type Summary = {
  reps: number;
  filings: number;
  active_filings: number;
  visits: number;
  meetings: number;
  pending_exam: number;
};

type ChartPoint = { label: string; value: number };
type Charts = {
  visits_by_period: ChartPoint[];
  meetings_by_status: ChartPoint[];
  filings_by_status: ChartPoint[];
  training: ChartPoint[];
};

type RepRow = {
  filing_id: number;
  rep_name?: string;
  agent_name?: string;
  provider_name?: string;
  factory_name?: string;
  status: string;
  visit_total: number;
  risk: boolean;
};

type MeetingRow = {
  id: number;
  title: string;
  meeting_type?: string;
  location?: string;
  meeting_date?: string;
  status: string;
  budget?: number;
  provider_name?: string;
  agent_name?: string;
  has_summary: boolean;
  need_attention: boolean;
};

type TrainStat = {
  representative_id: number;
  rep_name: string;
  total_courses: number;
  completed_courses: number;
  pending_courses: number;
};

const tabs = [
  { key: "provider", label: "服务商合规驾驶舱" },
  { key: "rep", label: "代表合规监控" },
  { key: "meeting", label: "会议合规看板" },
  { key: "training", label: "培训考试统计" },
];

const palette = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#38bdf8", "#34d399", "#fbbf24"];

function BarChart({ data, title }: { data: ChartPoint[]; title: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="cso-card p-6">
      <h3 className="cso-page-title mb-4">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">暂无数据</p>
      ) : (
        <div className="space-y-3">
          {data.map((d, i) => (
            <div key={d.label}>
              <div className="mb-1 flex justify-between text-xs text-[var(--muted-foreground)]">
                <span>{d.label}</span>
                <span className="font-medium text-[var(--foreground)]">{d.value}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--muted)]">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.max((d.value / max) * 100, 4)}%`,
                    background: palette[i % palette.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [tab, setTab] = useState("provider");
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [repRows, setRepRows] = useState<RepRow[]>([]);
  const [meetingRows, setMeetingRows] = useState<MeetingRow[]>([]);
  const [trainStats, setTrainStats] = useState<TrainStat[]>([]);
  const [q, setQ] = useState("");
  const [quarter, setQuarter] = useState("");
  const [error, setError] = useState("");

  async function load(keyword = q, qtr = quarter) {
    try {
      const providerQs = new URLSearchParams({
        ...(keyword ? { q: keyword } : {}),
        ...(qtr ? { quarter: qtr } : {}),
      }).toString();
      const [p, s, c, reps, meetings, train] = await Promise.all([
        api<ProviderRow[]>(`/api/dashboard/providers${providerQs ? `?${providerQs}` : ""}`),
        api<Summary>("/api/dashboard/summary"),
        api<Charts>("/api/dashboard/charts"),
        api<RepRow[]>(
          `/api/dashboard/reps${keyword ? `?q=${encodeURIComponent(keyword)}` : ""}`
        ),
        api<MeetingRow[]>(
          `/api/dashboard/meetings${keyword ? `?q=${encodeURIComponent(keyword)}` : ""}`
        ),
        api<TrainStat[]>("/api/training/stats/by-rep").catch(() => [] as TrainStat[]),
      ]);
      setRows(p);
      setSummary(s);
      setCharts(c);
      setRepRows(reps);
      setMeetingRows(meetings);
      setTrainStats(train);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartForTab = useMemo(() => {
    if (!charts) return null;
    if (tab === "rep") return { title: "备案状态分布", data: charts.filings_by_status };
    if (tab === "meeting") return { title: "会议状态分布", data: charts.meetings_by_status };
    if (tab === "training") return { title: "培训完成情况", data: charts.training };
    return { title: "拜访量（按周期）", data: charts.visits_by_period };
  }, [charts, tab]);

  return (
    <AppShell
      title="合规看板"
      subtitle="合规数据可视化看板"
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      requiredRoles={["compliance", "admin"]}
    >
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {summary && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["代表数", summary.reps],
            ["备案数", summary.filings],
            ["有效备案", summary.active_filings],
            ["拜访总量", summary.visits],
            ["会议数", summary.meetings],
            ["待考试", summary.pending_exam],
          ].map(([label, value]) => (
            <div key={String(label)} className="cso-card p-4">
              <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {chartForTab && <BarChart title={chartForTab.title} data={chartForTab.data} />}
        {charts && tab === "provider" && <BarChart title="培训完成情况" data={charts.training} />}
        {charts && tab === "rep" && (
          <BarChart title="拜访量（按周期）" data={charts.visits_by_period} />
        )}
        {charts && tab === "meeting" && (
          <BarChart title="拜访量（按周期）" data={charts.visits_by_period} />
        )}
        {charts && tab === "training" && (
          <BarChart title="备案状态分布" data={charts.filings_by_status} />
        )}
      </div>

      {tab === "provider" && (
        <SectionCard title="服务商推广驾驶舱" description="按服务商汇总代表、备案、拜访与会议">
          <div className="cso-toolbar">
            <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              季度
              <select
                className="cso-input w-auto"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
              >
                <option value="">全部季度</option>
                {["2026Q1", "2026Q2", "2026Q3", "2026Q4", "2025Q1", "2025Q2", "2025Q3", "2025Q4"].map(
                  (x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  )
                )}
              </select>
            </label>
            <SearchInput
              className="max-w-xs"
              placeholder="搜索服务商名称..."
              value={q}
              onChange={setQ}
            />
            <button
              className="cso-btn-secondary"
              onClick={() => {
                setQ("");
                setQuarter("");
                load("", "");
              }}
            >
              重置
            </button>
            <button className="cso-btn-primary" onClick={() => load(q, quarter)}>
              应用筛选
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="cso-table">
              <thead>
                <tr>
                  <th>服务商</th>
                  <th>代表数</th>
                  <th>有效备案</th>
                  <th>拜访总量</th>
                  <th>会议数</th>
                  <th>待培训</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.provider_id}>
                    <td className="font-medium">{r.provider_name}</td>
                    <td>{r.rep_count}</td>
                    <td>{r.active_filings}</td>
                    <td>{r.visit_total}</td>
                    <td>{r.meeting_count}</td>
                    <td>{r.training_pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {tab === "rep" && (
        <SectionCard title="代表合规监控" description="关注待考试、撤销等异常备案">
          <div className="cso-toolbar">
            <SearchInput className="max-w-xs" placeholder="搜索代表姓名..." value={q} onChange={setQ} />
            <button className="cso-btn-primary" onClick={() => load(q)}>
              查询
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="cso-table">
              <thead>
                <tr>
                  <th>代表</th>
                  <th>代理商</th>
                  <th>服务商</th>
                  <th>工厂</th>
                  <th>拜访总量</th>
                  <th>状态</th>
                  <th>风险</th>
                </tr>
              </thead>
              <tbody>
                {repRows.map((r) => (
                  <tr key={r.filing_id}>
                    <td>{r.rep_name}</td>
                    <td>{r.agent_name}</td>
                    <td>{r.provider_name}</td>
                    <td>{r.factory_name}</td>
                    <td>{r.visit_total}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>{r.risk ? <span className="text-rose-600">需关注</span> : "正常"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {tab === "meeting" && (
        <SectionCard title="会议合规看板" description="待审批、已批准未总结会议优先关注">
          <div className="cso-toolbar">
            <SearchInput
              className="max-w-xs"
              placeholder="搜索会议名称或地点..."
              value={q}
              onChange={setQ}
            />
            <button className="cso-btn-primary" onClick={() => load(q)}>
              查询
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="cso-table">
              <thead>
                <tr>
                  <th>会议</th>
                  <th>类型</th>
                  <th>日期</th>
                  <th>代理商</th>
                  <th>预算</th>
                  <th>总结</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {meetingRows.map((m) => (
                  <tr key={m.id} className={m.need_attention ? "bg-amber-50/60" : undefined}>
                    <td className="font-medium">{m.title}</td>
                    <td>{m.meeting_type || "-"}</td>
                    <td>{m.meeting_date || "-"}</td>
                    <td>{m.agent_name || "-"}</td>
                    <td>{m.budget != null ? `¥${m.budget}` : "-"}</td>
                    <td>{m.has_summary ? "已提交" : "未提交"}</td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {tab === "training" && (
        <SectionCard title="培训考试统计" description="按代表汇总课程完成情况">
          <div className="overflow-x-auto">
            <table className="cso-table">
              <thead>
                <tr>
                  <th>代表</th>
                  <th>课程总数</th>
                  <th>已完成</th>
                  <th>待完成</th>
                  <th>进度</th>
                </tr>
              </thead>
              <tbody>
                {trainStats.map((s) => (
                  <tr key={s.representative_id}>
                    <td>{s.rep_name}</td>
                    <td>{s.total_courses}</td>
                    <td>{s.completed_courses}</td>
                    <td>{s.pending_courses}</td>
                    <td>
                      <StatusBadge
                        status={
                          s.pending_courses === 0
                            ? "考试通过"
                            : s.completed_courses > 0
                              ? "学习中"
                              : "未开始"
                        }
                      />
                    </td>
                  </tr>
                ))}
                {trainStats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-[var(--muted-foreground)]">
                      暂无培训统计（请用 academy/admin 账号查看课程端，或先让代表参加培训）
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </AppShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
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

const tabs = [
  { key: "provider", label: "服务商合规驾驶舱" },
  { key: "rep", label: "代表合规监控" },
  { key: "meeting", label: "会议合规看板" },
  { key: "training", label: "培训考试统计" },
];

export default function DashboardPage() {
  const [tab, setTab] = useState("provider");
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  async function load(keyword = q) {
    try {
      const [p, s] = await Promise.all([
        api<ProviderRow[]>(`/api/dashboard/providers${keyword ? `?q=${encodeURIComponent(keyword)}` : ""}`),
        api<Summary>("/api/dashboard/summary"),
      ]);
      setRows(p);
      setSummary(s);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "provider" && (
        <section className="cso-card p-6">
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              className="cso-input max-w-xs"
              placeholder="搜索服务商名称..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="cso-btn-secondary" onClick={() => { setQ(""); load(""); }}>
              重置
            </button>
            <button className="cso-btn-primary" onClick={() => load(q)}>
              应用筛选
            </button>
          </div>
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
                <tr key={r.provider_id} >
                  <td className="px-2 py-2.5 font-medium">{r.provider_name}</td>
                  <td>{r.rep_count}</td>
                  <td>{r.active_filings}</td>
                  <td>{r.visit_total}</td>
                  <td>{r.meeting_count}</td>
                  <td>{r.training_pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab !== "provider" && (
        <section className="cso-card p-8 text-center text-[var(--muted-foreground)]">
          {tab === "rep" && "代表合规监控图：后续接入拜访达标率与备案异常分布。"}
          {tab === "meeting" && "会议合规看板：后续接入审批时效、费用超标、总结缺失等指标。"}
          {tab === "training" && "培训考试统计：后续对接誉学院成绩与完成率。"}
        </section>
      )}
    </AppShell>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import AppShell, { StatusBadge } from "@/components/AppShell";
import { api } from "@/lib/api";

type Course = {
  id: number;
  name: string;
  description?: string;
  duration_minutes: number;
  has_exam: boolean;
  is_compliance: boolean;
  learner_count: number;
  pass_rate?: number | null;
  published_on?: string;
  question_count: number;
};

type TrainStat = {
  representative_id: number;
  rep_name: string;
  total_courses: number;
  completed_courses: number;
  pending_courses: number;
};

const tabs = [
  { key: "list", label: "培训课程列表" },
  { key: "stats", label: "课程参与统计" },
  { key: "reps", label: "代表培训情况" },
];

export default function CoursesPage() {
  const [tab, setTab] = useState("list");
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<TrainStat[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    try {
      const [c, s] = await Promise.all([
        api<Course[]>(`/api/training/courses${q ? `?q=${encodeURIComponent(q)}` : ""}`),
        api<TrainStat[]>("/api/training/stats/by-rep"),
      ]);
      setCourses(c);
      setStats(s);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCourse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/training/courses", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        description: fd.get("description"),
        duration_minutes: Number(fd.get("duration_minutes") || 60),
        has_exam: fd.get("has_exam") === "1",
        is_compliance: fd.get("is_compliance") === "1",
        pass_score: 60,
        content: fd.get("content"),
      }),
    });
    setShowCreate(false);
    await load();
  }

  return (
    <AppShell
      title="课程管理"
      subtitle="课程管理中心"
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      requiredRoles={["academy", "admin"]}
      rightSlot={
        <button className="cso-btn-primary" onClick={() => setShowCreate(true)}>
          新建课程
        </button>
      }
    >
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {tab === "list" && (
        <section className="cso-card p-5">
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              className="cso-input max-w-xs"
              placeholder="搜索课程名称或描述..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="cso-btn-secondary" onClick={load}>
              查询
            </button>
          </div>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">课程名称</th>
                <th className="px-2 py-2 text-left">时长(分钟)</th>
                <th className="px-2 py-2 text-left">是否考试</th>
                <th className="px-2 py-2 text-left">题目数</th>
                <th className="px-2 py-2 text-left">学习人次</th>
                <th className="px-2 py-2 text-left">通过比例</th>
                <th className="px-2 py-2 text-left">发布日期</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">
                    {c.name}
                    {c.is_compliance && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        备案考试
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">{c.duration_minutes}</td>
                  <td className="px-2 py-2.5">{c.has_exam ? "是" : "否"}</td>
                  <td className="px-2 py-2.5">{c.question_count}</td>
                  <td className="px-2 py-2.5">{c.learner_count}</td>
                  <td className="px-2 py-2.5">
                    {c.pass_rate != null ? `${c.pass_rate}%` : "-"}
                  </td>
                  <td className="px-2 py-2.5">{c.published_on || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "stats" && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((c) => (
            <div key={c.id} className="cso-card p-4">
              <div className="text-sm font-medium">{c.name}</div>
              <div className="mt-3 text-2xl font-semibold">{c.learner_count}</div>
              <div className="text-xs text-slate-500">学习人次 · 通过率 {c.pass_rate ?? 0}%</div>
            </div>
          ))}
        </section>
      )}

      {tab === "reps" && (
        <section className="cso-card p-5">
          <h2 className="mb-3 font-semibold">代表培训情况</h2>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">代表</th>
                <th className="px-2 py-2 text-left">课程总数</th>
                <th className="px-2 py-2 text-left">已完成</th>
                <th className="px-2 py-2 text-left">待完成</th>
                <th className="px-2 py-2 text-left">进度</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.representative_id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{s.rep_name}</td>
                  <td className="px-2 py-2.5">{s.total_courses}</td>
                  <td className="px-2 py-2.5">{s.completed_courses}</td>
                  <td className="px-2 py-2.5">{s.pending_courses}</td>
                  <td className="px-2 py-2.5">
                    <StatusBadge
                      status={
                        s.pending_courses === 0 ? "考试通过" : s.completed_courses > 0 ? "学习中" : "未开始"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <form className="cso-card w-full max-w-lg space-y-3 p-6" onSubmit={createCourse}>
            <h3 className="text-lg font-semibold">新建课程</h3>
            <input className="cso-input" name="name" placeholder="课程名称" required />
            <input className="cso-input" name="description" placeholder="课程描述" />
            <input
              className="cso-input"
              name="duration_minutes"
              type="number"
              defaultValue={60}
              placeholder="时长（分钟）"
            />
            <textarea className="cso-input min-h-24" name="content" placeholder="学习内容" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="has_exam" value="1" defaultChecked /> 包含考试
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_compliance" value="1" /> 备案考试课程（通过后推进备案）
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="cso-btn-secondary" onClick={() => setShowCreate(false)}>
                取消
              </button>
              <button className="cso-btn-primary">保存</button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

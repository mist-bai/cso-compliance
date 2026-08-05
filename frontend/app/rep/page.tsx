"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell, { StatusBadge } from "@/components/AppShell";
import { api } from "@/lib/api";

type Filing = {
  id: number;
  status: string;
  factory_name?: string;
  valid_from?: string;
  valid_to?: string;
};

type Visit = {
  id: number;
  period: string;
  visit_count: number;
  target_count: number;
  completion_rate?: number;
};

type Meeting = {
  id: number;
  title: string;
  status: string;
  meeting_date?: string;
};

type Enrollment = {
  id: number;
  course_id: number;
  status: string;
  score?: number;
  max_score?: number;
  course_name?: string;
  duration_minutes?: number;
  has_exam?: boolean;
  is_compliance?: boolean;
};

type Course = {
  id: number;
  name: string;
  description?: string;
  duration_minutes: number;
  has_exam: boolean;
  is_compliance: boolean;
  content?: string;
};

type Question = {
  id: number;
  stem: string;
  options: string[];
  score: number;
};

const tabs = [
  { key: "todo", label: "待办任务" },
  { key: "filings", label: "备案明细" },
  { key: "visits", label: "拜访明细" },
  { key: "meetings", label: "学术会议" },
  { key: "training", label: "培训考试" },
];

export default function RepPage() {
  const [tab, setTab] = useState("todo");
  const [filings, setFilings] = useState<Filing[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState("");
  const [learning, setLearning] = useState<Course | null>(null);
  const [examCourse, setExamCourse] = useState<Course | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [examResult, setExamResult] = useState<string>("");

  async function load() {
    try {
      const [f, v, m, e, c] = await Promise.all([
        api<Filing[]>("/api/filings"),
        api<Visit[]>("/api/visits"),
        api<Meeting[]>("/api/meetings"),
        api<Enrollment[]>("/api/training/enrollments"),
        api<Course[]>("/api/training/courses"),
      ]);
      setFilings(f);
      setVisits(v);
      setMeetings(m);
      setEnrollments(e);
      setCourses(c);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeFiling = filings[0];
  const currentPeriod = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const monthVisit = visits.find((v) => v.period === currentPeriod) || visits[0];

  const enrollMap = useMemo(() => {
    const m = new Map<number, Enrollment>();
    enrollments.forEach((e) => m.set(e.course_id, e));
    return m;
  }, [enrollments]);

  const pendingCourses = courses.filter((c) => {
    const e = enrollMap.get(c.id);
    return !e || !["考试通过", "已完成"].includes(e.status);
  });
  const doneCourses = courses.filter((c) => {
    const e = enrollMap.get(c.id);
    return e && ["考试通过", "已完成"].includes(e.status);
  });
  const complianceCourse = courses.find((c) => c.is_compliance);

  async function addVisit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/visits", {
        method: "POST",
        body: JSON.stringify({ period: currentPeriod, visit_count: 1 }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    }
  }

  async function startLearning(course: Course) {
    await api(`/api/training/courses/${course.id}/enroll`, { method: "POST" });
    setLearning(course);
    await load();
  }

  async function finishLearning(courseId: number) {
    await api(`/api/training/courses/${courseId}/complete-learning`, { method: "POST" });
    setLearning(null);
    await load();
  }

  async function openExam(course: Course) {
    const qs = await api<Question[]>(`/api/training/courses/${course.id}/questions`);
    setQuestions(qs);
    setAnswers({});
    setExamResult("");
    setExamCourse(course);
  }

  async function submitExam(e: FormEvent) {
    e.preventDefault();
    if (!examCourse) return;
    try {
      const res = await api<{
        score: number;
        max_score: number;
        passed: boolean;
        status: string;
        filing_updated: number;
      }>(`/api/training/courses/${examCourse.id}/exam`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      setExamResult(
        `${res.passed ? "通过" : "未通过"}：${res.score}/${res.max_score} 分` +
          (res.filing_updated
            ? `；已同步更新 ${res.filing_updated} 条备案为「考试通过待备案」`
            : "")
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "交卷失败");
    }
  }

  return (
    <AppShell
      title="代表入口"
      subtitle={`代表入口 · 状态 ${activeFiling?.status || "未备案"}`}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      requiredRoles={["rep"]}
      rightSlot={
        complianceCourse ? (
          <button className="cso-btn-primary" onClick={() => openExam(complianceCourse)}>
            备案考试
          </button>
        ) : null
      }
    >
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {tab === "todo" && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="cso-card p-5">
            <h3 className="font-semibold">我的备案信息</h3>
            <p className="mt-3 text-2xl font-semibold text-emerald-700">
              {activeFiling?.status || "暂无"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {activeFiling
                ? `${activeFiling.factory_name} · ${activeFiling.valid_from} 至 ${activeFiling.valid_to}`
                : "尚未创建备案"}
            </p>
          </div>
          <div className="cso-card p-5">
            <h3 className="font-semibold">拜访任务 · 本月</h3>
            <p className="mt-3 text-2xl font-semibold">
              {monthVisit?.visit_count || 0}/{monthVisit?.target_count || 3} 次
            </p>
            <p className="mt-2 text-sm text-slate-500">每月需完成 3 次拜访</p>
            <form onSubmit={addVisit} className="mt-4">
              <button className="cso-btn-primary">提交 1 次拜访</button>
            </form>
          </div>
          <div className="cso-card p-5">
            <h3 className="font-semibold">培训考试</h3>
            <p className="mt-3 text-2xl font-semibold">
              {doneCourses.length}/{courses.length} 门
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {pendingCourses.length} 门课程待完成
            </p>
            <button className="cso-btn-secondary mt-4" onClick={() => setTab("training")}>
              前往学习
            </button>
          </div>
        </div>
      )}

      {tab === "filings" && (
        <section className="cso-card p-5">
          <h2 className="mb-3 text-lg font-semibold">备案明细</h2>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">工厂</th>
                <th className="px-2 py-2 text-left">有效期</th>
                <th className="px-2 py-2 text-left">状态</th>
              </tr>
            </thead>
            <tbody>
              {filings.map((f) => (
                <tr key={f.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{f.factory_name}</td>
                  <td className="px-2 py-2.5">
                    {f.valid_from} ~ {f.valid_to}
                  </td>
                  <td className="px-2 py-2.5">
                    <StatusBadge status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "visits" && (
        <section className="cso-card p-5">
          <h2 className="mb-3 text-lg font-semibold">拜访明细</h2>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">周期</th>
                <th className="px-2 py-2 text-left">次数</th>
                <th className="px-2 py-2 text-left">目标</th>
                <th className="px-2 py-2 text-left">完成率</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{v.period}</td>
                  <td className="px-2 py-2.5">{v.visit_count}</td>
                  <td className="px-2 py-2.5">{v.target_count}</td>
                  <td className="px-2 py-2.5">{v.completion_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "meetings" && (
        <section className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} className="cso-card flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{m.title}</div>
                <div className="text-sm text-slate-500">{m.meeting_date || "日期待定"}</div>
              </div>
              <StatusBadge status={m.status} />
            </div>
          ))}
          {meetings.length === 0 && (
            <div className="cso-card p-8 text-center text-slate-500">暂无会议参与记录</div>
          )}
        </section>
      )}

      {tab === "training" && (
        <section className="space-y-6">
          <div className="cso-card p-5">
            <h3 className="mb-3 text-lg font-semibold">待完成培训</h3>
            <div className="space-y-3">
              {pendingCourses.map((c) => {
                const e = enrollMap.get(c.id);
                return (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-4">
                    <div>
                      <div className="font-medium">
                        {c.name}
                        {c.is_compliance && (
                          <span className="ml-2 text-xs text-amber-700">备案考试</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">
                        时长：{c.duration_minutes} 分钟
                        {e ? ` · ${e.status}` : " · 未开始"}
                        {e?.score != null ? ` · ${e.score}/${e.max_score}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="cso-btn-secondary" onClick={() => startLearning(c)}>
                        开始学习
                      </button>
                      {c.has_exam && (
                        <button className="cso-btn-primary" onClick={() => openExam(c)}>
                          {e?.status === "考试未通过" ? "重新考试" : "参加考试"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {pendingCourses.length === 0 && (
                <p className="text-sm text-slate-500">暂无待完成课程</p>
              )}
            </div>
          </div>
          <div className="cso-card p-5">
            <h3 className="mb-3 text-lg font-semibold">已完成培训</h3>
            <ul className="space-y-2 text-sm">
              {doneCourses.map((c) => {
                const e = enrollMap.get(c.id);
                return (
                  <li key={c.id} className="flex items-center justify-between border-b border-slate-100 py-2">
                    <span>{c.name}</span>
                    <StatusBadge status={e?.status || "已完成"} />
                  </li>
                );
              })}
              {doneCourses.length === 0 && <li className="text-slate-500">暂无</li>}
            </ul>
          </div>
        </section>
      )}

      {learning && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="cso-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
            <h3 className="text-lg font-semibold">{learning.name}</h3>
            <p className="mt-2 text-sm text-slate-500">{learning.description}</p>
            <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              {learning.content || "暂无学习内容"}
            </pre>
            <div className="mt-4 flex justify-end gap-2">
              <button className="cso-btn-secondary" onClick={() => setLearning(null)}>
                关闭
              </button>
              <button className="cso-btn-primary" onClick={() => finishLearning(learning.id)}>
                {learning.has_exam ? "完成学习，去考试" : "完成学习"}
              </button>
            </div>
          </div>
        </div>
      )}

      {examCourse && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            className="cso-card max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto p-6"
            onSubmit={submitExam}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{examCourse.name} · 考试</h3>
                <p className="text-sm text-slate-500">及格分 {examCourse.is_compliance ? 60 : 60}</p>
              </div>
              <button type="button" className="cso-btn-secondary" onClick={() => setExamCourse(null)}>
                关闭
              </button>
            </div>
            {questions.map((q, idx) => (
              <div key={q.id} className="rounded-lg border border-slate-100 p-4">
                <div className="font-medium">
                  {idx + 1}. {q.stem}（{q.score}分）
                </div>
                <div className="mt-2 space-y-1">
                  {q.options.map((opt, i) => {
                    const key = String.fromCharCode(65 + i);
                    return (
                      <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={key}
                          checked={answers[String(q.id)] === key}
                          onChange={() =>
                            setAnswers((prev) => ({ ...prev, [String(q.id)]: key }))
                          }
                        />
                        {key}. {opt}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            {examResult && <p className="text-sm text-emerald-700">{examResult}</p>}
            <button className="cso-btn-primary" type="submit">
              交卷
            </button>
          </form>
        </div>
      )}
    </AppShell>
  );
}

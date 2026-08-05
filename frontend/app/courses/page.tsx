"use client";

import { FormEvent, useEffect, useState } from "react";
import AppShell, { StatusBadge } from "@/components/AppShell";
import { Modal } from "@/components/ui";
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

type Question = {
  id: number;
  course_id: number;
  stem: string;
  options: string[];
  score: number;
  sort_order: number;
  answer?: string | null;
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
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

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

  async function openQuestions(course: Course) {
    const qs = await api<Question[]>(`/api/training/courses/${course.id}/questions`);
    setEditCourse(course);
    setQuestions(qs);
  }

  async function addQuestion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editCourse) return;
    const fd = new FormData(e.currentTarget);
    const options = [fd.get("a"), fd.get("b"), fd.get("c"), fd.get("d")]
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    await api(`/api/training/courses/${editCourse.id}/questions`, {
      method: "POST",
      body: JSON.stringify({
        stem: fd.get("stem"),
        options,
        answer: String(fd.get("answer") || "A").toUpperCase(),
        score: Number(fd.get("score") || 20),
        sort_order: questions.length + 1,
      }),
    });
    e.currentTarget.reset();
    await openQuestions(editCourse);
    await load();
  }

  async function removeQuestion(qid: number) {
    if (!editCourse) return;
    await api(`/api/training/courses/${editCourse.id}/questions/${qid}`, {
      method: "DELETE",
    });
    await openQuestions(editCourse);
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
        <section className="cso-card p-6">
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
          <table className="cso-table">
            <thead>
              <tr>
                <th>课程名称</th>
                <th>时长(分钟)</th>
                <th>是否考试</th>
                <th>题目数</th>
                <th>学习人次</th>
                <th>通过比例</th>
                <th>发布日期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    {c.is_compliance && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        备案考试
                      </span>
                    )}
                  </td>
                  <td>{c.duration_minutes}</td>
                  <td>{c.has_exam ? "是" : "否"}</td>
                  <td>{c.question_count}</td>
                  <td>{c.learner_count}</td>
                  <td>{c.pass_rate != null ? `${c.pass_rate}%` : "-"}</td>
                  <td>{c.published_on || "-"}</td>
                  <td>
                    <button className="cso-btn-secondary h-8" onClick={() => openQuestions(c)}>
                      维护题目
                    </button>
                  </td>
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
              <div className="text-xs text-[var(--muted-foreground)]">
                学习人次 · 通过率 {c.pass_rate ?? 0}%
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "reps" && (
        <section className="cso-card p-6">
          <h2 className="cso-page-title mb-1">代表培训情况</h2>
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
              {stats.map((s) => (
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
            </tbody>
          </table>
        </section>
      )}

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <form className="space-y-3" onSubmit={createCourse}>
            <h3 className="cso-page-title">新建课程</h3>
            <input className="cso-input" name="name" placeholder="课程名称" required />
            <input className="cso-input" name="description" placeholder="课程描述" />
            <input
              className="cso-input"
              name="duration_minutes"
              type="number"
              defaultValue={60}
              placeholder="时长（分钟）"
            />
            <textarea className="cso-input min-h-24 py-2" name="content" placeholder="学习内容" />
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
        </Modal>
      )}

      {editCourse && (
        <Modal onClose={() => setEditCourse(null)} wide>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">题目维护 · {editCourse.name}</h3>
              <p className="text-sm text-[var(--muted-foreground)]">共 {questions.length} 题</p>
            </div>
            <button className="cso-btn-ghost h-8 px-2" onClick={() => setEditCourse(null)}>
              ×
            </button>
          </div>
          <ul className="mb-4 max-h-56 space-y-2 overflow-y-auto text-sm">
            {questions.map((qitem, idx) => (
              <li key={qitem.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {idx + 1}. {qitem.stem}
                    </div>
                    <div className="mt-1 text-[var(--muted-foreground)]">
                      答案 {qitem.answer} · {qitem.score} 分
                    </div>
                  </div>
                  <button className="cso-btn-secondary h-8" onClick={() => removeQuestion(qitem.id)}>
                    删除
                  </button>
                </div>
              </li>
            ))}
            {questions.length === 0 && (
              <li className="text-[var(--muted-foreground)]">暂无题目，请在下方添加</li>
            )}
          </ul>
          <form className="space-y-2 border-t border-[var(--border)] pt-4" onSubmit={addQuestion}>
            <h4 className="font-medium">新增题目</h4>
            <input className="cso-input" name="stem" placeholder="题干" required />
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="cso-input" name="a" placeholder="选项 A" required />
              <input className="cso-input" name="b" placeholder="选项 B" required />
              <input className="cso-input" name="c" placeholder="选项 C" />
              <input className="cso-input" name="d" placeholder="选项 D" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="cso-input" name="answer" defaultValue="B">
                {["A", "B", "C", "D"].map((x) => (
                  <option key={x} value={x}>
                    正确答案 {x}
                  </option>
                ))}
              </select>
              <input className="cso-input" name="score" type="number" defaultValue={20} />
            </div>
            <div className="flex justify-end">
              <button className="cso-btn-primary">添加题目</button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}

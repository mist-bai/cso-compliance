"use client";

import AppShell from "@/components/AppShell";

export default function CoursesPage() {
  return (
    <AppShell title="课程管理" subtitle="誉学院后台（占位）" requiredRoles={["academy", "admin"]}>
      <section className="cso-card p-8">
        <h2 className="text-xl font-semibold">课程管理</h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          本入口对应原型「课程管理 / 誉学院」。当前阶段先保留门户与权限，后续将：
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-600">
          <li>复用 marketing-platform 的课程、题库、培训项目与成绩统计模块</li>
          <li>与代表备案状态机打通（考试通过 → 考试通过待备案）</li>
          <li>在代理商/合规看板展示培训完成率</li>
        </ul>
      </section>
    </AppShell>
  );
}

"use client";

import Link from "next/link";
import {
  BookOpen,
  LayoutDashboard,
  Shield,
  UserRound,
  Users,
} from "lucide-react";

const portals = [
  {
    href: "/login?role=agent",
    title: "代理商入口",
    desc: "代表备案、行为管理、会议申请、培训统计",
    icon: Users,
    items: ["代表备案上传与管理", "代表拜访数据提交", "学术会议备案与费用申请", "培训参与情况查看"],
  },
  {
    href: "/login?role=rep",
    title: "代表入口",
    desc: "个人信息、行为记录、会议参与、培训考试",
    icon: UserRound,
    items: ["备案信息查看", "个人行为明细", "会议参与记录", "在线培训与考试"],
  },
  {
    href: "/login?role=academy",
    title: "课程管理",
    desc: "跳转到誉学院后台管理",
    icon: BookOpen,
    items: ["培训课程创建与维护", "考试内容管理", "学习进度跟踪", "考试成绩统计"],
  },
  {
    href: "/login?role=compliance",
    title: "合规看板",
    desc: "服务商合规、代表合规、会议合规、培训考试",
    icon: LayoutDashboard,
    items: ["服务商推广驾驶舱", "拜访行为监控图", "市场活动合规图", "培训考试统计"],
  },
  {
    href: "/login?role=admin",
    title: "后台管理",
    desc: "报表查看、费用审批、系统配置",
    icon: Shield,
    items: ["各类业务数据报表", "会议费用审批", "工厂产品管理", "系统设置与权限"],
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)]">
          代理商合规管理系统
        </h1>
        <p className="mt-4 text-lg text-[var(--muted-foreground)]">请选择您的角色入口</p>
      </div>

      <div className="grid w-full max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {portals.map((p) => {
          const Icon = p.icon;
          return (
            <Link key={p.href} href={p.href} className="block h-full">
              <div className="cso-card-hover flex h-full flex-col p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--muted)] text-[var(--foreground)]">
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">{p.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{p.desc}</p>
                <ul className="mt-4 space-y-2 text-sm text-[var(--muted-foreground)]">
                  {p.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-foreground)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
